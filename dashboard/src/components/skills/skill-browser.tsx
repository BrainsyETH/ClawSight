"use client";

import { useState, useRef } from "react";
import { SkillListing, SkillCategory } from "@/types";
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
import { Search, Download, Star, Check, X, SearchX, Loader2 } from "lucide-react";

interface SkillBrowserProps {
  installedSlugs: string[];
  onInstall: (slug: string) => void;
  installing?: string | null;
}

function getCategoryCount(category: SkillCategory): number {
  return SKILL_CATALOG.filter((s) => s.category === category).length;
}

function formatInstalls(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return count.toString();
}

export function SkillBrowser({
  installedSlugs,
  onInstall,
  installing,
}: SkillBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    SkillCategory | "all"
  >("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const featured = getFeaturedSkills();
  const allSkills =
    searchQuery.length > 0
      ? searchSkills(searchQuery)
      : selectedCategory === "all"
        ? SKILL_CATALOG
        : SKILL_CATALOG.filter((s) => s.category === selectedCategory);

  const clearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          aria-hidden="true"
        />
        <Input
          ref={searchInputRef}
          placeholder="Search skills by name or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Search skills"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Clear search"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Categories */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide"
        role="tablist"
        aria-label="Filter skills by category"
      >
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory("all")}
          role="tab"
          aria-selected={selectedCategory === "all"}
          className="shrink-0"
        >
          All
          <span className="ml-1.5 text-[10px] opacity-70">
            {SKILL_CATALOG.length}
          </span>
        </Button>
        {CATEGORIES.map((cat) => {
          const count = getCategoryCount(cat.value);
          return (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.value)}
              role="tab"
              aria-selected={selectedCategory === cat.value}
              className="shrink-0"
            >
              {cat.label}
              <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>

      {/* Featured section (only when not searching and on "all") */}
      {!searchQuery && selectedCategory === "all" && (
        <section aria-labelledby="featured-heading">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <h2
              id="featured-heading"
              className="text-sm font-semibold text-gray-900 uppercase tracking-wider"
            >
              Featured
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((skill) => (
              <SkillListingCard
                key={skill.slug}
                skill={skill}
                installed={installedSlugs.includes(skill.slug)}
                onInstall={onInstall}
                installing={installing === skill.slug}
                featured
              />
            ))}
          </div>
        </section>
      )}

      {/* All skills / Search results */}
      <section aria-labelledby="all-skills-heading">
        <h2
          id="all-skills-heading"
          className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4"
        >
          {searchQuery
            ? `${allSkills.length} result${allSkills.length !== 1 ? "s" : ""}`
            : selectedCategory === "all"
              ? "All Skills"
              : CATEGORIES.find((c) => c.value === selectedCategory)?.label ??
                "Skills"}
        </h2>

        {allSkills.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSkills.map((skill) => (
              <SkillListingCard
                key={skill.slug}
                skill={skill}
                installed={installedSlugs.includes(skill.slug)}
                onInstall={onInstall}
                installing={installing === skill.slug}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <SearchX
              className="w-10 h-10 text-gray-300 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-gray-900 mb-1">
              No skills found
            </p>
            <p className="text-sm text-gray-500 mb-4">
              No skills match &ldquo;{searchQuery}&rdquo;. Try a different
              search term.
            </p>
            <Button variant="outline" size="sm" onClick={clearSearch}>
              Clear search
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function SkillListingCard({
  skill,
  installed,
  onInstall,
  installing,
  featured,
}: {
  skill: SkillListing;
  installed: boolean;
  onInstall: (slug: string) => void;
  installing: boolean;
  featured?: boolean;
}) {
  return (
    <Card
      className={`transition-all duration-150 hover:shadow-md ${
        featured
          ? "border-amber-200 bg-gradient-to-br from-amber-50/60 to-white ring-1 ring-amber-100"
          : "hover:border-gray-300"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-gray-900">{skill.name}</h3>
              {featured && (
                <Badge
                  variant="warning"
                  className="text-[10px] gap-0.5 px-1.5"
                >
                  <Star className="w-2.5 h-2.5" aria-hidden="true" />
                  Featured
                </Badge>
              )}
              {skill.hasCustomForm && !featured && (
                <Badge
                  variant="default"
                  className="text-[10px] gap-0.5 px-1.5"
                >
                  ClawSight
                </Badge>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {skill.description}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
              {skill.category}
            </Badge>
            {skill.installs != null && (
              <span className="text-xs text-gray-400 shrink-0">
                {formatInstalls(skill.installs)}
              </span>
            )}
          </div>
          {installed ? (
            <Badge variant="success" className="gap-1 shrink-0">
              <Check className="w-3 h-3" aria-hidden="true" />
              Installed
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={() => onInstall(skill.slug)}
              disabled={installing}
              className="gap-1 shrink-0"
              aria-label={`Install ${skill.name}`}
            >
              {installing ? (
                <>
                  <Loader2
                    className="w-3 h-3 animate-spin"
                    aria-hidden="true"
                  />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" aria-hidden="true" />
                  Install
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
