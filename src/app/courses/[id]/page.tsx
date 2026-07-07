import { createClient } from "@/lib/supabase/server";
import { MaterialUploader } from "@/components/material-uploader";
import { MaterialsList } from "@/components/materials-list";

export default async function CourseMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course } = await supabase
    .from("courses")
    .select("created_by")
    .eq("id", id)
    .maybeSingle();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, filename, status, error_message, uploaded_by, created_at")
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
        <MaterialsList
          materials={materials ?? []}
          currentUserId={user?.id}
          courseCreatedBy={course?.created_by}
        />
      </section>
    </div>
  );
}
