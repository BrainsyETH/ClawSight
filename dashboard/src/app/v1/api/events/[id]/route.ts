import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

/**
 * DELETE /v1/api/events/:id
 * Redact (delete) a single activity event.
 * Users can remove sensitive events from their history.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  const { id } = await params;

  // Verify the event belongs to this wallet (RLS handles this too, but be explicit)
  const { data: event } = await supabase
    .from("activity_events")
    .select("id, wallet_address")
    .eq("id", id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.wallet_address !== wallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("activity_events")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Event redacted" });
}

/**
 * PATCH /v1/api/events/:id
 * Redact specific fields from an event's data without deleting the whole event.
 * Replaces specified fields with "[redacted]".
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  const { id } = await params;
  const body = await request.json();
  const { redact_fields } = body;

  if (!redact_fields || !Array.isArray(redact_fields)) {
    return NextResponse.json(
      { error: "redact_fields array is required" },
      { status: 400 }
    );
  }

  // Fetch the event
  const { data: event } = await supabase
    .from("activity_events")
    .select("*")
    .eq("id", id)
    .eq("wallet_address", wallet)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Redact specified fields
  const redactedData = { ...event.event_data };
  for (const field of redact_fields) {
    if (field in redactedData) {
      redactedData[field] = "[redacted]";
    }
  }

  const { error } = await supabase
    .from("activity_events")
    .update({ event_data: redactedData })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to redact event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Fields redacted", redacted: redact_fields });
}
