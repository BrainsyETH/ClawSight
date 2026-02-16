"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUSDC } from "@/lib/utils";
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Loader2,
  BarChart3,
  Clock,
  Activity,
} from "lucide-react";
import { UsageLedgerEntry } from "@/types";

interface UsageResponse {
  usage: {
    daily_spend: number;
    monthly_spend: number;
    daily_calls: number;
    monthly_calls: number;
  };
  caps: {
    daily_cap: number;
    monthly_cap: number;
  };
  history: { day: string; cost: number; calls: number }[];
  recent_usage: UsageLedgerEntry[];
}

const OP_LABELS: Record<string, string> = {
  api_call: "API Call",
  config_write: "Config Write",
  config_read: "Config Read",
  sync: "Event Sync",
  heartbeat: "Heartbeat",
  export: "Data Export",
  compute_minute: "Compute",
  skill_install: "Skill Install",
  x402_payment: "x402 Payment",
};

export default function BillingPage() {
  const { walletAddress } = useAuth();
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) return;
    fetch("/v1/api/billing/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const usage = data?.usage;
  const caps = data?.caps;
  const history = data?.history || [];
  const recentUsage = data?.recent_usage || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          Usage & Spending
        </h1>
        <p className="text-gray-500 mt-1">
          Monitor your agent&apos;s x402 micropayment usage and spending caps.
        </p>
      </div>

      {/* Spending meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Daily Spending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UsageMeter
              label="USDC spent today"
              current={usage?.daily_spend || 0}
              max={caps?.daily_cap || 0.10}
              format="usdc"
            />
            <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
              <span>{usage?.daily_calls || 0} API calls</span>
              <span>Cap: {formatUSDC(caps?.daily_cap || 0.10)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UsageMeter
              label="USDC spent this month"
              current={usage?.monthly_spend || 0}
              max={caps?.monthly_cap || 2.00}
              format="usdc"
            />
            <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
              <span>{usage?.monthly_calls || 0} API calls</span>
              <span>Cap: {formatUSDC(caps?.monthly_cap || 2.00)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 30-day spending chart */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart history={history} dailyCap={caps?.daily_cap || 0.10} />
          </CardContent>
        </Card>
      )}

      {/* Recent usage ledger */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Operations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentUsage.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No usage recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {recentUsage.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {OP_LABELS[entry.operation] || entry.operation}
                    </Badge>
                    {entry.skill_slug && (
                      <span className="text-xs text-gray-500 truncate">
                        {entry.skill_slug}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-mono ${Number(entry.cost_usdc) > 0 ? "text-gray-900" : "text-gray-400"}`}>
                      {Number(entry.cost_usdc) > 0
                        ? `-${formatUSDC(Number(entry.cost_usdc))}`
                        : "free"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatRelativeTime(entry.occurred_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Operation Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { op: "Event Sync", cost: "$0.0005" },
              { op: "Config Write", cost: "$0.001" },
              { op: "Data Export", cost: "$0.01" },
              { op: "API Call", cost: "$0.0001" },
              { op: "Compute (min)", cost: "$0.0005" },
              { op: "Heartbeat", cost: "Free" },
              { op: "Config Read", cost: "Free" },
              { op: "Skill Install", cost: "Free" },
            ].map((item) => (
              <div key={item.op} className="flex justify-between py-1 px-2 rounded bg-gray-50">
                <span className="text-gray-600">{item.op}</span>
                <span className={`font-mono ${item.cost === "Free" ? "text-green-600" : "text-gray-900"}`}>
                  {item.cost}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────

function UsageMeter({
  label,
  current,
  max,
  format,
}: {
  label: string;
  current: number;
  max: number;
  format: "usdc" | "number";
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-gray-900"}`}>
          {format === "usdc" ? formatUSDC(current) : current.toLocaleString()}
          <span className="text-gray-400 font-normal">
            {" / "}
            {format === "usdc" ? formatUSDC(max) : max.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isDanger ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-green-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isDanger && (
        <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Approaching limit — agent will be paused when cap is reached
        </p>
      )}
    </div>
  );
}

function SpendingChart({
  history,
  dailyCap,
}: {
  history: { day: string; cost: number; calls: number }[];
  dailyCap: number;
}) {
  const maxCost = useMemo(
    () => Math.max(dailyCap, ...history.map((d) => d.cost)),
    [history, dailyCap]
  );

  return (
    <div>
      <div className="flex items-end gap-[2px] h-32">
        {history.map((d) => {
          const heightPct = maxCost > 0 ? (d.cost / maxCost) * 100 : 0;
          const capPct = maxCost > 0 ? (dailyCap / maxCost) * 100 : 0;
          const overCap = d.cost >= dailyCap;
          return (
            <div key={d.day} className="flex-1 relative group" title={`${d.day}: ${formatUSDC(d.cost)} (${d.calls} calls)`}>
              <div
                className={`w-full rounded-t transition-colors ${
                  overCap ? "bg-red-400 hover:bg-red-500" : "bg-green-400 hover:bg-green-500"
                }`}
                style={{ height: `${Math.max(heightPct, 1)}%` }}
              />
              {/* Cap line */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400 pointer-events-none"
                style={{ bottom: `${capPct}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow">
                {formatUSDC(d.cost)} &middot; {d.calls} calls
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>{history.length > 0 ? formatDate(history[0].day) : ""}</span>
        <span className="text-amber-500">--- daily cap ({formatUSDC(dailyCap)})</span>
        <span>{history.length > 0 ? formatDate(history[history.length - 1].day) : ""}</span>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
