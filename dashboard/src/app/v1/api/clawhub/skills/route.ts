import { NextRequest, NextResponse } from "next/server";
import { fetchClawHubSkills, mergeWithLocalCatalog } from "@/lib/clawhub";
import { SKILL_CATALOG } from "@/lib/skill-catalog";

const FEATURED_SLUGS = new Set([
  "web_search",
  "memory",
  "slack",
  "github",
  "crypto_trading",
]);

/**
 * GET /v1/api/clawhub/skills?q=<query>
 *
 * Fetches skills from ClawHub registry, merges with local catalog.
 * Falls back to local catalog only if ClawHub is unreachable.
 * Public endpoint (no auth required) — skill browsing is pre-login.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || undefined;

  const clawHubSkills = await fetchClawHubSkills(query);

  if (clawHubSkills) {
    const merged = mergeWithLocalCatalog(
      clawHubSkills,
      SKILL_CATALOG,
      FEATURED_SLUGS
    );
    return NextResponse.json({
      skills: merged,
      source: "clawhub",
      total: merged.length,
    });
  }

  // Fallback: return local catalog only
  let skills = SKILL_CATALOG;
  if (query) {
    const q = query.toLowerCase();
    skills = SKILL_CATALOG.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.slug.includes(q)
    );
  }

  return NextResponse.json({
    skills,
    source: "local",
    total: skills.length,
  });
}
