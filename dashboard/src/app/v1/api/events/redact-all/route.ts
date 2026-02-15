import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

/**
 * POST /v1/api/events/redact-all
 * Bulk delete all activity events for the authenticated wallet.
 * GDPR "right to erasure" — one-click data deletion.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const { confirm } = body;

  if (confirm !== "DELETE_ALL_MY_DATA") {
    return NextResponse.json(
      {
        error:
          'Confirmation required. Send { "confirm": "DELETE_ALL_MY_DATA" } to proceed.',
      },
      { status: 400 }
    );
  }

  // Delete all activity events
  const { error: eventsError, count: eventsCount } = await supabase
    .from("activity_events")
    .delete({ count: "exact" })
    .eq("wallet_address", wallet);

  if (eventsError) {
    return NextResponse.json(
      { error: "Failed to delete events" },
      { status: 500 }
    );
  }

  // Delete agent status
  await supabase
    .from("agent_status")
    .delete()
    .eq("wallet_address", wallet);

  // Delete skill configs
  const { count: configsCount } = await supabase
    .from("skill_configs")
    .delete({ count: "exact" })
    .eq("wallet_address", wallet);

  return NextResponse.json({
    message: "All data deleted",
    deleted: {
      events: eventsCount || 0,
      configs: configsCount || 0,
      status: 1,
    },
  });
}
