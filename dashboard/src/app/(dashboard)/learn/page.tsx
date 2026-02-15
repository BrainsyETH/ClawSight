"use client";

import { useState } from "react";
import { useMode } from "@/hooks/use-mode";
import { SkillBrowser } from "@/components/skills/skill-browser";
import { Compass } from "lucide-react";

export default function LearnPage() {
  const { label } = useMode();
  const [installedSlugs] = useState([
    "web_search",
    "memory",
    "slack",
    "github",
    "crypto_trading",
    "pdf",
  ]);
  const [installing, setInstalling] = useState<string | null>(null);

  const handleInstall = async (slug: string) => {
    setInstalling(slug);
    // In production: trigger clawhub install via plugin
    await new Promise((r) => setTimeout(r, 2000));
    setInstalling(null);
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
