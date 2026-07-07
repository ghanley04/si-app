import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: material } = await supabase
    .from("materials")
    .select("id, course_id, uploaded_by, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("created_by")
    .eq("id", material.course_id)
    .maybeSingle();

  const canDelete = material.uploaded_by === user.id || course?.created_by === user.id;
  if (!canDelete) {
    return NextResponse.json({ error: "Not allowed to delete this material" }, { status: 403 });
  }

  const serviceClient = createServiceRoleClient();

  const { data: images } = await serviceClient
    .from("material_images")
    .select("storage_path")
    .eq("material_id", id);

  const storagePaths = [material.storage_path, ...(images ?? []).map((img) => img.storage_path)];
  await serviceClient.storage.from("materials").remove(storagePaths);

  const { error: deleteError } = await serviceClient.from("materials").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
