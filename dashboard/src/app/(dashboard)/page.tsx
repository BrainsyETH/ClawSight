"use client";

import { useState } from "react";
import { useMode } from "@/hooks/use-mode";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { StatusIndicator } from "@/components/shared/status-indicator";
import { WalletCard } from "@/components/dashboard/wallet-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { SpendingChart, getDemoSpendingData } from "@/components/dashboard/spending-chart";
import { MemoryViewer, getDemoMemories } from "@/components/dashboard/memory-viewer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ActivityEvent } from "@/types";

// Demo data — replaced by Supabase queries in production
const DEMO_EVENTS: ActivityEvent[] = [
  {
    id: "1",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "web_search",
    session_id: "sess_001",
    event_type: "tool_call",
    event_data: { tool: "web_search", query: "USGS water levels Current River", duration_ms: 423 },
    occurred_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "slack",
    session_id: "sess_001",
    event_type: "message_sent",
    event_data: { platform: "Slack", preview: "Here's the water level data you asked for..." },
    occurred_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    wallet_address: "0x1a2b3c4d",
    skill_slug: null,
    session_id: "sess_001",
    event_type: "payment",
    event_data: { amount: 0.003, service: "ClawRouter", model: "claude-sonnet-4" },
    occurred_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "4",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "crypto_trading",
    session_id: "sess_001",
    event_type: "tool_call",
    event_data: { tool: "polymarket_trade", query: "Copy trade: $12.40 on Politics/Election", duration_ms: 890 },
    occurred_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "5",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "github",
    session_id: "sess_001",
    event_type: "tool_call",
    event_data: { tool: "github_pr_review", query: "Reviewed PR #142 on openclaw/gateway", duration_ms: 2340 },
    occurred_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "6",
    wallet_address: "0x1a2b3c4d",
    skill_slug: null,
    session_id: "sess_001",
    event_type: "error",
    event_data: { message: "Rate limit exceeded on Weather API (429)" },
    occurred_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
];

export default function DashboardPage() {
  const { isFun, label, agentName } = useMode();
  const agentStatus = useAgentStatus();
  const [spendingPeriod, setSpendingPeriod] = useState<"today" | "week" | "month">("today");
  const demoSpending = getDemoSpendingData();
  const demoMemories = getDemoMemories();

  return (
    <div className="space-y-6">
      {/* Agent greeting / header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isFun && <AgentAvatar size="lg" />}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isFun
                ? `Hi! I'm ${agentName}.`
                : "Dashboard"}
            </h1>
            <p className="text-gray-500 mt-1">
              {isFun
                ? "Here's what I've been up to today!"
                : "Agent overview and recent activity"}
            </p>
          </div>
        </div>
      </div>

      {/* Status + Wallet row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {label("How I'm Doing", "Status")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusIndicator
              status={agentStatus.status}
              lastHeartbeat={agentStatus.lastHeartbeat}
              sessionDurationMs={agentStatus.sessionDurationMs}
            />
          </CardContent>
        </Card>
        <WalletCard
          balance={12.47}
          todaySpending={0.23}
          weekSpending={1.87}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: label("Skills I Know", "Active Skills"), value: "6", subtext: "2 paused" },
          { label: label("Things Done Today", "Actions Today"), value: "47", subtext: "+12 from yesterday" },
          { label: label("Messages Sent", "Messages"), value: "8", subtext: "Slack, Discord" },
          { label: label("Errors Caught", "Errors"), value: "1", subtext: "Rate limit (resolved)" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stat.value}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.subtext}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Spending breakdown */}
      <SpendingChart
        categories={demoSpending.categories}
        totalSpend={demoSpending.totalSpend}
        period={spendingPeriod}
      />

      {/* Activity Feed */}
      <ActivityFeed events={DEMO_EVENTS} />

      {/* Memory Viewer */}
      <MemoryViewer memories={demoMemories} />
    </div>
  );
}
