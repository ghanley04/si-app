import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedSession } from "@/lib/ai/provider";

export default async function SessionWorksheetPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("practice_sessions")
    .select("topic, content, created_at")
    .eq("id", sessionId)
    .single();
  if (!session) notFound();

  const content = session.content as GeneratedSession;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-sista-plum">{session.topic}</h2>
        <p className="text-sm text-sista-muted">
          Generated {new Date(session.created_at).toLocaleString()}
        </p>
      </div>

      <section>
        <h3 className="font-semibold mb-2 text-sista-plum">Warm-up</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          {content.warmUp?.map((q, i) => <li key={i}>{q}</li>)}
        </ol>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-sista-plum">Group problems</h3>
        <ol className="list-decimal list-inside space-y-3 text-sm">
          {content.groupProblems?.map((p, i) => (
            <li key={i}>
              <p>{p.prompt}</p>
              {p.hint && <p className="text-xs text-sista-muted pl-5">Hint: {p.hint}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-sista-plum">Wrap-up check</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          {content.wrapUpCheck?.map((q, i) => <li key={i}>{q}</li>)}
        </ol>
      </section>
    </div>
  );
}
