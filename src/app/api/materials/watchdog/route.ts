import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Materials still "pending" past this age are assumed to have died mid-request
// (e.g. a serverless function timeout during OCR/embedding) and are flagged as
// errored so they stop looking like they're silently processing forever.
const STALE_MINUTES = Number(process.env.MATERIALS_WATCHDOG_STALE_MINUTES ?? 15);

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const { data: staleMaterials, error: selectError } = await supabase
    .from("materials")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", staleBefore);
  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (!staleMaterials || staleMaterials.length === 0) {
    return NextResponse.json({ flagged: 0 });
  }

  const { error: updateError } = await supabase
    .from("materials")
    .update({
      status: "error",
      error_message: "Processing timed out",
    })
    .in(
      "id",
      staleMaterials.map((m) => m.id)
    );
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ flagged: staleMaterials.length });
}
