"use client";

import { useState } from "react";
import { SkillListing, SkillCategory } from "@/types";
import { useMode } from "@/hooks/use-mode";
import {
  SKILL_CATALOG,
  CATEGORIES,
  getFeaturedSkills,
  searchSkills,
} from "@/lib/skill-catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Star, Check } from "lucide-react";

interface SkillBrowserProps {
  installedSlugs: string[];
  onInstall: (slug: string) => void;
  installing?: string | null;
}

export function SkillBrowser({
  installedSlugs,
  onInstall,
  installing,
}: SkillBrowserProps) {
  const { isFun, label } = useMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    SkillCategory | "all"
  >("all");

  const featured = getFeaturedSkills();
  const allSkills =
    searchQuery.length > 0
      ? searchSkills(searchQuery)
      : selectedCategory === "all"
        ? SKILL_CATALOG
        : SKILL_CATALOG.filter((s) => s.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder={
            isFun
              ? "What should I learn?"
              : "Search skills..."
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory("all")}
        >
          All
        </Button>
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={selectedCategory === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Featured section (only when not searching) */}
      {!searchQuery && selectedCategory === "all" && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {label("Skills I Recommend", "Featured")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {featured.map((skill) => (
              <SkillListingCard
                key={skill.slug}
                skill={skill}
                installed={installedSlugs.includes(skill.slug)}
                onInstall={onInstall}
                installing={installing === skill.slug}
                isFun={isFun}
                featured
              />
            ))}
          </div>
        </div>
      )}

      {/* All skills */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {searchQuery
            ? `${allSkills.length} results`
            : label("All the Things I Can Learn", "All Skills")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allSkills.map((skill) => (
            <SkillListingCard
              key={skill.slug}
              skill={skill}
              installed={installedSlugs.includes(skill.slug)}
              onInstall={onInstall}
              installing={installing === skill.slug}
              isFun={isFun}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillListingCard({
  skill,
  installed,
  onInstall,
  installing,
  isFun,
  featured,
}: {
  skill: SkillListing;
  installed: boolean;
  onInstall: (slug: string) => void;
  installing: boolean;
  isFun: boolean;
  featured?: boolean;
}) {
  return (
    <Card
      className={`hover:shadow-md transition-shadow ${featured ? "border-red-200 bg-red-50/30" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">{skill.name}</h4>
              {skill.hasCustomForm && (
                <Badge variant="default" className="text-xs gap-1">
                  <Star className="w-3 h-3" />
                  ClawSight
                </Badge>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {skill.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {skill.category}
            </Badge>
            {skill.installs && (
              <span className="text-xs text-gray-400">
                {skill.installs.toLocaleString()} installs
              </span>
            )}
          </div>
          {installed ? (
            <Badge variant="success" className="gap-1">
              <Check className="w-3 h-3" />
              Installed
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={() => onInstall(skill.slug)}
              disabled={installing}
              className="gap-1"
            >
              <Download className="w-3 h-3" />
              {installing
                ? "Installing..."
                : isFun
                  ? "Learn This!"
                  : "Install"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
