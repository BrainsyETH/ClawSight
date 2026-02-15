"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { useUser } from "@/hooks/use-supabase-data";
import { CharacterEditor } from "@/components/character/character-editor";
import { User, CheckCircle } from "lucide-react";

export default function CharacterPage() {
  const { walletAddress } = useAuth();
  const { label, mode, agentName, avatarStyle, avatarColor } = useMode();
  const { updateUser } = useUser(walletAddress ?? undefined);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateUser({
        display_mode: mode,
        agent_name: agentName,
        avatar_style: avatarStyle,
        avatar_color: avatarColor,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("[character] Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-6 h-6" />
          {label("Customize Me!", "Agent Settings")}
        </h1>
        <p className="text-gray-500 mt-1">
          {label(
            "Change my name, pick my look, or switch between fun and professional mode!",
            "Configure agent identity and display preferences."
          )}
        </p>
      </div>
      <CharacterEditor onSave={handleSave} saving={saving} />
      {saved && (
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          Changes saved!
        </div>
      )}
    </div>
  );
}
