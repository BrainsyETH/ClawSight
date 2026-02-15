"use client";

import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { useSkillConfigs } from "@/hooks/use-supabase-data";
import { SkillCard } from "@/components/skills/skill-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SkillsPage() {
  const { walletAddress } = useAuth();
  const { label } = useMode();
  const { configs: skills, loading, toggleSkill } = useSkillConfigs(walletAddress ?? undefined);

  const enabledSkills = skills.filter((s) => s.enabled);
  const disabledSkills = skills.filter((s) => !s.enabled);

  const handleToggle = (slug: string, enabled: boolean) => {
    toggleSkill(slug, enabled);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

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
