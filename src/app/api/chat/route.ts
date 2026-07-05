import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiProvider, type ChatTurn } from "@/lib/ai/provider";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { sessionId, courseId, message } = await request.json();
  if (!sessionId || !courseId || !message) {
    return NextResponse.json({ error: "Missing sessionId, courseId, or message" }, { status: 400 });
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

  const { data: userMessage, error: userMessageError } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId, role: "user", content: message })
    .select("id")
    .single();
  if (userMessageError) {
    return NextResponse.json({ error: userMessageError.message }, { status: 500 });
  }

  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  const history: ChatTurn[] = (historyRows ?? []).map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content,
  }));

  const ai = await getAiProvider();
  const queryEmbedding = await ai.embed(message);

  const { data: matches } = await supabase.rpc("match_material_chunks", {
    query_embedding: queryEmbedding,
    target_course_id: courseId,
    match_count: 6,
  });

  const contextBlock = (matches ?? [])
    .map((m: { content: string }, i: number) => `[${i + 1}] ${m.content}`)
    .join("\n\n");

  const systemPrompt = `You are an AI Supplemental Instruction (SI) leader helping a student study for their course. Answer using ONLY the course material excerpts below when they're relevant — act like a peer study leader: explain concepts clearly, check understanding, and encourage active recall rather than just handing over answers. If the excerpts don't cover the question, say so plainly instead of guessing.

Course material excerpts:
${contextBlock || "(no matching material found)"}`;

  const answer = await ai.chat(systemPrompt, history);

  const citations = (matches ?? []).map((m: { id: string; material_id: string }, i: number) => ({
    index: i + 1,
    chunkId: m.id,
    materialId: m.material_id,
  }));

  const { data: assistantMessage, error: assistantMessageError } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      role: "assistant",
      content: answer,
      citations,
    })
    .select("id, content, citations, created_at")
    .single();
  if (assistantMessageError) {
    return NextResponse.json({ error: assistantMessageError.message }, { status: 500 });
  }

  return NextResponse.json({ userMessageId: userMessage.id, message: assistantMessage });
}
