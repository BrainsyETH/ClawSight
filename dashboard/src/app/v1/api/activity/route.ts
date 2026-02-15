import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

/**
 * GET /v1/api/activity
 * Fetch activity events for the authenticated wallet.
 * Supports pagination, filtering by event_type, and search.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "activity", 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");
  const eventType = searchParams.get("event_type");
  const skillSlug = searchParams.get("skill_slug");
  const sessionId = searchParams.get("session_id");

  let query = supabase
    .from("activity_events")
    .select("*", { count: "exact" })
    .eq("wallet_address", wallet)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }
  if (skillSlug) {
    query = query.eq("skill_slug", skillSlug);
  }
  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    events: data,
    total: count,
    limit,
    offset,
  });
}
