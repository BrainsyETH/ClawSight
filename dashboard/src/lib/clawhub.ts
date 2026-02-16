import { ClawHubSkill, SkillCategory, SkillListing } from "@/types";

const CLAWHUB_API_URL =
  process.env.CLAWHUB_API_URL || "https://clawhub.ai/api";

// In-memory cache with TTL (5 minutes)
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// Map ClawHub category strings to our SkillCategory type
const CATEGORY_MAP: Record<string, SkillCategory> = {
  search: "search",
  web: "search",
  memory: "memory",
  vector: "memory",
  communication: "communication",
  chat: "communication",
  messaging: "communication",
  development: "development",
  dev: "development",
  code: "development",
  productivity: "productivity",
  calendar: "productivity",
  trading: "trading",
  finance: "trading",
  crypto: "trading",
  defi: "trading",
  documents: "documents",
  pdf: "documents",
  file: "documents",
};

function mapCategory(raw: string): SkillCategory {
  const lower = raw.toLowerCase();
  return CATEGORY_MAP[lower] || "other";
}

/**
 * Convert a ClawHub API skill to our SkillListing format.
 */
function toSkillListing(
  skill: ClawHubSkill,
  featuredSlugs: Set<string>
): SkillListing {
  return {
    slug: skill.slug,
    name: skill.name,
    icon: skill.icon || "Package",
    description: skill.description,
    category: mapCategory(skill.category),
    installed: false, // Caller merges with user's installed state
    hasCustomForm: false, // Only locally-defined forms get true
    featured: featuredSlugs.has(skill.slug),
    installs: skill.downloads,
  };
}

/**
 * Fetch skills from ClawHub registry API.
 * Returns null on failure (caller falls back to local catalog).
 */
export async function fetchClawHubSkills(query?: string): Promise<ClawHubSkill[] | null> {
  const cacheKey = `clawhub:skills:${query || "all"}`;
  const cached = getCached<ClawHubSkill[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL("/skills", CLAWHUB_API_URL);
    if (query) url.searchParams.set("q", query);
    url.searchParams.set("limit", "100");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    // ClawHub returns { skills: [...] } or bare array
    const skills: ClawHubSkill[] = Array.isArray(data) ? data : data.skills || [];
    setCache(cacheKey, skills);
    return skills;
  } catch (err) {
    console.error("[clawhub] Fetch failed:", err);
    return null;
  }
}

/**
 * Fetch a single skill's detail from ClawHub.
 */
export async function fetchClawHubSkill(slug: string): Promise<ClawHubSkill | null> {
  const cacheKey = `clawhub:skill:${slug}`;
  const cached = getCached<ClawHubSkill>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(`/skills/${encodeURIComponent(slug)}`, CLAWHUB_API_URL);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const skill: ClawHubSkill = await res.json();
    setCache(cacheKey, skill);
    return skill;
  } catch (err) {
    console.error("[clawhub] Fetch skill failed:", err);
    return null;
  }
}

/**
 * Merge ClawHub results with local catalog. Local catalog takes precedence
 * for skills we have form definitions for (they get hasCustomForm: true).
 */
export function mergeWithLocalCatalog(
  clawHubSkills: ClawHubSkill[],
  localCatalog: SkillListing[],
  featuredSlugs: Set<string>
): SkillListing[] {
  const merged: SkillListing[] = [];
  const seen = new Set<string>();

  // Local skills first (they have custom forms and curated metadata)
  for (const local of localCatalog) {
    const remote = clawHubSkills.find((s) => s.slug === local.slug);
    merged.push({
      ...local,
      // Use remote download count if available (more accurate)
      installs: remote?.downloads ?? local.installs,
    });
    seen.add(local.slug);
  }

  // Add ClawHub skills not in local catalog
  for (const skill of clawHubSkills) {
    if (seen.has(skill.slug)) continue;
    merged.push(toSkillListing(skill, featuredSlugs));
    seen.add(skill.slug);
  }

  return merged;
}
