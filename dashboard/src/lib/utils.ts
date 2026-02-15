import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUSDC(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function getEventTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    tool_call: "Wrench",
    message_sent: "MessageSquare",
    payment: "Coins",
    error: "AlertTriangle",
    status_change: "Activity",
    skill_installed: "Download",
    config_changed: "Settings",
  };
  return icons[type] || "Circle";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    online: "bg-green-500",
    thinking: "bg-yellow-500 animate-pulse",
    idle: "bg-gray-400",
    offline: "bg-red-500",
  };
  return colors[status] || "bg-gray-400";
}

export function getSyncStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-gray-400",
    syncing: "text-yellow-500",
    applied: "text-green-500",
    failed: "text-red-500",
  };
  return colors[status] || "text-gray-400";
}
