import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

const MAX_BATCH_SIZE = 100;
const MAX_EVENT_DATA_SIZE = 102_400; // 100KB per event_data

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

  if (events.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Too many events. Maximum ${MAX_BATCH_SIZE} per request.` },
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

  // Validate event_data size and structure
  for (const e of validEvents) {
    const eventData = e.event_data;
    if (eventData !== undefined && eventData !== null) {
      if (typeof eventData !== "object" || Array.isArray(eventData)) {
        return NextResponse.json(
          { error: "event_data must be a plain object" },
          { status: 400 }
        );
      }
      const serialized = JSON.stringify(eventData);
      if (serialized.length > MAX_EVENT_DATA_SIZE) {
        return NextResponse.json(
          { error: `event_data exceeds maximum size of ${MAX_EVENT_DATA_SIZE} bytes` },
          { status: 400 }
        );
      }
    }

    // Validate optional string fields
    if (e.skill_slug !== undefined && typeof e.skill_slug !== "string") {
      return NextResponse.json(
        { error: "skill_slug must be a string" },
        { status: 400 }
      );
    }
    if (e.session_id !== undefined && typeof e.session_id !== "string") {
      return NextResponse.json(
        { error: "session_id must be a string" },
        { status: 400 }
      );
    }
  }

  // Check idempotency (simple dedup by key)
  if (idempotency_key) {
    if (typeof idempotency_key !== "string" || idempotency_key.length > 256) {
      return NextResponse.json(
        { error: "idempotency_key must be a string (max 256 chars)" },
        { status: 400 }
      );
    }

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

  // Insert events with wallet_address (always use server timestamp)
  const rows = validEvents.map((e: Record<string, unknown>) => ({
    wallet_address: wallet,
    skill_slug: e.skill_slug || null,
    session_id: e.session_id || null,
    event_type: e.event_type,
    event_data: {
      ...(e.event_data as Record<string, unknown>),
      ...(idempotency_key ? { idempotency_key } : {}),
    },
    occurred_at: new Date().toISOString(),
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
