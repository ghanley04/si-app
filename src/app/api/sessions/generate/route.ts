import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/provider";
import type { SourceImage } from "@/lib/ai/provider";

export const runtime = "nodejs";

// Cap on how many diagram images get sent as multimodal input per generation
// call, to bound token/cost while still grounding the highest-similarity excerpts.
const MAX_IMAGES_PER_GENERATION = 4;
const IMAGE_LABELS = "ABCD";

const SESSION_SCHEMA_PROMPT = `You are an AI Supplemental Instruction (SI) leader designing a peer study session. Respond with ONLY valid JSON matching exactly this shape, no markdown fences:
{
  "warmUp": string[],          // 3-5 quick active-recall questions to start the session
  "groupProblems": { "prompt": string, "hint": string, "imageRef": string }[],  // 2-4 harder problems for small groups to work through together, each with an optional hint
  "wrapUpCheck": string[]      // 2-3 questions to confirm understanding before ending
}
Base every question strictly on the provided course material excerpts. If the excerpts don't cover the requested topic well, write questions from what IS covered and note the gap in one of the warmUp questions.
Some excerpts are annotated with "(Image X available)" — an actual diagram/figure image will be attached to this request, labeled to match. If (and only if) a groupProblems question genuinely requires interpreting one of the attached images, add an "imageRef" field to that item set to that label (e.g. "A"). Do NOT write "see the picture"/"using the provided diagram" unless you set imageRef to a label that was actually attached. Most problems should have no imageRef — omit the field entirely rather than leaving it empty. Never invent an image reference for an excerpt that has no annotation.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { courseId, topic } = await request.json();
  if (!courseId || !topic) {
    return NextResponse.json({ error: "Missing courseId or topic" }, { status: 400 });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
  }

  const ai = await getAiProvider();
  const queryEmbedding = await ai.embed(topic);

  const { data: matches } = await supabase.rpc("match_material_chunks", {
    query_embedding: queryEmbedding,
    target_course_id: courseId,
    match_count: 8,
  });

  const matchRows = (matches ?? []) as {
    content: string;
    material_id: string;
    page_number: number | null;
  }[];

  if (matchRows.length === 0) {
    return NextResponse.json(
      { error: "No course materials have been uploaded yet — upload some first." },
      { status: 400 }
    );
  }

  const materialIds = [...new Set(matchRows.map((m) => m.material_id))];
  const { data: materialImages } = await supabase
    .from("material_images")
    .select("id, material_id, page_number, storage_path")
    .in("material_id", materialIds);

  const imagesByMaterialPage = new Map<
    string,
    { id: string; storage_path: string }
  >();
  for (const img of materialImages ?? []) {
    imagesByMaterialPage.set(`${img.material_id}:${img.page_number}`, img);
  }

  // Select up to MAX_IMAGES_PER_GENERATION images, favoring the highest-
  // similarity excerpts first (matchRows is already ordered by similarity).
  const selectedImages: SourceImage[] = [];
  const labelByChunkIndex = new Map<number, string>();
  const serviceClient = createServiceRoleClient();

  for (let i = 0; i < matchRows.length; i++) {
    if (selectedImages.length >= MAX_IMAGES_PER_GENERATION) break;
    const match = matchRows[i];
    if (match.page_number == null) continue;

    const image = imagesByMaterialPage.get(`${match.material_id}:${match.page_number}`);
    if (!image) continue;
    if (selectedImages.some((img) => img.id === image.id)) continue;

    const { data: blob, error: downloadError } = await serviceClient.storage
      .from("materials")
      .download(image.storage_path);
    if (downloadError || !blob) continue;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const label = IMAGE_LABELS[selectedImages.length];
    selectedImages.push({
      id: image.id,
      label,
      base64: buffer.toString("base64"),
      mimeType: "image/png",
    });
    labelByChunkIndex.set(i, label);
  }

  const contextBlock = matchRows
    .map((m, i) => {
      const label = labelByChunkIndex.get(i);
      const annotation = label ? ` (Image ${label} available)` : "";
      return `[${i + 1}]${annotation} ${m.content}`;
    })
    .join("\n\n");

  const userPrompt = `Topic: ${topic}\n\nCourse material excerpts:\n${contextBlock}`;

  try {
    const generated = await ai.generateSession(SESSION_SCHEMA_PROMPT, userPrompt, selectedImages);

    const labelToId = new Map(selectedImages.map((img) => [img.label, img.id]));
    generated.groupProblems = generated.groupProblems?.map((p) => {
      if (!p.imageRef) return p;
      const resolvedId = labelToId.get(p.imageRef);
      return resolvedId ? { ...p, imageRef: resolvedId } : { ...p, imageRef: undefined };
    });

    const { data: session, error } = await supabase
      .from("practice_sessions")
      .insert({
        course_id: courseId,
        created_by: user.id,
        topic,
        content: generated,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate session" },
      { status: 500 }
    );
  }
}
