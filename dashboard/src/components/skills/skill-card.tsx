"use client";

import { SkillConfig } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncBadge } from "@/components/shared/sync-badge";
import { getSkillForm } from "@/lib/skill-forms";
import { Settings } from "lucide-react";
import Link from "next/link";

interface SkillCardProps {
  skill: SkillConfig;
  onToggle: (slug: string, enabled: boolean) => void;
}

export function SkillCard({ skill, onToggle }: SkillCardProps) {
  const form = getSkillForm(skill.skill_slug);
  const name = form?.name || skill.skill_slug;
  const description = form?.description || `${skill.skill_slug} skill`;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-gray-900">{name}</h3>
              {form && (
                <Badge variant="outline" className="text-xs">
                  ClawSight
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-2 line-clamp-2">
              {description}
            </p>
            <div className="flex items-center gap-2">
              <SyncBadge
                status={skill.sync_status}
                error={skill.sync_error}
              />
              <Badge variant="secondary" className="text-xs capitalize">
                {skill.config_source}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <Link
              href={`/skills/${skill.skill_slug}`}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              role="switch"
              aria-checked={skill.enabled}
              onClick={() => onToggle(skill.skill_slug, !skill.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                skill.enabled ? "bg-red-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  skill.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
