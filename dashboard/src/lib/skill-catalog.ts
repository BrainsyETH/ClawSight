import { SkillListing, SkillCategory } from "@/types";
import { CURATED_SKILL_SLUGS } from "./skill-forms";

// ============================================================
// Curated skill catalog for the "Learn New Skills" browser.
// Featured skills are hand-picked. ClawHub skills are fetched
// via /v1/api/clawhub/skills and merged at the page level.
// This static list serves as the reliable fallback.
// ============================================================

export const SKILL_CATALOG: SkillListing[] = [
  // --- FEATURED (shown at top) ---
  {
    slug: "web_search",
    name: "Web Search",
    icon: "Search",
    description: "Search the web for real-time information using Google, Bing, or DuckDuckGo",
    category: "search",
    installed: false,
    hasCustomForm: true,
    featured: true,
  },
  {
    slug: "memory",
    name: "Memory (LanceDB)",
    icon: "Brain",
    description: "Long-term vector memory so your agent remembers across sessions",
    category: "memory",
    installed: false,
    hasCustomForm: true,
    featured: true,
  },
  {
    slug: "slack",
    name: "Slack",
    icon: "MessageSquare",
    description: "Send and receive messages in Slack workspaces",
    category: "communication",
    installed: false,
    hasCustomForm: true,
    featured: true,
  },
  {
    slug: "github",
    name: "GitHub",
    icon: "Github",
    description: "Manage repos, issues, and pull requests on GitHub",
    category: "development",
    installed: false,
    hasCustomForm: true,
    featured: true,
  },
  {
    slug: "crypto_trading",
    name: "Crypto Trading",
    icon: "TrendingUp",
    description: "Trade on Hyperliquid, Polymarket, Uniswap, and more with risk controls",
    category: "trading",
    installed: false,
    hasCustomForm: true,
    featured: true,
  },
  // --- NON-FEATURED (with custom forms) ---
  {
    slug: "google_calendar",
    name: "Google Calendar",
    icon: "Calendar",
    description: "Read and manage your Google Calendar events and reminders",
    category: "productivity",
    installed: false,
    hasCustomForm: true,
    featured: false,
  },
  {
    slug: "discord",
    name: "Discord",
    icon: "MessageCircle",
    description: "Interact with Discord servers and channels",
    category: "communication",
    installed: false,
    hasCustomForm: true,
    featured: false,
  },
  {
    slug: "pdf",
    name: "PDF Operations",
    icon: "FileText",
    description: "Read, create, and manipulate PDF documents",
    category: "documents",
    installed: false,
    hasCustomForm: true,
    featured: false,
  },
  // --- GENERIC (no custom forms yet, JSON editor only) ---
  {
    slug: "email",
    name: "Email (IMAP/SMTP)",
    icon: "Mail",
    description: "Read and send emails via IMAP and SMTP",
    category: "communication",
    installed: false,
    hasCustomForm: false,
    featured: false,
  },
  {
    slug: "notion",
    name: "Notion",
    icon: "BookOpen",
    description: "Read and write Notion pages and databases",
    category: "productivity",
    installed: false,
    hasCustomForm: false,
    featured: false,
  },
  {
    slug: "web_scraper",
    name: "Web Scraper",
    icon: "Globe",
    description: "Extract structured data from websites",
    category: "search",
    installed: false,
    hasCustomForm: false,
    featured: false,
  },
  {
    slug: "terminal",
    name: "Terminal",
    icon: "Terminal",
    description: "Execute shell commands on the host machine",
    category: "development",
    installed: false,
    hasCustomForm: false,
    featured: false,
  },
  {
    slug: "home_assistant",
    name: "Home Assistant",
    icon: "Home",
    description: "Control smart home devices via Home Assistant",
    category: "other",
    installed: false,
    hasCustomForm: false,
    featured: false,
  },
  {
    slug: "telegram",
    name: "Telegram",
    icon: "Send",
    description: "Send and receive Telegram messages",
    category: "communication",
    installed: false,
    hasCustomForm: false,
    featured: false,
  },
  {
    slug: "linear",
    name: "Linear",
    icon: "Layers",
    description: "Manage Linear issues, projects, and cycles",
    category: "development",
    installed: false,
    hasCustomForm: false,
    featured: false,
  },
];

export const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: "search", label: "Search" },
  { value: "memory", label: "Memory" },
  { value: "communication", label: "Communication" },
  { value: "development", label: "Development" },
  { value: "productivity", label: "Productivity" },
  { value: "trading", label: "Trading" },
  { value: "documents", label: "Documents" },
  { value: "other", label: "Other" },
];

export function getFeaturedSkills(): SkillListing[] {
  return SKILL_CATALOG.filter((s) => s.featured);
}

export function getSkillsByCategory(category: SkillCategory): SkillListing[] {
  return SKILL_CATALOG.filter((s) => s.category === category);
}

export function searchSkills(query: string): SkillListing[] {
  const q = query.toLowerCase();
  return SKILL_CATALOG.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.slug.includes(q)
  );
}
