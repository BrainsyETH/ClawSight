"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { useAgentStatus } from "@/hooks/use-agent-status";
import {
  useActivityEvents,
  useSkillConfigs,
} from "@/hooks/use-supabase-data";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { StatusIndicator } from "@/components/shared/status-indicator";
import { WalletCard } from "@/components/dashboard/wallet-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { MemoryViewer, getDemoMemories } from "@/components/dashboard/memory-viewer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ActivityEvent } from "@/types";

const SPENDING_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

/**
 * Derive spending breakdown from payment events.
 */
function deriveSpending(events: ActivityEvent[]) {
  const categoryTotals: Record<string, number> = {};
  let total = 0;

  for (const e of events) {
    if (e.event_type === "payment" && typeof e.event_data?.amount === "number") {
      const category = (e.event_data.service as string) || (e.skill_slug || "Other");
      categoryTotals[category] = (categoryTotals[category] || 0) + e.event_data.amount;
      total += e.event_data.amount;
    }
  }

  const categories = Object.entries(categoryTotals)
    .map(([label, amount], i) => ({
      label,
      amount,
      color: SPENDING_COLORS[i % SPENDING_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  return { categories, totalSpend: total };
}

export default function DashboardPage() {
  const { walletAddress } = useAuth();
  const { isFun, label, agentName } = useMode();
  const agentStatus = useAgentStatus(walletAddress ?? undefined);
  const { events, loading: eventsLoading, redactEvent, redactEventFields } = useActivityEvents(walletAddress ?? undefined);
  const { configs, loading: configsLoading } = useSkillConfigs(walletAddress ?? undefined);
  const demoMemories = getDemoMemories();

  const spending = useMemo(() => deriveSpending(events), [events]);

  // Derive stats from real data
  const activeSkills = configs.filter((c) => c.enabled);
  const pausedSkills = configs.filter((c) => !c.enabled);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter((e) => new Date(e.occurred_at) >= todayStart);
  const todayActions = todayEvents.filter((e) => e.event_type === "tool_call").length;
  const todayMessages = todayEvents.filter((e) => e.event_type === "message_sent").length;
  const todayErrors = todayEvents.filter((e) => e.event_type === "error").length;

  const loading = eventsLoading || configsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

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
          balance={0}
          todaySpending={spending.totalSpend}
          weekSpending={spending.totalSpend}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: label("Skills I Know", "Active Skills"), value: String(activeSkills.length), subtext: `${pausedSkills.length} paused` },
          { label: label("Things Done Today", "Actions Today"), value: String(todayActions), subtext: `${todayEvents.length} total events` },
          { label: label("Messages Sent", "Messages"), value: String(todayMessages), subtext: "today" },
          { label: label("Errors Caught", "Errors"), value: String(todayErrors), subtext: todayErrors === 0 ? "All clear!" : "Check activity" },
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
        categories={spending.categories}
        totalSpend={spending.totalSpend}
        period="today"
      />

      {/* Activity Feed */}
      <ActivityFeed
        events={events}
        onRedactEvent={redactEvent}
        onRedactFields={redactEventFields}
      />

      {/* Memory Viewer */}
      <MemoryViewer memories={demoMemories} />
    </div>
  );
}
