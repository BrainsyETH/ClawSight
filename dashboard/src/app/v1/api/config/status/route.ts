import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

/**
 * POST /v1/api/config/status
 * Plugin reports back whether a config change was successfully applied.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  const body = await request.json();
  const { skill_slug, sync_status, sync_error } = body;

  if (!skill_slug || !sync_status) {
    return NextResponse.json(
      { error: "skill_slug and sync_status are required" },
      { status: 400 }
    );
  }

  const allowedStatuses = ["pending", "syncing", "applied", "failed"];
  if (!allowedStatuses.includes(sync_status)) {
    return NextResponse.json(
      { error: `sync_status must be one of: ${allowedStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("skill_configs")
    .update({
      sync_status,
      sync_error: sync_error || null,
    })
    .eq("wallet_address", wallet)
    .eq("skill_slug", skill_slug);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update sync status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "ok" });
}
