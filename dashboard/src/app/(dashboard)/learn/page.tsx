"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSkillConfigs } from "@/hooks/use-supabase-data";
import { SkillBrowser } from "@/components/skills/skill-browser";
import { Compass } from "lucide-react";
import { getDefaultConfig } from "@/lib/skill-forms";
import { SKILL_CATALOG } from "@/lib/skill-catalog";
import { SkillListing } from "@/types";

export default function LearnPage() {
  const { walletAddress } = useAuth();
  const { configs, saveConfig } = useSkillConfigs(walletAddress ?? undefined);
  const [installing, setInstalling] = useState<string | null>(null);
  const [remoteSkills, setRemoteSkills] = useState<SkillListing[] | null>(null);

  // Fetch skills from ClawHub registry (merged with local catalog on server)
  useEffect(() => {
    let cancelled = false;
    async function fetchSkills() {
      try {
        const res = await fetch("/v1/api/clawhub/skills");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.skills) {
          setRemoteSkills(data.skills);
        }
      } catch {
        // Fallback to local catalog (already set)
      }
    }
    fetchSkills();
    return () => { cancelled = true; };
  }, []);

  const catalog = remoteSkills || SKILL_CATALOG;

  // Derive installed slugs from real skill configs
  const installedSlugs = useMemo(
    () => configs.map((c) => c.skill_slug),
    [configs]
  );

  const handleInstall = async (slug: string) => {
    setInstalling(slug);
    try {
      // Create a new skill config entry with defaults
      const defaults = getDefaultConfig(slug) || {};
      await saveConfig(slug, defaults);
    } catch (err) {
      console.error("[learn] Install failed:", err);
    } finally {
      setInstalling(null);
    }
  };

  const totalSkills = catalog.length;
  const installedCount = installedSlugs.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Compass className="w-6 h-6" aria-hidden="true" />
          Skill Store
        </h1>
        <p className="text-gray-500 mt-1">
          {totalSkills} skills available
          {remoteSkills && (
            <span className="text-gray-400"> via ClawHub</span>
          )}
          {installedCount > 0 && (
            <span className="text-gray-400">
              {" "}&middot; {installedCount} installed
            </span>
          )}
        </p>
      </div>
      <SkillBrowser
        catalog={catalog}
        installedSlugs={installedSlugs}
        onInstall={handleInstall}
        installing={installing}
      />
    </div>
  );
}
