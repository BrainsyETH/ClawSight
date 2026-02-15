"use client";

import { useState } from "react";
import { ActivityEvent, EventType } from "@/types";
import { useMode } from "@/hooks/use-mode";
import { cn, timeAgo } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Wrench,
  MessageSquare,
  Coins,
  AlertTriangle,
  Activity,
  Download,
  Settings,
  Search,
  Trash2,
  EyeOff,
} from "lucide-react";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tool_call: Wrench,
  message_sent: MessageSquare,
  payment: Coins,
  error: AlertTriangle,
  status_change: Activity,
  skill_installed: Download,
  config_changed: Settings,
};

const EVENT_COLORS: Record<string, string> = {
  tool_call: "text-blue-500",
  message_sent: "text-green-500",
  payment: "text-yellow-500",
  error: "text-red-500",
  status_change: "text-purple-500",
  skill_installed: "text-teal-500",
  config_changed: "text-gray-500",
};

const EVENT_TYPES: EventType[] = [
  "tool_call",
  "message_sent",
  "payment",
  "error",
  "status_change",
  "skill_installed",
  "config_changed",
];

function formatEventDescription(event: ActivityEvent, isFun: boolean): string {
  const data = event.event_data;

  switch (event.event_type) {
    case "tool_call": {
      const tool = (data.tool as string) || "unknown tool";
      const duration = data.duration_ms ? ` (${data.duration_ms}ms)` : "";
      return isFun
        ? `I used ${tool}${duration}`
        : `Tool: ${tool}${duration}`;
    }
    case "message_sent": {
      const platform = (data.platform as string) || "unknown";
      const preview = (data.preview as string) || "";
      return isFun
        ? `I sent a message via ${platform}${preview ? `: "${preview}"` : ""}`
        : `Message sent via ${platform}${preview ? `: "${preview}"` : ""}`;
    }
    case "payment": {
      const amount = data.amount ? `$${data.amount}` : "";
      const service = (data.service as string) || "unknown";
      return isFun
        ? `I paid ${amount} to ${service}`
        : `Payment: ${amount} to ${service}`;
    }
    case "error": {
      const msg = (data.message as string) || "Unknown error";
      return isFun ? `Oops! Something went wrong: ${msg}` : `Error: ${msg}`;
    }
    case "status_change": {
      const newStatus = (data.new_status as string) || "unknown";
      return isFun
        ? `I'm now ${newStatus}`
        : `Status changed to ${newStatus}`;
    }
    case "skill_installed": {
      const skill = (data.skill_name as string) || "unknown";
      return isFun
        ? `I learned a new skill: ${skill}!`
        : `Skill installed: ${skill}`;
    }
    case "config_changed": {
      const skill = (data.skill_slug as string) || "unknown";
      return isFun
        ? `My ${skill} settings were updated`
        : `Config updated: ${skill}`;
    }
    default:
      return JSON.stringify(data);
  }
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  className?: string;
  onRedactEvent?: (eventId: string) => void;
  onRedactFields?: (eventId: string, fields: string[]) => void;
}

export function ActivityFeed({ events, className, onRedactEvent, onRedactFields }: ActivityFeedProps) {
  const { isFun, label } = useMode();
  const [filter, setFilter] = useState<EventType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = events.filter((e) => {
    if (filter !== "all" && e.event_type !== filter) return false;
    if (searchQuery) {
      const desc = formatEventDescription(e, isFun).toLowerCase();
      if (!desc.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {label("What I've Been Up To", "Activity Feed")}
          </CardTitle>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            {EVENT_TYPES.map((type) => {
              const Icon = EVENT_ICONS[type];
              return (
                <Button
                  key={type}
                  variant={filter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(type)}
                  className="gap-1"
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {type.replace("_", " ")}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState type="no-activity" />
        ) : (
          <div className="space-y-1">
            {filtered.map((event) => {
              const Icon = EVENT_ICONS[event.event_type] || Activity;
              return (
                <div
                  key={event.id}
                  className="group flex items-start gap-3 py-3 border-b border-gray-100 last:border-0"
                >
                  <div
                    className={cn(
                      "mt-0.5 p-1.5 rounded-lg bg-gray-50",
                      EVENT_COLORS[event.event_type]
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {formatEventDescription(event, isFun)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {timeAgo(event.occurred_at)}
                      </span>
                      {event.skill_slug && (
                        <Badge variant="secondary" className="text-xs">
                          {event.skill_slug}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Redaction controls */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onRedactFields && Object.keys(event.event_data).length > 0 && (
                      <button
                        onClick={() =>
                          onRedactFields(
                            event.id,
                            Object.keys(event.event_data).filter(
                              (k) => event.event_data[k] !== "[redacted]" && k !== "idempotency_key"
                            )
                          )
                        }
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-yellow-600"
                        title="Redact details"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onRedactEvent && (
                      <button
                        onClick={() => onRedactEvent(event.id)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
