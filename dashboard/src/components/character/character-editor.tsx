"use client";

import { useMode } from "@/hooks/use-mode";
import { AvatarStyle } from "@/types";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AVATAR_OPTIONS: { style: AvatarStyle; label: string; emoji: string }[] = [
  { style: "lobster", label: "Lobster", emoji: "\u{1F99E}" },
  { style: "robot", label: "Robot", emoji: "\u{1F916}" },
  { style: "pixel", label: "Pixel", emoji: "\u{1F47E}" },
  { style: "cat", label: "Cat", emoji: "\u{1F431}" },
];

const COLOR_PRESETS = [
  "#FF6B6B", // Red (default)
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Purple
  "#FFB347", // Orange
  "#87CEEB", // Sky
];

interface CharacterEditorProps {
  onSave?: () => void;
  saving?: boolean;
}

export function CharacterEditor({ onSave, saving }: CharacterEditorProps) {
  const {
    mode,
    setMode,
    agentName,
    setAgentName,
    avatarStyle,
    setAvatarStyle,
    avatarColor,
    setAvatarColor,
    isFun,
  } = useMode();

  return (
    <div className="space-y-6">
      {/* Preview */}
      <Card>
        <CardContent className="py-8 flex flex-col items-center">
          <AgentAvatar size="xl" />
          <h2 className="text-xl font-bold text-gray-900 mt-4">{agentName}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isFun ? "Your personal AI assistant" : "Agent identity"}
          </p>
        </CardContent>
      </Card>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isFun ? "What should I be called?" : "Agent Name"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Mrs. Claws"
            maxLength={30}
          />
          <p className="text-xs text-gray-400 mt-2">
            {isFun
              ? "I'll introduce myself with this name!"
              : "Displayed throughout the dashboard."}
          </p>
        </CardContent>
      </Card>

      {/* Avatar Style */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isFun ? "Pick my look!" : "Avatar Style"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {AVATAR_OPTIONS.map((opt) => (
              <button
                key={opt.style}
                onClick={() => setAvatarStyle(opt.style)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  avatarStyle === opt.style
                    ? "border-red-500 bg-red-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <span className="text-3xl">{opt.emoji}</span>
                <span className="text-xs font-medium text-gray-700">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Color */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isFun ? "Pick my color!" : "Accent Color"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => setAvatarColor(color)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-transform hover:scale-110",
                  avatarColor === color
                    ? "border-gray-900 scale-110 ring-2 ring-offset-2 ring-gray-300"
                    : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={avatarColor}
                onChange={(e) => setAvatarColor(e.target.value)}
                className="w-10 h-10 rounded-full cursor-pointer border-0"
              />
              <span className="text-xs text-gray-400">Custom</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Display Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("fun")}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all",
                mode === "fun"
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-2xl mb-2 block">🦞</span>
              <h4 className="font-medium">Fun Mode</h4>
              <p className="text-xs text-gray-500 mt-1">
                Character personality, playful copy, big avatar
              </p>
            </button>
            <button
              onClick={() => setMode("professional")}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all",
                mode === "professional"
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-2xl mb-2 block">📊</span>
              <h4 className="font-medium">Professional Mode</h4>
              <p className="text-xs text-gray-500 mt-1">
                Clean interface, compact data, no character
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {onSave && (
        <Button onClick={onSave} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      )}
    </div>
  );
}
