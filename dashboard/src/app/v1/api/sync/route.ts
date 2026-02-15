import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

/**
 * POST /v1/api/sync
 * Push activity events from plugin to ClawSight.
 * Rate limit: 10 requests per minute per wallet.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  // Rate limit: 10 syncs per minute
  if (!checkRateLimit(wallet, "sync", 10, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 10 sync requests per minute." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { events, idempotency_key } = body;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: "events array is required" },
      { status: 400 }
    );
  }

  // Validate event types
  const allowedTypes = [
    "tool_call", "message_sent", "payment", "error",
    "status_change", "skill_installed", "config_changed",
  ];

  const validEvents = events.filter(
    (e: Record<string, unknown>) =>
      e.event_type && allowedTypes.includes(e.event_type as string)
  );

  if (validEvents.length === 0) {
    return NextResponse.json(
      { error: "No valid events in payload" },
      { status: 400 }
    );
  }

  // Check idempotency (simple dedup by key)
  if (idempotency_key) {
    const { data: existing } = await supabase
      .from("activity_events")
      .select("id")
      .eq("wallet_address", wallet)
      .eq("event_data->>idempotency_key", idempotency_key)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: "Already processed", duplicates: true });
    }
  }

  // Insert events with wallet_address
  const rows = validEvents.map((e: Record<string, unknown>) => ({
    wallet_address: wallet,
    skill_slug: e.skill_slug || null,
    session_id: e.session_id || null,
    event_type: e.event_type,
    event_data: {
      ...(e.event_data as Record<string, unknown>),
      ...(idempotency_key ? { idempotency_key } : {}),
    },
    occurred_at: e.occurred_at || new Date().toISOString(),
  }));

  const { error } = await supabase.from("activity_events").insert(rows);

  if (error) {
    console.error("[sync] Insert error:", error);
    return NextResponse.json(
      { error: "Failed to store events" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "ok",
    count: rows.length,
  });
}
