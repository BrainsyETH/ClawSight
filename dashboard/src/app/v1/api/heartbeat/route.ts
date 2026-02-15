import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

/**
 * POST /v1/api/heartbeat
 * Update agent status. Free endpoint (no x402) — see review recommendation.
 * Rate limit: 1 per 15 seconds per wallet.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  // Rate limit: 1 heartbeat per 15 seconds
  if (!checkRateLimit(wallet, "heartbeat", 1, 15_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 1 heartbeat per 15 seconds." },
      { status: 429 }
    );
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

  // Upsert agent_status row
  const { error } = await supabase.from("agent_status").upsert(
    {
      wallet_address: wallet,
      status,
      last_heartbeat: new Date().toISOString(),
      session_id: session_id || null,
      session_start:
        status === "online" ? new Date().toISOString() : undefined,
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

  return NextResponse.json({ message: "ok" });
}
