"use client";

import { AgentStatus } from "@/types";
import { cn, getStatusColor, timeAgo, formatDuration } from "@/lib/utils";

interface StatusIndicatorProps {
  status: AgentStatus;
  lastHeartbeat: string | null;
  sessionDurationMs: number | null;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  online: "Online",
  thinking: "Processing",
  idle: "Idle",
  offline: "Offline",
};

export function StatusIndicator({
  status,
  lastHeartbeat,
  sessionDurationMs,
}: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-3 h-3 rounded-full", getStatusColor(status))} />
      <div>
        <p className="text-sm font-medium text-gray-900">{STATUS_LABELS[status]}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {lastHeartbeat && <span>Last seen {timeAgo(lastHeartbeat)}</span>}
          {sessionDurationMs && (
            <>
              <span>&middot;</span>
              <span>Session: {formatDuration(sessionDurationMs)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
