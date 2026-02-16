import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";
import { billingGate } from "@/lib/server/x402";

/**
 * GET /v1/api/export
 * Export all user data as JSON. GDPR "right to data portability".
 * Rate limit: 1 export per minute per wallet.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "export", 1, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 1 export per minute." },
      { status: 429 }
    );
  }

  // Billing: exports cost $0.01
  const billing = await billingGate(supabase, wallet, "export", {
    paymentHeader: request.headers.get("X-Payment"),
  });
  if (billing) return billing;

  // Fetch all user data in parallel
  const [userRes, configsRes, eventsRes, statusRes] = await Promise.all([
    supabase.from("users").select("*").eq("wallet_address", wallet).single(),
    supabase
      .from("skill_configs")
      .select("*")
      .eq("wallet_address", wallet)
      .order("created_at"),
    supabase
      .from("activity_events")
      .select("*")
      .eq("wallet_address", wallet)
      .order("occurred_at", { ascending: false })
      .limit(10000),
    supabase
      .from("agent_status")
      .select("*")
      .eq("wallet_address", wallet)
      .single(),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    wallet_address: wallet,
    user_profile: userRes.data,
    skill_configs: configsRes.data || [],
    activity_events: eventsRes.data || [],
    agent_status: statusRes.data,
    note: "Secret fields (API keys, tokens) are encrypted. You need your wallet to decrypt them.",
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="clawsight-export-${wallet.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
