import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";
import { getUsageSummary, getUsageHistory, getRecentUsage } from "@/lib/server/billing";

/**
 * GET /v1/api/billing/usage
 *
 * Returns current usage summary, spending caps, daily history, and recent ledger entries.
 * Query params: ?days=30 (history window, default 30)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "billing-usage", 30, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const days = Number(request.nextUrl.searchParams.get("days")) || 30;

  const [usage, history, recentUsage, userRes] = await Promise.all([
    getUsageSummary(supabase, wallet),
    getUsageHistory(supabase, wallet, days),
    getRecentUsage(supabase, wallet),
    supabase
      .from("users")
      .select("daily_spend_cap_usdc, monthly_spend_cap_usdc")
      .eq("wallet_address", wallet)
      .single(),
  ]);

  return NextResponse.json({
    usage,
    caps: {
      daily_cap: Number(userRes.data?.daily_spend_cap_usdc) || 0.10,
      monthly_cap: Number(userRes.data?.monthly_spend_cap_usdc) || 2.00,
    },
    history,
    recent_usage: recentUsage,
  });
}
