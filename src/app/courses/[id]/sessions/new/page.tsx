import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SessionGeneratorForm } from "@/components/session-generator-form";

export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = await params;
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("id, topic, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-2 text-sista-plum">Generate a practice session</h2>
        <p className="text-sm text-sista-muted mb-4">
          Pick a topic covered in the uploaded materials. You&apos;ll get warm-up
          recall questions, group problems, and a wrap-up check — just like a
          real SI session.
        </p>
        <SessionGeneratorForm courseId={courseId} />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 text-sista-muted">Past sessions</h3>
        {sessions && sessions.length > 0 ? (
          <ul className="divide-y divide-sista-border rounded-md border border-sista-border bg-white">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/courses/${courseId}/sessions/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-sista-cream/40"
                >
                  <span className="text-sm font-medium">{s.topic}</span>
                  <span className="text-xs text-sista-muted">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-sista-muted">No sessions generated yet.</p>
        )}
      </section>
    </div>
  );
}
