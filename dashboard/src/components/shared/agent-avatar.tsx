"use client";

import { useMode } from "@/hooks/use-mode";
import { cn } from "@/lib/utils";

const AVATAR_EMOJIS: Record<string, string> = {
  lobster: "\u{1F99E}",
  robot: "\u{1F916}",
  pixel: "\u{1F47E}",
  cat: "\u{1F431}",
  custom: "\u{2728}",
};

interface AgentAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
  showName?: boolean;
  className?: string;
}

export function AgentAvatar({
  size = "md",
  showName = false,
  className,
}: AgentAvatarProps) {
  const { avatarStyle, avatarColor, agentName, isFun } = useMode();

  const sizeClasses = {
    sm: "w-8 h-8 text-lg",
    md: "w-12 h-12 text-2xl",
    lg: "w-20 h-20 text-4xl",
    xl: "w-32 h-32 text-6xl",
  };

  if (!isFun) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div
          className={cn(
            "rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-bold",
            sizeClasses[size]
          )}
        >
          {agentName.charAt(0).toUpperCase()}
        </div>
        {showName && (
          <span className="font-medium text-gray-900">{agentName}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105",
          sizeClasses[size]
        )}
        style={{ backgroundColor: avatarColor + "20", borderColor: avatarColor, borderWidth: 2 }}
      >
        {AVATAR_EMOJIS[avatarStyle] || AVATAR_EMOJIS.lobster}
      </div>
      {showName && (
        <span className="font-semibold text-gray-900">{agentName}</span>
      )}
    </div>
  );
}
