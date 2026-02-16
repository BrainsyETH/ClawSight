import { SupabaseClient } from "@supabase/supabase-js";
import { UsageOperation } from "@/types";

// ============================================================
// Cost table: USDC cost per operation.
// Heartbeats and reads are free. Everything else is metered.
// ============================================================
const OPERATION_COSTS: Record<UsageOperation, number> = {
  api_call:       0.0001,   // $0.0001 per generic API call
  config_write:   0.001,    // $0.001  per config save
  config_read:    0,        // Free
  sync:           0.0005,   // $0.0005 per event batch sync
  heartbeat:      0,        // Free
  export:         0.01,     // $0.01   per data export
  compute_minute: 0.0005,   // $0.0005 per minute of Fly.io compute
  skill_install:  0,        // Free
  x402_payment:   0,        // Pass-through (cost recorded from actual payment amount)
};

export function getOperationCost(op: UsageOperation): number {
  return OPERATION_COSTS[op] ?? 0;
}

/**
 * Check whether a wallet has exceeded their daily or monthly spending cap.
 * Caps are set per-user in the users table.
 */
export async function checkSpendingCaps(
  supabase: SupabaseClient,
  wallet: string
): Promise<{ allowed: boolean; reason?: string; daily_spend?: number; monthly_spend?: number; daily_cap?: number; monthly_cap?: number }> {
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
  if (!user) return { allowed: true };

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
      daily_cap: dailyCap,
      monthly_cap: monthlyCap,
    };
  }

  if (monthlySpend >= monthlyCap) {
    return {
      allowed: false,
      reason: `Monthly spending cap reached ($${monthlySpend.toFixed(4)} / $${monthlyCap.toFixed(2)})`,
      daily_spend: dailySpend,
      monthly_spend: monthlySpend,
      daily_cap: dailyCap,
      monthly_cap: monthlyCap,
    };
  }

  return { allowed: true, daily_spend: dailySpend, monthly_spend: monthlySpend, daily_cap: dailyCap, monthly_cap: monthlyCap };
}

/**
 * Record a billable operation in the usage ledger.
 * Atomically increments the daily rollup via RPC.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  wallet: string,
  operation: UsageOperation,
  opts?: { cost_override?: number; skill_slug?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const cost = opts?.cost_override ?? getOperationCost(operation);

  await supabase.from("usage_ledger").insert({
    wallet_address: wallet,
    operation,
    cost_usdc: cost,
    skill_slug: opts?.skill_slug || null,
    metadata: opts?.metadata || {},
  });

  // Atomic increment of daily summary
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

/**
 * Get daily usage history for the last N days (for charts).
 */
export async function getUsageHistory(
  supabase: SupabaseClient,
  wallet: string,
  days: number = 30
): Promise<{ day: string; cost: number; calls: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("usage_daily_summary")
    .select("day, total_cost_usdc, api_calls")
    .eq("wallet_address", wallet)
    .gte("day", since.toISOString().split("T")[0])
    .order("day", { ascending: true });

  return (data || []).map((r) => ({
    day: r.day,
    cost: Number(r.total_cost_usdc),
    calls: r.api_calls,
  }));
}

/**
 * Get recent ledger entries (for activity log).
 */
export async function getRecentUsage(
  supabase: SupabaseClient,
  wallet: string,
  limit: number = 50
) {
  const { data } = await supabase
    .from("usage_ledger")
    .select("*")
    .eq("wallet_address", wallet)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return data || [];
}
