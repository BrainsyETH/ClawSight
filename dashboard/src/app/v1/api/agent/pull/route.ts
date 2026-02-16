import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

/**
 * GET /v1/api/agent/pull
 *
 * The OpenClaw agent polls this endpoint to pull pending configuration changes.
 * Returns all skill configs with sync_status = "pending" or "syncing".
 *
 * The agent flow:
 *   1. Agent polls GET /v1/api/agent/pull every 15-30s
 *   2. For each pending config, agent applies it locally
 *   3. Agent reports back via POST /v1/api/config/status with "applied" or "failed"
 *
 * Query params:
 *   ?since=<ISO timestamp> — only return configs updated after this timestamp
 *   ?include_all=true — return all configs (not just pending)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "agent-pull", 30, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const since = request.nextUrl.searchParams.get("since");
  const includeAll = request.nextUrl.searchParams.get("include_all") === "true";

  // Check user's sync preferences
  const { data: user } = await supabase
    .from("users")
    .select("sync_configs")
    .eq("wallet_address", wallet)
    .single();

  if (user && !user.sync_configs) {
    return NextResponse.json({
      configs: [],
      message: "Config sync is disabled in user settings",
    });
  }

  // Build query
  let query = supabase
    .from("skill_configs")
    .select("*")
    .eq("wallet_address", wallet)
    .order("updated_at", { ascending: true });

  if (!includeAll) {
    query = query.in("sync_status", ["pending", "syncing"]);
  }

  if (since) {
    query = query.gt("updated_at", since);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[agent/pull] Query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch configs" },
      { status: 500 }
    );
  }

  // Mark pending configs as "syncing" now that the agent has received them
  const pendingIds = (data || [])
    .filter((c) => c.sync_status === "pending")
    .map((c) => c.id);

  if (pendingIds.length > 0) {
    await supabase
      .from("skill_configs")
      .update({ sync_status: "syncing" })
      .in("id", pendingIds);
  }

  return NextResponse.json({
    configs: data || [],
    pending_count: pendingIds.length,
    server_time: new Date().toISOString(),
  });
}

/**
 * POST /v1/api/agent/pull
 *
 * Agent can also POST to acknowledge receipt of specific configs
 * and report their status in bulk (alternative to individual /config/status calls).
 *
 * Body: { results: [{ skill_slug, sync_status, sync_error? }] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "agent-pull-ack", 20, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { results } = body;

  if (!results || !Array.isArray(results)) {
    return NextResponse.json(
      { error: "results array is required" },
      { status: 400 }
    );
  }

  const allowedStatuses = ["applied", "failed"];
  let updated = 0;

  for (const result of results) {
    const { skill_slug, sync_status, sync_error } = result;
    if (!skill_slug || !allowedStatuses.includes(sync_status)) continue;

    const { error } = await supabase
      .from("skill_configs")
      .update({
        sync_status,
        sync_error: sync_error || null,
      })
      .eq("wallet_address", wallet)
      .eq("skill_slug", skill_slug);

    if (!error) updated++;
  }

  return NextResponse.json({ updated });
}
