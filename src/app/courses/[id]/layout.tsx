import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, code, term")
    .eq("id", id)
    .single();
  if (!course) notFound();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("course_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!enrollment) redirect("/courses");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-6">
      <div>
        <Link href="/courses" className="text-sm text-sista-muted hover:underline">
          &larr; All courses
        </Link>
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold text-sista-plum">
          <span>{course.name}</span>
          {course.code && <span>{course.code}</span>}
        </h1>
        {course.term && <p className="text-sm text-sista-muted">{course.term}</p>}
      </div>
      <nav className="flex gap-4 border-b border-sista-border text-sm">
        <Link href={`/courses/${id}`} className="px-1 pb-2 hover:underline">
          Materials
        </Link>
        <Link href={`/courses/${id}/chat`} className="px-1 pb-2 hover:underline">
          Chat
        </Link>
        <Link href={`/courses/${id}/sessions/new`} className="px-1 pb-2 hover:underline">
          Practice sessions
        </Link>
      </nav>
      {children}
    </div>
  );
}
