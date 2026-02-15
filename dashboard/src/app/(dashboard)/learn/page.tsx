"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { useSkillConfigs } from "@/hooks/use-supabase-data";
import { SkillBrowser } from "@/components/skills/skill-browser";
import { Compass } from "lucide-react";
import { getDefaultConfig } from "@/lib/skill-forms";

export default function LearnPage() {
  const { walletAddress } = useAuth();
  const { label } = useMode();
  const { configs, saveConfig } = useSkillConfigs(walletAddress ?? undefined);
  const [installing, setInstalling] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Compass className="w-6 h-6" />
          {label("Teach Me Something New!", "Browse Skills")}
        </h1>
        <p className="text-gray-500 mt-1">
          {label(
            "Pick a new skill for me to learn. I'll set it up in seconds!",
            "Discover and install skills from the ClawHub ecosystem."
          )}
        </p>
      </div>
      <SkillBrowser
        installedSlugs={installedSlugs}
        onInstall={handleInstall}
        installing={installing}
      />
    </div>
  );
}
