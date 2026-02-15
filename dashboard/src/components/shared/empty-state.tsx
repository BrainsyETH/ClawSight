"use client";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type:
    | "no-agent"
    | "agent-offline"
    | "no-activity"
    | "no-skills"
    | "empty-wallet"
    | "api-error";
  lastSeen?: string;
  onAction?: () => void;
}

const STATES = {
  "no-agent": {
    title: "No agent connected",
    description:
      "Install the ClawSight plugin to connect to your OpenClaw instance.",
    action: "Install Plugin",
  },
  "agent-offline": {
    title: "Agent offline",
    description: "Your OpenClaw agent is not currently running.",
    action: "Troubleshoot",
  },
  "no-activity": {
    title: "No activity recorded",
    description: "No agent activity has been logged yet.",
    action: "Browse Skills",
  },
  "no-skills": {
    title: "No skills configured",
    description: "Install and configure skills to enable agent functionality.",
    action: "Browse Skills",
  },
  "empty-wallet": {
    title: "Wallet has insufficient funds",
    description: "Fund your wallet with USDC on Base L2 to enable agent operations.",
    action: "Fund Wallet",
  },
  "api-error": {
    title: "Connection error",
    description:
      "Unable to reach the ClawSight API. Showing cached data.",
    action: "Retry",
  },
};

export function EmptyState({ type, lastSeen, onAction }: EmptyStateProps) {
  const state = STATES[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {state.title}
      </h3>
      <p className="text-sm text-gray-500 max-w-md mb-1">
        {state.description}
      </p>
      {lastSeen && (
        <p className="text-xs text-gray-400 mb-4">Last seen: {lastSeen}</p>
      )}
      {onAction && (
        <Button onClick={onAction} className="mt-4">
          {state.action}
        </Button>
      )}
    </div>
  );
}
