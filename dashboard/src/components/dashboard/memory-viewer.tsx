"use client";

import { useState } from "react";
import { useMode } from "@/hooks/use-mode";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, ChevronDown, ChevronRight, Search, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/utils";

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: "fact" | "preference" | "context" | "instruction";
  source: string;
  created_at: string;
  last_accessed: string | null;
  access_count: number;
}

interface MemoryViewerProps {
  memories: MemoryEntry[];
  onDelete?: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  fact: "bg-blue-100 text-blue-700",
  preference: "bg-purple-100 text-purple-700",
  context: "bg-green-100 text-green-700",
  instruction: "bg-yellow-100 text-yellow-700",
};

export function MemoryViewer({ memories, onDelete }: MemoryViewerProps) {
  const { label } = useMode();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const filtered = memories.filter((m) => {
    const matchesSearch =
      !search ||
      m.key.toLowerCase().includes(search.toLowerCase()) ||
      m.value.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categories = ["fact", "preference", "context", "instruction"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="w-4 h-4" />
          {label("What I Remember", "Memory Store")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search memories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            <Button
              variant={categoryFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setCategoryFilter(categoryFilter === cat ? null : cat)
                }
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Memory list */}
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {search
              ? "No memories match your search"
              : "No memories stored yet"}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((memory) => {
              const isExpanded = expandedIds.has(memory.id);
              return (
                <div
                  key={memory.id}
                  className="border border-gray-100 rounded-lg"
                >
                  <button
                    onClick={() => toggleExpand(memory.id)}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                      {memory.key}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${CATEGORY_COLORS[memory.category] || ""}`}
                    >
                      {memory.category}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pl-9 space-y-2">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-2">
                        {memory.value}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created {timeAgo(memory.created_at)}
                        </span>
                        <span>Source: {memory.source}</span>
                        <span>Accessed {memory.access_count}x</span>
                        {onDelete && (
                          <button
                            onClick={() => onDelete(memory.id)}
                            className="text-red-400 hover:text-red-600 ml-auto"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
          <span>
            {filtered.length} of {memories.length} memories
          </span>
          <span>
            {categories.map((cat) => {
              const count = memories.filter((m) => m.category === cat).length;
              return count > 0 ? `${count} ${cat}` : null;
            }).filter(Boolean).join(" / ")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo memory data
export function getDemoMemories(): MemoryEntry[] {
  return [
    {
      id: "mem_1",
      key: "User's preferred programming language",
      value: "TypeScript — mentioned multiple times that they prefer TypeScript over JavaScript for all projects.",
      category: "preference",
      source: "conversation",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      last_accessed: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      access_count: 12,
    },
    {
      id: "mem_2",
      key: "GitHub repository structure",
      value: "Main repo: openclaw/gateway\nMonorepo with packages/ directory\nUses pnpm workspaces\nCI: GitHub Actions",
      category: "fact",
      source: "github_scan",
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_accessed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      access_count: 8,
    },
    {
      id: "mem_3",
      key: "Slack channel mapping",
      value: "#general → team announcements\n#dev → technical discussion\n#alerts → CI/CD and monitoring notifications",
      category: "context",
      source: "slack_scan",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      last_accessed: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      access_count: 24,
    },
    {
      id: "mem_4",
      key: "Always summarize PR reviews",
      value: "When reviewing pull requests, always provide a summary of changes at the top before going into line-by-line feedback.",
      category: "instruction",
      source: "user_instruction",
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      last_accessed: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      access_count: 6,
    },
    {
      id: "mem_5",
      key: "Timezone preference",
      value: "User is in US Central Time (CT/CST). Schedule all calendar events and reminders accordingly.",
      category: "preference",
      source: "conversation",
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      last_accessed: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      access_count: 18,
    },
  ];
}
