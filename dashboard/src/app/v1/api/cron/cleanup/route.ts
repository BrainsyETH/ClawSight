import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server/supabase";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /v1/api/cron/cleanup
 *
 * Data retention cleanup cron endpoint.
 * Secured by CRON_SECRET header (set in Vercel cron config).
 *
 * vercel.json:
 *   { "crons": [{ "path": "/v1/api/cron/cleanup", "schedule": "0 3 * * *" }] }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Run the data retention cleanup function
    const { error } = await supabase.rpc("cleanup_old_events");
    if (error) {
      console.error("[cron/cleanup] RPC error:", error);
      return NextResponse.json(
        { error: "Cleanup RPC failed" },
        { status: 500 }
      );
    }

    // Mark stale agents as offline (no heartbeat in 24h)
    const staleThreshold = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("agent_status")
      .update({ status: "offline", session_id: null })
      .lt("last_heartbeat", staleThreshold)
      .neq("status", "offline");

    return NextResponse.json({
      message: "Cleanup completed",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/cleanup] Error:", err);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
