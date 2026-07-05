import { NextRequest, NextResponse } from "next/server";
import type { PDFParse } from "pdf-parse";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/chunk";
import { getAiProvider, type AiProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";

const IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
};

// PDFs made from scanned/handwritten pages carry little or no embedded text.
// Below this length we treat the PDF as image-only and fall back to OCR.
const MIN_EXTRACTED_TEXT_LENGTH = 40;

function imageMimeType(file: File): string | null {
  if (file.type.startsWith("image/")) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return IMAGE_MIME_TYPES[ext] ?? null;
}

async function ocrPdf(parser: PDFParse, ai: AiProvider): Promise<string> {
  const { pages } = await parser.getScreenshot({ imageBuffer: true });

  const pageTexts: string[] = [];
  for (const page of pages) {
    pageTexts.push(await ai.ocrImage(Buffer.from(page.data).toString("base64"), "image/png"));
  }
  return pageTexts.join("\n\n");
}

async function extractText(file: File, ai: AiProvider): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const imageMime = imageMimeType(file);
  if (imageMime) {
    return ai.ocrImage(buffer.toString("base64"), imageMime);
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text;

      if (text.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
        return await ocrPdf(parser, ai);
      }
      return text;
    } finally {
      await parser.destroy();
    }
  }

  return buffer.toString("utf-8");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const courseId = String(formData.get("courseId") ?? "");

  if (!(file instanceof File) || !courseId) {
    return NextResponse.json({ error: "Missing file or courseId" }, { status: 400 });
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

  const storagePath = `${courseId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("materials")
    .upload(storagePath, file);
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: material, error: insertError } = await supabase
    .from("materials")
    .insert({
      course_id: courseId,
      uploaded_by: user.id,
      filename: file.name,
      storage_path: storagePath,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !material) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create material record" },
      { status: 500 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    const ai = await getAiProvider();
    const text = await extractText(file, ai);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("No extractable text found in file");
    }

    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await ai.embed(chunks[i]);
      rows.push({
        material_id: material.id,
        course_id: courseId,
        content: chunks[i],
        chunk_index: i,
        embedding,
      });
    }

    const { error: chunksError } = await supabase.from("material_chunks").insert(rows);
    if (chunksError) throw new Error(chunksError.message);

    await serviceClient
      .from("materials")
      .update({ status: "processed" })
      .eq("id", material.id);
  } catch (err) {
    await serviceClient
      .from("materials")
      .update({
        status: "error",
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", material.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ materialId: material.id, status: "processed" });
}
