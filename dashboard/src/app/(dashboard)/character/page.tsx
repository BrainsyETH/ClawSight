"use client";

import { useMode } from "@/hooks/use-mode";
import { CharacterEditor } from "@/components/character/character-editor";
import { User } from "lucide-react";

export default function CharacterPage() {
  const { label } = useMode();

  const handleSave = () => {
    // In production: PATCH /v1/api/users
    alert("Character saved! (demo)");
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
      <CharacterEditor onSave={handleSave} />
    </div>
  );
}
