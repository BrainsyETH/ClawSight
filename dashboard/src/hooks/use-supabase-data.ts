"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { SkillConfig, ActivityEvent, AgentStatusRow, User } from "@/types";

const supabase = createClient();

// ============================================================
// User profile
// ============================================================

export function useUser(walletAddress?: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    async function fetch() {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", walletAddress)
        .single();
      setUser(data);
      setLoading(false);
    }
    fetch();
  }, [walletAddress]);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!walletAddress) return;
      const { data } = await supabase
        .from("users")
        .update(updates)
        .eq("wallet_address", walletAddress)
        .select()
        .single();
      if (data) setUser(data);
    },
    [walletAddress]
  );

  return { user, loading, updateUser };
}

// ============================================================
// Skill configs with real-time updates
// ============================================================

export function useSkillConfigs(walletAddress?: string) {
  const [configs, setConfigs] = useState<SkillConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    // Initial fetch
    async function fetch() {
      const { data } = await supabase
        .from("skill_configs")
        .select("*")
        .eq("wallet_address", walletAddress)
        .order("created_at");
      setConfigs(data || []);
      setLoading(false);
    }
    fetch();

    // Real-time subscription for config changes
    const channel = supabase
      .channel("skill_configs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "skill_configs",
          filter: `wallet_address=eq.${walletAddress}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setConfigs((prev) => [...prev, payload.new as SkillConfig]);
          } else if (payload.eventType === "UPDATE") {
            setConfigs((prev) =>
              prev.map((c) =>
                c.id === (payload.new as SkillConfig).id
                  ? (payload.new as SkillConfig)
                  : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            setConfigs((prev) =>
              prev.filter((c) => c.id !== (payload.old as SkillConfig).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletAddress]);

  const toggleSkill = useCallback(
    async (skillSlug: string, enabled: boolean) => {
      if (!walletAddress) return;

      // Optimistic update
      setConfigs((prev) =>
        prev.map((c) =>
          c.skill_slug === skillSlug
            ? { ...c, enabled, sync_status: "syncing" as const }
            : c
        )
      );

      const res = await window.fetch("/v1/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_slug: skillSlug,
          enabled,
          config_source: "clawsight",
        }),
      });

      if (!res.ok) {
        // Revert on failure
        setConfigs((prev) =>
          prev.map((c) =>
            c.skill_slug === skillSlug
              ? { ...c, enabled: !enabled, sync_status: "failed" as const }
              : c
          )
        );
      }
    },
    [walletAddress]
  );

  const saveConfig = useCallback(
    async (
      skillSlug: string,
      config: Record<string, unknown>,
      expectedUpdatedAt?: string
    ) => {
      const res = await window.fetch("/v1/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_slug: skillSlug,
          config,
          config_source: "clawsight",
          expected_updated_at: expectedUpdatedAt,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save config");
      }

      return res.json();
    },
    []
  );

  return { configs, loading, toggleSkill, saveConfig };
}

// ============================================================
// Activity events with real-time updates
// ============================================================

export function useActivityEvents(walletAddress?: string) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    async function fetch() {
      const { data } = await supabase
        .from("activity_events")
        .select("*", { count: "exact" })
        .eq("wallet_address", walletAddress)
        .order("occurred_at", { ascending: false })
        .limit(50);
      setEvents(data || []);
      setTotal(data?.length || 0);
      setLoading(false);
    }
    fetch();

    // Real-time: new events
    const channel = supabase
      .channel("activity_events_new")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
          filter: `wallet_address=eq.${walletAddress}`,
        },
        (payload) => {
          setEvents((prev) => [payload.new as ActivityEvent, ...prev].slice(0, 200));
          setTotal((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletAddress]);

  const redactEvent = useCallback(async (eventId: string) => {
    const res = await window.fetch(`/v1/api/events/${eventId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setTotal((prev) => prev - 1);
    }
  }, []);

  const redactEventFields = useCallback(
    async (eventId: string, fields: string[]) => {
      const res = await window.fetch(`/v1/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redact_fields: fields }),
      });
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) => {
            if (e.id !== eventId) return e;
            const redacted = { ...e.event_data };
            for (const f of fields) {
              if (f in redacted) redacted[f] = "[redacted]";
            }
            return { ...e, event_data: redacted };
          })
        );
      }
    },
    []
  );

  return { events, loading, total, redactEvent, redactEventFields };
}

// ============================================================
// Agent status with real-time updates
// ============================================================

export function useRealtimeAgentStatus(walletAddress?: string) {
  const [status, setStatus] = useState<AgentStatusRow | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    async function fetch() {
      const { data } = await supabase
        .from("agent_status")
        .select("*")
        .eq("wallet_address", walletAddress)
        .single();
      setStatus(data);
    }
    fetch();

    const channel = supabase
      .channel("agent_status_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_status",
          filter: `wallet_address=eq.${walletAddress}`,
        },
        (payload) => {
          setStatus(payload.new as AgentStatusRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletAddress]);

  return status;
}
