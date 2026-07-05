"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCourse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const term = String(formData.get("term") ?? "").trim();

  if (!name) redirect("/courses?error=Course%20name%20is%20required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("profiles").upsert({ id: user!.id }, { onConflict: "id", ignoreDuplicates: true });

  const { data: course, error } = await supabase
    .from("courses")
    .insert({ name, code: code || null, term: term || null, created_by: user!.id })
    .select("id")
    .single();

  if (error) redirect(`/courses?error=${encodeURIComponent(error.message)}`);

  await supabase.from("enrollments").insert({ user_id: user!.id, course_id: course.id });

  redirect(`/courses/${course.id}`);
}

export async function joinCourse(formData: FormData) {
  const courseId = String(formData.get("courseId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("enrollments").insert({ user_id: user!.id, course_id: courseId });

  revalidatePath("/courses");
  redirect(`/courses/${courseId}`);
}
