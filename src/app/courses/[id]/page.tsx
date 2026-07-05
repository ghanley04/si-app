import { createClient } from "@/lib/supabase/server";
import { MaterialUploader } from "@/components/material-uploader";

const statusLabel: Record<string, string> = {
  pending: "Processing…",
  processed: "Ready",
  error: "Failed",
};

export default async function CourseMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, filename, status, error_message, created_at")
    .eq("course_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-2 text-sista-plum">Course materials</h2>
        <p className="text-sm text-sista-muted mb-4">
          Upload lecture slides, notes, or past problem sets (PDF or text). The
          chat and practice-session generator only use what&apos;s uploaded here.
        </p>
        <MaterialUploader courseId={id} />
      </section>

      <section>
        {materials && materials.length > 0 ? (
          <ul className="divide-y divide-sista-border rounded-md border border-sista-border bg-white">
            {materials.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{m.filename}</span>
                <span
                  className={
                    "text-xs " +
                    (m.status === "error" ? "text-red-600" : "text-sista-muted")
                  }
                  title={m.error_message ?? undefined}
                >
                  {statusLabel[m.status] ?? m.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-sista-muted">No materials uploaded yet.</p>
        )}
      </section>
    </div>
  );
}
