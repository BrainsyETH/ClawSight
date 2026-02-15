"use client";

import { useMode } from "@/hooks/use-mode";
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
    fun: {
      title: "Hey there! I don't see an agent running.",
      description:
        "Install the ClawSight plugin so I can connect to your OpenClaw instance!",
      action: "Install Plugin",
    },
    professional: {
      title: "No agent connected",
      description:
        "Install the ClawSight plugin to connect to your OpenClaw instance.",
      action: "Install Plugin",
    },
    icon: "🔌",
    proIcon: "link",
  },
  "agent-offline": {
    fun: {
      title: "I seem to be sleeping...",
      description: "Your OpenClaw agent isn't running right now. Start it up and I'll be right back!",
      action: "How to Start",
    },
    professional: {
      title: "Agent offline",
      description: "Your OpenClaw agent is not currently running.",
      action: "Troubleshoot",
    },
    icon: "😴",
    proIcon: "power",
  },
  "no-activity": {
    fun: {
      title: "Nothing to show yet!",
      description:
        "I haven't done anything yet. Give me a task and watch the activity roll in!",
      action: "Learn a Skill",
    },
    professional: {
      title: "No activity recorded",
      description: "No agent activity has been logged yet.",
      action: "Browse Skills",
    },
    icon: "📭",
    proIcon: "inbox",
  },
  "no-skills": {
    fun: {
      title: "I don't know any skills yet!",
      description:
        "Teach me something new so I can start helping you. Check out the skill browser!",
      action: "Learn New Skills",
    },
    professional: {
      title: "No skills configured",
      description: "Install and configure skills to enable agent functionality.",
      action: "Browse Skills",
    },
    icon: "🎓",
    proIcon: "book",
  },
  "empty-wallet": {
    fun: {
      title: "My wallet's looking a bit empty!",
      description:
        "I need some USDC on Base to pay for services. Fund the wallet so I can get to work!",
      action: "Fund Wallet",
    },
    professional: {
      title: "Wallet has insufficient funds",
      description: "Fund your wallet with USDC on Base L2 to enable agent operations.",
      action: "Fund Wallet",
    },
    icon: "💰",
    proIcon: "wallet",
  },
  "api-error": {
    fun: {
      title: "Oops, I can't reach the server!",
      description:
        "Something went wrong connecting to ClawSight. I'll show you what I last knew.",
      action: "Retry",
    },
    professional: {
      title: "Connection error",
      description:
        "Unable to reach the ClawSight API. Showing cached data.",
      action: "Retry",
    },
    icon: "⚠️",
    proIcon: "alert-triangle",
  },
};

export function EmptyState({ type, lastSeen, onAction }: EmptyStateProps) {
  const { isFun } = useMode();
  const state = STATES[type];
  const content = isFun ? state.fun : state.professional;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {isFun && (
        <span className="text-5xl mb-4">{state.icon}</span>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {content.title}
      </h3>
      <p className="text-sm text-gray-500 max-w-md mb-1">
        {content.description}
      </p>
      {lastSeen && (
        <p className="text-xs text-gray-400 mb-4">Last seen: {lastSeen}</p>
      )}
      {onAction && (
        <Button onClick={onAction} className="mt-4">
          {content.action}
        </Button>
      )}
    </div>
  );
}
