import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";

const SESSION_SCHEMA_PROMPT = `You are an AI Supplemental Instruction (SI) leader designing a peer study session. Respond with ONLY valid JSON matching exactly this shape, no markdown fences:
{
  "warmUp": string[],          // 3-5 quick active-recall questions to start the session
  "groupProblems": { "prompt": string, "hint": string }[],  // 2-4 harder problems for small groups to work through together, each with an optional hint
  "wrapUpCheck": string[]      // 2-3 questions to confirm understanding before ending
}
Base every question strictly on the provided course material excerpts. If the excerpts don't cover the requested topic well, write questions from what IS covered and note the gap in one of the warmUp questions.`;

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

  const contextBlock = (matches ?? [])
    .map((m: { content: string }, i: number) => `[${i + 1}] ${m.content}`)
    .join("\n\n");

  if (!contextBlock) {
    return NextResponse.json(
      { error: "No course materials have been uploaded yet — upload some first." },
      { status: 400 }
    );
  }

  const userPrompt = `Topic: ${topic}\n\nCourse material excerpts:\n${contextBlock}`;

  try {
    const generated = await ai.generateSession(SESSION_SCHEMA_PROMPT, userPrompt);

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
