"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AgentStatus, AgentStatusRow } from "@/types";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

interface AgentStatusState {
  status: AgentStatus;
  lastHeartbeat: string | null;
  sessionId: string | null;
  sessionStart: string | null;
  sessionDurationMs: number | null;
}

/**
 * Subscribe to real-time agent status updates via Supabase.
 * Falls back to "offline" if no status row exists.
 */
export function useAgentStatus(walletAddress?: string): AgentStatusState {
  const [state, setState] = useState<AgentStatusState>({
    status: "offline",
    lastHeartbeat: null,
    sessionId: null,
    sessionStart: null,
    sessionDurationMs: null,
  });

  useEffect(() => {
    if (!walletAddress) return;

    async function fetchStatus() {
      const { data } = await getSupabase()
        .from("agent_status")
        .select("*")
        .eq("wallet_address", walletAddress)
        .single();

      if (data) {
        applyStatusRow(data as AgentStatusRow);
      }
    }
    fetchStatus();

    const channel = getSupabase()
      .channel("agent_status_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_status",
          filter: `wallet_address=eq.${walletAddress}`,
        },
        (payload) => {
          applyStatusRow(payload.new as AgentStatusRow);
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [walletAddress]);

  // Update session duration every 30s while online
  useEffect(() => {
    if (state.status === "offline" || !state.sessionStart) return;

    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        sessionDurationMs: prev.sessionStart
          ? Date.now() - new Date(prev.sessionStart).getTime()
          : null,
      }));
    }, 30_000);

    return () => clearInterval(interval);
  }, [state.status, state.sessionStart]);

  function applyStatusRow(row: AgentStatusRow) {
    setState({
      status: row.status,
      lastHeartbeat: row.last_heartbeat,
      sessionId: row.session_id,
      sessionStart: row.session_start,
      sessionDurationMs: row.session_start
        ? Date.now() - new Date(row.session_start).getTime()
        : null,
    });
  }

  return state;
}
