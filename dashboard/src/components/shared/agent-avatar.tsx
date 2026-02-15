"use client";

import { cn } from "@/lib/utils";

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
  const sizeClasses = {
    sm: "w-8 h-8 text-lg",
    md: "w-12 h-12 text-2xl",
    lg: "w-20 h-20 text-4xl",
    xl: "w-32 h-32 text-6xl",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-bold",
          sizeClasses[size]
        )}
      >
        C
      </div>
      {showName && (
        <span className="font-medium text-gray-900">ClawSight</span>
      )}
    </div>
  );
}
