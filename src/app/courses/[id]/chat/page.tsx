import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat-panel";

export default async function CourseChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let { data: session } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    const { data: newSession } = await supabase
      .from("chat_sessions")
      .insert({ course_id: courseId, user_id: user!.id, title: "Study chat" })
      .select("id")
      .single();
    session = newSession;
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, citations, created_at")
    .eq("session_id", session!.id)
    .order("created_at", { ascending: true });

  return (
    <ChatPanel
      courseId={courseId}
      sessionId={session!.id}
      initialMessages={messages ?? []}
    />
  );
}
