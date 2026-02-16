import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";
import { getUsageSummary } from "@/lib/server/billing";

/**
 * GET /v1/api/billing/usage
 *
 * Returns current usage summary (daily/monthly spend, API calls)
 * plus subscription details and plan limits.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "billing-usage", 30, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Usage summary
  const usage = await getUsageSummary(supabase, wallet);

  // User caps
  const { data: user } = await supabase
    .from("users")
    .select("daily_spend_cap_usdc, monthly_spend_cap_usdc")
    .eq("wallet_address", wallet)
    .single();

  // Subscription + plan
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, billing_plans(*)")
    .eq("wallet_address", wallet)
    .single();

  // Recent usage entries (last 50)
  const { data: recentUsage } = await supabase
    .from("usage_ledger")
    .select("*")
    .eq("wallet_address", wallet)
    .order("occurred_at", { ascending: false })
    .limit(50);

  // Invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("wallet_address", wallet)
    .order("period_start", { ascending: false })
    .limit(12);

  return NextResponse.json({
    usage,
    caps: {
      daily_cap: Number(user?.daily_spend_cap_usdc) || 0.10,
      monthly_cap: Number(user?.monthly_spend_cap_usdc) || 2.00,
    },
    subscription: sub
      ? {
          plan_id: sub.plan_id,
          status: sub.status,
          payment_method: sub.payment_method,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plan: (sub as any).billing_plans || null,
        }
      : { plan_id: "free", status: "active", payment_method: "free", plan: null },
    recent_usage: recentUsage || [],
    invoices: invoices || [],
  });
}
