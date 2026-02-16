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

  // Check sync preferences — if status sync is disabled, silently accept
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

  // Validate session_id format if provided (UUID v4)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (session_id && (typeof session_id !== "string" || !UUID_RE.test(session_id))) {
    return NextResponse.json(
      { error: "session_id must be a valid UUID v4" },
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
