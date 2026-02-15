"use client";

import { useState } from "react";
import { SkillConfig } from "@/types";
import { useMode } from "@/hooks/use-mode";
import { SkillCard } from "@/components/skills/skill-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Zap, Plus } from "lucide-react";
import Link from "next/link";

// Demo data — replaced by Supabase queries in production
const DEMO_SKILLS: SkillConfig[] = [
  {
    id: "1",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "web_search",
    enabled: true,
    config: { provider: "google", max_results: 10, safe_search: true },
    config_source: "clawsight",
    config_schema_version: 1,
    sync_status: "applied",
    sync_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "slack",
    enabled: true,
    config: { default_channel: "#general", respond_to_mentions: true },
    config_source: "clawsight",
    config_schema_version: 1,
    sync_status: "applied",
    sync_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "github",
    enabled: true,
    config: { default_owner: "openclaw", auto_review: false },
    config_source: "manual",
    config_schema_version: 1,
    sync_status: "applied",
    sync_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "4",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "crypto_trading",
    enabled: true,
    config: { exchange: "polymarket", max_trade_size: 25, daily_budget: 50 },
    config_source: "clawsight",
    config_schema_version: 1,
    sync_status: "syncing",
    sync_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "5",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "memory",
    enabled: true,
    config: { auto_save: true, max_results: 5 },
    config_source: "default",
    config_schema_version: 1,
    sync_status: "applied",
    sync_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "6",
    wallet_address: "0x1a2b3c4d",
    skill_slug: "pdf",
    enabled: false,
    config: {},
    config_source: "default",
    config_schema_version: 1,
    sync_status: "applied",
    sync_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function SkillsPage() {
  const { label } = useMode();
  const [skills, setSkills] = useState(DEMO_SKILLS);

  const enabledSkills = skills.filter((s) => s.enabled);
  const disabledSkills = skills.filter((s) => !s.enabled);

  const handleToggle = (slug: string, enabled: boolean) => {
    setSkills((prev) =>
      prev.map((s) =>
        s.skill_slug === slug
          ? { ...s, enabled, sync_status: "syncing" as const }
          : s
      )
    );
    // Simulate sync completion
    setTimeout(() => {
      setSkills((prev) =>
        prev.map((s) =>
          s.skill_slug === slug ? { ...s, sync_status: "applied" as const } : s
        )
      );
    }, 1500);
  };

  if (skills.length === 0) {
    return <EmptyState type="no-skills" onAction={() => {}} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6" />
            {label("What I Know", "My Skills")}
          </h1>
          <p className="text-gray-500 mt-1">
            {label(
              `I know ${skills.length} skills! Toggle them on and off, or customize how I use them.`,
              `${skills.length} skills configured. Manage toggles and settings.`
            )}
          </p>
        </div>
        <Link href="/learn">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {label("Learn More", "Add Skill")}
          </Button>
        </Link>
      </div>

      {/* Active skills */}
      {enabledSkills.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {label("Things I'm Doing", "Active")} ({enabledSkills.length})
          </h2>
          <div className="space-y-3">
            {enabledSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paused skills */}
      {disabledSkills.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {label("Things I've Paused", "Inactive")} ({disabledSkills.length})
          </h2>
          <div className="space-y-3">
            {disabledSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
