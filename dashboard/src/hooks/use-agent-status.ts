"use client";

import { useState, useEffect } from "react";
import { AgentStatus } from "@/types";

interface AgentStatusState {
  status: AgentStatus;
  lastHeartbeat: string | null;
  sessionId: string | null;
  sessionStart: string | null;
  sessionDurationMs: number | null;
}

// In production, this subscribes to Supabase Realtime.
// For now, returns demo state.
export function useAgentStatus(_walletAddress?: string): AgentStatusState {
  const [state, setState] = useState<AgentStatusState>({
    status: "online",
    lastHeartbeat: new Date().toISOString(),
    sessionId: "sess_demo_001",
    sessionStart: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    sessionDurationMs: 4 * 60 * 60 * 1000,
  });

  // Simulate heartbeat updates
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        lastHeartbeat: new Date().toISOString(),
        sessionDurationMs: prev.sessionStart
          ? Date.now() - new Date(prev.sessionStart).getTime()
          : null,
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return state;
}
