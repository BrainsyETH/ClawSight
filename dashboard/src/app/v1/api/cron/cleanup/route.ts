import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server/supabase";

const CRON_SECRET = process.env.CRON_SECRET;
const FLY_API_URL = "https://api.machines.dev/v1";
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;

/**
 * GET /v1/api/cron/cleanup
 *
 * Daily cron endpoint. Handles:
 *   1. Data retention cleanup
 *   2. Stale agent detection
 *   3. Budget exhaustion auto-stop (stops Fly machines for users over cap)
 *
 * vercel.json:
 *   { "crons": [{ "path": "/v1/api/cron/cleanup", "schedule": "0 3 * * *" }] }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const results = {
      events_cleaned: false,
      stale_agents_marked: 0,
      agents_stopped: 0,
      errors: [] as string[],
    };

    // 1. Data retention cleanup
    const { error: cleanupErr } = await supabase.rpc("cleanup_old_events");
    if (cleanupErr) {
      console.error("[cron/cleanup] RPC error:", cleanupErr);
      results.errors.push("cleanup_old_events RPC failed");
    } else {
      results.events_cleaned = true;
    }

    // 2. Mark stale agents as offline (no heartbeat in 24h)
    const staleThreshold = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: staleAgents } = await supabase
      .from("agent_status")
      .update({ status: "offline", session_id: null })
      .lt("last_heartbeat", staleThreshold)
      .neq("status", "offline")
      .select("wallet_address");

    results.stale_agents_marked = staleAgents?.length || 0;

    // 3. Auto-stop agents for users who have exceeded their monthly cap
    await autoStopOverBudgetAgents(supabase, results);

    return NextResponse.json({
      message: "Cleanup completed",
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (err) {
    console.error("[cron/cleanup] Error:", err);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}

/**
 * Stop Fly.io machines for users who have exceeded their monthly spending cap
 * or whose subscription has lapsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoStopOverBudgetAgents(supabase: any, results: { agents_stopped: number; errors: string[] }) {
  // Fetch all running agents
  const { data: runningAgents } = await supabase
    .from("agent_registry")
    .select("wallet_address, fly_app_name, fly_machine_id")
    .eq("status", "running");

  if (!runningAgents || runningAgents.length === 0) return;

  for (const agent of runningAgents) {
    const { wallet_address, fly_app_name, fly_machine_id } = agent;

    // Check subscription status
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, plan_id")
      .eq("wallet_address", wallet_address)
      .single();

    let shouldStop = false;
    let reason = "";

    // Stop if subscription canceled or past_due for > 3 days
    if (sub?.status === "canceled") {
      shouldStop = true;
      reason = "subscription_canceled";
    } else if (sub?.status === "past_due") {
      // Give 3 days grace period
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("current_period_end")
        .eq("wallet_address", wallet_address)
        .single();

      if (subRow) {
        const periodEnd = new Date(subRow.current_period_end);
        const gracePeriod = new Date(periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
        if (new Date() > gracePeriod) {
          shouldStop = true;
          reason = "past_due_grace_expired";
        }
      }
    }

    // Check monthly spending cap
    if (!shouldStop) {
      const [userRes, monthlyRes] = await Promise.all([
        supabase
          .from("users")
          .select("monthly_spend_cap_usdc")
          .eq("wallet_address", wallet_address)
          .single(),
        supabase.rpc("get_monthly_spend", { p_wallet: wallet_address }),
      ]);

      const monthlyCap = Number(userRes.data?.monthly_spend_cap_usdc) || 2.00;
      const monthlySpend = Number(monthlyRes.data) || 0;

      if (monthlySpend >= monthlyCap * 1.1) {
        // 10% buffer before hard stop
        shouldStop = true;
        reason = "monthly_cap_exceeded";
      }
    }

    // Free plan users shouldn't have running agents (they don't have cloud agent access)
    if (!shouldStop && sub?.plan_id === "free") {
      shouldStop = true;
      reason = "free_plan_no_cloud_agent";
    }

    if (shouldStop) {
      console.log(`[cron] Stopping agent for ${wallet_address}: ${reason}`);

      // Stop the Fly machine
      if (FLY_API_TOKEN) {
        try {
          await fetch(
            `${FLY_API_URL}/apps/${fly_app_name}/machines/${fly_machine_id}/stop`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
            }
          );
        } catch (err) {
          console.error(`[cron] Failed to stop Fly machine ${fly_machine_id}:`, err);
          results.errors.push(`Failed to stop ${fly_machine_id}`);
        }
      }

      // Update DB status
      await supabase
        .from("agent_registry")
        .update({ status: "stopped" })
        .eq("wallet_address", wallet_address);

      await supabase
        .from("agent_status")
        .update({ status: "offline" })
        .eq("wallet_address", wallet_address);

      // Log event
      await supabase.from("activity_events").insert({
        wallet_address,
        event_type: "status_change",
        event_data: {
          action: "agent_auto_stopped",
          reason,
        },
        occurred_at: new Date().toISOString(),
      });

      results.agents_stopped++;
    }
  }
}
