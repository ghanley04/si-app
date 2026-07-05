import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCourse, joinCourse } from "./actions";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  interface Course {
    id: string;
    name: string;
    code: string | null;
    term: string | null;
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("courses(id, name, code, term)")
    .eq("user_id", user.id);

  const enrolledCourses: Course[] = (enrollments ?? [])
    .flatMap((e) => e.courses as unknown as Course | Course[])
    .filter((c): c is Course => Boolean(c));
  const enrolledIds = new Set(enrolledCourses.map((c) => c.id));

  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, name, code, term")
    .order("created_at", { ascending: false });

  const joinableCourses = (allCourses ?? []).filter((c) => !enrolledIds.has(c.id));

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-10">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h1 className="text-2xl font-semibold mb-4 text-sista-plum">Your courses</h1>
        {enrolledCourses.length === 0 ? (
          <p className="text-sm text-sista-muted">
            You haven&apos;t joined any courses yet.
          </p>
        ) : (
          <ul className="divide-y divide-sista-border rounded-md border border-sista-border bg-white">
            {enrolledCourses.map((course) => {
              return (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-sista-cream/40"
                  >
                    <span className="flex items-baseline gap-2 font-medium">
                      <span>{course.name}</span>
                      {course.code && <span>{course.code}</span>}
                    </span>
                    {course.term && (
                      <span className="text-sm text-sista-muted">{course.term}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-sista-plum">Create a course</h2>
        <form action={createCourse} className="grid grid-cols-3 gap-3">
          <input
            name="name"
            placeholder="Course name (required)"
            required
            className="col-span-3 rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum sm:col-span-1"
          />
          <input
            name="code"
            placeholder="Code (e.g. CHM 116)"
            className="rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
          />
          <input
            name="term"
            placeholder="Term (e.g. Fall 2026)"
            className="rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
          />
          <button
            type="submit"
            className="col-span-3 rounded-md bg-sista-plum px-4 py-2 text-sm font-medium text-white hover:bg-sista-coral sm:col-span-1"
          >
            Create
          </button>
        </form>
      </section>

      {joinableCourses.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-sista-plum">Join an existing course</h2>
          <ul className="divide-y divide-sista-border rounded-md border border-sista-border bg-white">
            {joinableCourses.map((course) => (
              <li key={course.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="flex items-baseline gap-2 font-medium">
                    <span>{course.name}</span>
                    {course.code && <span>{course.code}</span>}
                  </p>
                  {course.term && <p className="text-sm text-sista-muted">{course.term}</p>}
                </div>
                <form action={joinCourse}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-sista-border px-3 py-1.5 text-sm text-sista-plum hover:bg-sista-cream/60"
                  >
                    Join
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
