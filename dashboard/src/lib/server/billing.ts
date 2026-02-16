import { SupabaseClient } from "@supabase/supabase-js";
import { UsageOperation } from "@/types";

// ============================================================
// Cost table: USDC cost per operation.
// Free operations have cost 0. Heartbeats are free per REVIEW_MVP.md.
// ============================================================
const OPERATION_COSTS: Record<UsageOperation, number> = {
  api_call:       0.0001,   // $0.0001 per generic API call
  config_write:   0.001,    // $0.001  per config save
  config_read:    0,        // Free
  sync:           0.0005,   // $0.0005 per event batch sync
  heartbeat:      0,        // Free (per review recommendation)
  export:         0.01,     // $0.01   per data export
  compute_minute: 0.0005,   // $0.0005 per minute of Fly.io compute
  skill_install:  0,        // Free
  x402_payment:   0,        // Pass-through (cost recorded from payment amount)
};

export function getOperationCost(op: UsageOperation): number {
  return OPERATION_COSTS[op] ?? 0;
}

/**
 * Check whether a wallet has exceeded their daily or monthly spending cap.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function checkSpendingCaps(
  supabase: SupabaseClient,
  wallet: string
): Promise<{ allowed: boolean; reason?: string; daily_spend?: number; monthly_spend?: number }> {
  // Fetch user caps and current spend in parallel
  const [userRes, dailyRes, monthlyRes] = await Promise.all([
    supabase
      .from("users")
      .select("daily_spend_cap_usdc, monthly_spend_cap_usdc")
      .eq("wallet_address", wallet)
      .single(),
    supabase.rpc("get_daily_spend", { p_wallet: wallet }),
    supabase.rpc("get_monthly_spend", { p_wallet: wallet }),
  ]);

  const user = userRes.data;
  if (!user) return { allowed: true }; // No user = no caps to check

  const dailySpend = Number(dailyRes.data) || 0;
  const monthlySpend = Number(monthlyRes.data) || 0;
  const dailyCap = Number(user.daily_spend_cap_usdc);
  const monthlyCap = Number(user.monthly_spend_cap_usdc);

  if (dailySpend >= dailyCap) {
    return {
      allowed: false,
      reason: `Daily spending cap reached ($${dailySpend.toFixed(4)} / $${dailyCap.toFixed(2)})`,
      daily_spend: dailySpend,
      monthly_spend: monthlySpend,
    };
  }

  if (monthlySpend >= monthlyCap) {
    return {
      allowed: false,
      reason: `Monthly spending cap reached ($${monthlySpend.toFixed(4)} / $${monthlyCap.toFixed(2)})`,
      daily_spend: dailySpend,
      monthly_spend: monthlySpend,
    };
  }

  return { allowed: true, daily_spend: dailySpend, monthly_spend: monthlySpend };
}

/**
 * Check plan-level API call limits.
 */
export async function checkPlanLimits(
  supabase: SupabaseClient,
  wallet: string
): Promise<{ allowed: boolean; reason?: string; plan_id?: string }> {
  // Fetch subscription + plan limits
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status, billing_plans(*)")
    .eq("wallet_address", wallet)
    .single();

  if (!sub || sub.status === "canceled") {
    // Default to free plan limits
    return checkFreePlanLimits(supabase, wallet);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = (sub as any).billing_plans;
  if (!plan) return { allowed: true, plan_id: sub.plan_id };

  // Check daily API calls
  const { data: dailyData } = await supabase
    .from("usage_daily_summary")
    .select("api_calls")
    .eq("wallet_address", wallet)
    .eq("day", new Date().toISOString().split("T")[0])
    .single();

  const dailyCalls = dailyData?.api_calls || 0;
  if (dailyCalls >= plan.daily_api_calls) {
    return {
      allowed: false,
      reason: `Daily API call limit reached (${dailyCalls}/${plan.daily_api_calls}). Upgrade your plan for higher limits.`,
      plan_id: sub.plan_id,
    };
  }

  return { allowed: true, plan_id: sub.plan_id };
}

async function checkFreePlanLimits(
  supabase: SupabaseClient,
  wallet: string
): Promise<{ allowed: boolean; reason?: string; plan_id: string }> {
  const { data: dailyData } = await supabase
    .from("usage_daily_summary")
    .select("api_calls")
    .eq("wallet_address", wallet)
    .eq("day", new Date().toISOString().split("T")[0])
    .single();

  const dailyCalls = dailyData?.api_calls || 0;
  if (dailyCalls >= 100) {
    return {
      allowed: false,
      reason: `Free plan daily limit reached (${dailyCalls}/100). Upgrade to Starter for 1,000 daily calls.`,
      plan_id: "free",
    };
  }

  return { allowed: true, plan_id: "free" };
}

/**
 * Record a billable operation in the usage ledger.
 * Updates the daily summary atomically via RPC.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  wallet: string,
  operation: UsageOperation,
  opts?: { cost_override?: number; skill_slug?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const cost = opts?.cost_override ?? getOperationCost(operation);

  // Insert to usage_ledger
  await supabase.from("usage_ledger").insert({
    wallet_address: wallet,
    operation,
    cost_usdc: cost,
    skill_slug: opts?.skill_slug || null,
    metadata: opts?.metadata || {},
  });

  // Update daily summary via RPC (atomic increment)
  if (cost > 0 || operation === "api_call") {
    await supabase.rpc("increment_daily_usage", {
      p_wallet: wallet,
      p_cost: cost,
      p_calls: 1,
    });
  }
}

/**
 * Get current usage summary for display.
 */
export async function getUsageSummary(
  supabase: SupabaseClient,
  wallet: string
): Promise<{
  daily_spend: number;
  monthly_spend: number;
  daily_calls: number;
  monthly_calls: number;
}> {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const [dailyRes, monthlyRes] = await Promise.all([
    supabase
      .from("usage_daily_summary")
      .select("total_cost_usdc, api_calls")
      .eq("wallet_address", wallet)
      .eq("day", today)
      .single(),
    supabase
      .from("usage_daily_summary")
      .select("total_cost_usdc, api_calls")
      .eq("wallet_address", wallet)
      .gte("day", monthStartStr),
  ]);

  const daily = dailyRes.data;
  const monthlyRows = monthlyRes.data || [];

  return {
    daily_spend: Number(daily?.total_cost_usdc) || 0,
    daily_calls: daily?.api_calls || 0,
    monthly_spend: monthlyRows.reduce((sum, r) => sum + Number(r.total_cost_usdc), 0),
    monthly_calls: monthlyRows.reduce((sum, r) => sum + r.api_calls, 0),
  };
}
