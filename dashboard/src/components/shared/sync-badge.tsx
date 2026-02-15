"use client";

import { SyncStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Clock } from "lucide-react";

interface SyncBadgeProps {
  status: SyncStatus;
  error?: string | null;
}

const CONFIG: Record<
  SyncStatus,
  { label: string; variant: "secondary" | "warning" | "success" | "destructive"; Icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: "Pending", variant: "secondary", Icon: Clock },
  syncing: { label: "Syncing...", variant: "warning", Icon: Loader2 },
  applied: { label: "Applied", variant: "success", Icon: Check },
  failed: { label: "Failed", variant: "destructive", Icon: X },
};

export function SyncBadge({ status, error }: SyncBadgeProps) {
  const { label, variant, Icon } = CONFIG[status];

  return (
    <div className="flex items-center gap-1">
      <Badge variant={variant} className="gap-1">
        <Icon
          className={`w-3 h-3 ${status === "syncing" ? "animate-spin" : ""}`}
        />
        {label}
      </Badge>
      {error && status === "failed" && (
        <span className="text-xs text-red-500 ml-1">{error}</span>
      )}
    </div>
  );
}
