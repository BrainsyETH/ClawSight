import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";
import { recordUsage, checkSpendingCaps } from "@/lib/server/billing";

/**
 * POST /v1/api/heartbeat
 *
 * Update agent status + bill compute minutes based on time since last heartbeat.
 *
 * The heartbeat itself is free, but each heartbeat also records compute_minute
 * usage for the time elapsed since the previous heartbeat. This is how we meter
 * Fly.io compute — the agent sends heartbeats every 30-60s, and we bill the
 * delta in minutes.
 *
 * Response includes spending cap status so the plugin can proactively stop
 * the agent before the server-side cron hard-kills it.
 *
 * Rate limit: 1 per 15 seconds per wallet.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "heartbeat", 1, 15_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 1 heartbeat per 15 seconds." },
      { status: 429 }
    );
  }

  // Check sync preferences
  const { data: userData } = await supabase
    .from("users")
    .select("sync_status")
    .eq("wallet_address", wallet)
    .single();

  if (userData && !userData.sync_status) {
    return NextResponse.json({ message: "ok", synced: false });
  }

  const body = await request.json();
  const { status, session_id } = body;

  const allowedStatuses = ["online", "thinking", "idle", "offline"];
  if (!status || !allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${allowedStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (session_id && (typeof session_id !== "string" || !UUID_RE.test(session_id))) {
    return NextResponse.json(
      { error: "session_id must be a valid UUID v4" },
      { status: 400 }
    );
  }

  const now = new Date();

  // Fetch previous heartbeat to compute elapsed minutes
  const { data: prevStatus } = await supabase
    .from("agent_status")
    .select("last_heartbeat, status")
    .eq("wallet_address", wallet)
    .single();

  // Bill compute minutes for time since last heartbeat
  // Only bill if the agent was previously online/thinking (actually running)
  let computeMinutesBilled = 0;
  if (
    prevStatus?.last_heartbeat &&
    prevStatus.status !== "offline"
  ) {
    const lastBeat = new Date(prevStatus.last_heartbeat);
    const elapsedMs = now.getTime() - lastBeat.getTime();
    // Cap at 5 minutes per heartbeat interval to prevent billing for
    // gaps where the agent was actually down (missed heartbeats)
    const elapsedMinutes = Math.min(elapsedMs / 60_000, 5);

    if (elapsedMinutes > 0.1) {
      // Bill fractional minutes (floor to nearest 0.1 min)
      const billableMinutes = Math.floor(elapsedMinutes * 10) / 10;
      if (billableMinutes > 0) {
        await recordUsage(supabase, wallet, "compute_minute", {
          metadata: {
            minutes: billableMinutes,
            from: prevStatus.last_heartbeat,
            to: now.toISOString(),
          },
        });
        computeMinutesBilled = billableMinutes;
      }
    }
  }

  // Record free heartbeat operation
  await recordUsage(supabase, wallet, "heartbeat");

  // Upsert agent_status
  const { error } = await supabase.from("agent_status").upsert(
    {
      wallet_address: wallet,
      status,
      last_heartbeat: now.toISOString(),
      session_id: session_id || null,
      session_start:
        status === "online" && prevStatus?.status === "offline"
          ? now.toISOString()
          : undefined,
    },
    { onConflict: "wallet_address" }
  );

  if (error) {
    console.error("[heartbeat] Upsert error:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }

  // Check spending caps and include in response so plugin can act
  const capCheck = await checkSpendingCaps(supabase, wallet);

  return NextResponse.json({
    message: "ok",
    compute_minutes_billed: computeMinutesBilled,
    spending: {
      daily_spend: capCheck.daily_spend ?? 0,
      monthly_spend: capCheck.monthly_spend ?? 0,
      daily_cap: capCheck.daily_cap ?? 0,
      monthly_cap: capCheck.monthly_cap ?? 0,
      cap_exceeded: !capCheck.allowed,
      warning: capCheck.reason || null,
    },
  });
}
