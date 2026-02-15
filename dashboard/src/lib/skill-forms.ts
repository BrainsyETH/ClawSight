import { SkillFormDefinition } from "@/types";

// ============================================================
// Declarative form registry
// Each skill's config form is defined as data, not components.
// One generic renderer handles all of them.
// ============================================================

export const SKILL_FORMS: Record<string, SkillFormDefinition> = {
  // ----------------------------------------------------------
  // 1. Web Search
  // ----------------------------------------------------------
  web_search: {
    slug: "web_search",
    name: "Web Search",
    icon: "Search",
    description: "Search the web for real-time information",
    funDescription: "I can look things up on the internet for you!",
    category: "search",
    fields: [
      {
        key: "provider",
        type: "select",
        label: "Search provider",
        funLabel: "Which search engine should I use?",
        options: [
          { value: "google", label: "Google" },
          { value: "bing", label: "Bing" },
          { value: "duckduckgo", label: "DuckDuckGo" },
          { value: "brave", label: "Brave Search" },
        ],
        default: "google",
      },
      {
        key: "api_key",
        type: "secret",
        label: "API key",
        funLabel: "What's my search API key?",
        placeholder: "sk-...",
        required: true,
      },
      {
        key: "max_results",
        type: "slider",
        label: "Max results per query",
        funLabel: "How many results should I bring back?",
        min: 1,
        max: 50,
        step: 1,
        default: 10,
        suffix: "results",
      },
      {
        key: "safe_search",
        type: "toggle",
        label: "Safe search",
        funLabel: "Should I filter out unsafe content?",
        default: true,
      },
    ],
    defaultConfig: {
      provider: "google",
      api_key: "",
      max_results: 10,
      safe_search: true,
    },
  },

  // ----------------------------------------------------------
  // 2. Memory (LanceDB)
  // ----------------------------------------------------------
  memory: {
    slug: "memory",
    name: "Memory",
    icon: "Brain",
    description: "Long-term memory storage using LanceDB vector database",
    funDescription: "This is how I remember things about you and our conversations!",
    category: "memory",
    fields: [
      {
        key: "db_path",
        type: "text",
        label: "Database path",
        funLabel: "Where should I store my memories?",
        placeholder: "~/.openclaw/memory/lancedb",
        description: "Path to the LanceDB database directory",
      },
      {
        key: "embedding_model",
        type: "select",
        label: "Embedding model",
        funLabel: "Which model should I use to understand meaning?",
        options: [
          { value: "text-embedding-3-small", label: "OpenAI Small (fast, cheap)" },
          { value: "text-embedding-3-large", label: "OpenAI Large (accurate)" },
          { value: "local", label: "Local embeddings (private)" },
        ],
        default: "text-embedding-3-small",
      },
      {
        key: "max_results",
        type: "slider",
        label: "Memory recall limit",
        funLabel: "How many memories should I recall at once?",
        min: 1,
        max: 20,
        step: 1,
        default: 5,
        suffix: "memories",
      },
      {
        key: "auto_save",
        type: "toggle",
        label: "Auto-save conversations",
        funLabel: "Should I automatically remember our conversations?",
        default: true,
      },
      {
        key: "similarity_threshold",
        type: "slider",
        label: "Relevance threshold",
        funLabel: "How relevant should a memory be before I bring it up?",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.7,
        suffix: "",
      },
    ],
    defaultConfig: {
      db_path: "~/.openclaw/memory/lancedb",
      embedding_model: "text-embedding-3-small",
      max_results: 5,
      auto_save: true,
      similarity_threshold: 0.7,
    },
  },

  // ----------------------------------------------------------
  // 3. Slack
  // ----------------------------------------------------------
  slack: {
    slug: "slack",
    name: "Slack",
    icon: "MessageSquare",
    description: "Send and receive messages via Slack",
    funDescription: "I can chat with people on Slack for you!",
    category: "communication",
    fields: [
      {
        key: "bot_token",
        type: "secret",
        label: "Bot token",
        funLabel: "What's my Slack bot token?",
        placeholder: "xoxb-...",
        required: true,
        description: "Your Slack bot user OAuth token",
      },
      {
        key: "app_token",
        type: "secret",
        label: "App token",
        funLabel: "What's my Slack app token?",
        placeholder: "xapp-...",
        description: "Required for Socket Mode (real-time events)",
      },
      {
        key: "default_channel",
        type: "text",
        label: "Default channel",
        funLabel: "Which channel should I hang out in by default?",
        placeholder: "#general",
      },
      {
        key: "respond_to_mentions",
        type: "toggle",
        label: "Respond to @mentions",
        funLabel: "Should I reply when someone @mentions me?",
        default: true,
      },
      {
        key: "respond_to_dms",
        type: "toggle",
        label: "Respond to direct messages",
        funLabel: "Should I reply to DMs?",
        default: true,
      },
      {
        key: "thread_replies",
        type: "toggle",
        label: "Reply in threads",
        funLabel: "Should I keep my replies in threads to stay tidy?",
        default: true,
      },
    ],
    defaultConfig: {
      bot_token: "",
      app_token: "",
      default_channel: "#general",
      respond_to_mentions: true,
      respond_to_dms: true,
      thread_replies: true,
    },
  },

  // ----------------------------------------------------------
  // 4. GitHub
  // ----------------------------------------------------------
  github: {
    slug: "github",
    name: "GitHub",
    icon: "Github",
    description: "Interact with GitHub repositories, issues, and PRs",
    funDescription: "I can help manage your code on GitHub!",
    category: "development",
    fields: [
      {
        key: "token",
        type: "secret",
        label: "Personal access token",
        funLabel: "What's my GitHub token?",
        placeholder: "ghp_...",
        required: true,
      },
      {
        key: "default_owner",
        type: "text",
        label: "Default organization / owner",
        funLabel: "Which GitHub org should I focus on?",
        placeholder: "your-org",
      },
      {
        key: "default_repo",
        type: "text",
        label: "Default repository",
        funLabel: "Which repo should I work in by default?",
        placeholder: "your-repo",
      },
      {
        key: "auto_review",
        type: "toggle",
        label: "Auto-review pull requests",
        funLabel: "Should I automatically review new PRs?",
        default: false,
      },
      {
        key: "watch_issues",
        type: "toggle",
        label: "Watch for new issues",
        funLabel: "Should I keep an eye on new issues?",
        default: false,
      },
    ],
    defaultConfig: {
      token: "",
      default_owner: "",
      default_repo: "",
      auto_review: false,
      watch_issues: false,
    },
  },

  // ----------------------------------------------------------
  // 5. Google Calendar
  // ----------------------------------------------------------
  google_calendar: {
    slug: "google_calendar",
    name: "Google Calendar",
    icon: "Calendar",
    description: "Read and manage Google Calendar events",
    funDescription: "I can manage your schedule and remind you about meetings!",
    category: "productivity",
    fields: [
      {
        key: "credentials_path",
        type: "text",
        label: "Credentials file path",
        funLabel: "Where's my Google credentials file?",
        placeholder: "~/.openclaw/google-credentials.json",
        required: true,
        description: "Path to your Google OAuth credentials JSON file",
      },
      {
        key: "calendar_id",
        type: "text",
        label: "Calendar ID",
        funLabel: "Which calendar should I manage?",
        placeholder: "primary",
        description: "Use 'primary' for your main calendar",
      },
      {
        key: "lookahead_days",
        type: "slider",
        label: "Lookahead window",
        funLabel: "How far ahead should I look for events?",
        min: 1,
        max: 30,
        step: 1,
        default: 7,
        suffix: "days",
      },
      {
        key: "can_create_events",
        type: "toggle",
        label: "Allow creating events",
        funLabel: "Should I be able to add events to your calendar?",
        default: false,
      },
      {
        key: "can_modify_events",
        type: "toggle",
        label: "Allow modifying events",
        funLabel: "Should I be able to change existing events?",
        default: false,
      },
      {
        key: "reminder_minutes",
        type: "select",
        label: "Default reminder",
        funLabel: "How early should I remind you about events?",
        options: [
          { value: "5", label: "5 minutes before" },
          { value: "10", label: "10 minutes before" },
          { value: "15", label: "15 minutes before" },
          { value: "30", label: "30 minutes before" },
          { value: "60", label: "1 hour before" },
        ],
        default: "15",
      },
    ],
    defaultConfig: {
      credentials_path: "~/.openclaw/google-credentials.json",
      calendar_id: "primary",
      lookahead_days: 7,
      can_create_events: false,
      can_modify_events: false,
      reminder_minutes: "15",
    },
  },

  // ----------------------------------------------------------
  // 6. Discord
  // ----------------------------------------------------------
  discord: {
    slug: "discord",
    name: "Discord",
    icon: "MessageCircle",
    description: "Interact with Discord servers and channels",
    funDescription: "I can hang out in your Discord servers and chat!",
    category: "communication",
    fields: [
      {
        key: "bot_token",
        type: "secret",
        label: "Bot token",
        funLabel: "What's my Discord bot token?",
        placeholder: "MTk...",
        required: true,
      },
      {
        key: "server_id",
        type: "text",
        label: "Server ID",
        funLabel: "Which server should I join?",
        placeholder: "123456789012345678",
        required: true,
      },
      {
        key: "allowed_channels",
        type: "textarea",
        label: "Allowed channel IDs (one per line)",
        funLabel: "Which channels should I listen to?",
        rows: 3,
        description: "Leave empty to listen to all channels",
      },
      {
        key: "respond_to_mentions",
        type: "toggle",
        label: "Respond to @mentions",
        funLabel: "Should I reply when someone @mentions me?",
        default: true,
      },
      {
        key: "respond_to_dms",
        type: "toggle",
        label: "Respond to DMs",
        funLabel: "Should I reply to direct messages?",
        default: false,
      },
    ],
    defaultConfig: {
      bot_token: "",
      server_id: "",
      allowed_channels: "",
      respond_to_mentions: true,
      respond_to_dms: false,
    },
  },

  // ----------------------------------------------------------
  // 7. Crypto Trading
  // ----------------------------------------------------------
  crypto_trading: {
    slug: "crypto_trading",
    name: "Crypto Trading",
    icon: "TrendingUp",
    description: "Execute cryptocurrency trades and monitor positions",
    funDescription: "I can trade crypto for you — carefully and within your limits!",
    category: "trading",
    fields: [
      {
        key: "exchange",
        type: "select",
        label: "Exchange",
        funLabel: "Which exchange should I trade on?",
        options: [
          { value: "hyperliquid", label: "Hyperliquid" },
          { value: "polymarket", label: "Polymarket" },
          { value: "uniswap", label: "Uniswap" },
          { value: "jupiter", label: "Jupiter (Solana)" },
        ],
        required: true,
      },
      {
        key: "api_key",
        type: "secret",
        label: "API key",
        funLabel: "What's my exchange API key?",
        placeholder: "Your exchange API key",
      },
      {
        key: "api_secret",
        type: "secret",
        label: "API secret",
        funLabel: "What's my exchange API secret?",
        placeholder: "Your exchange API secret",
      },
      {
        key: "max_trade_size",
        type: "currency",
        label: "Max trade size",
        funLabel: "What's the most I should risk on a single trade?",
        min: 1,
        max: 1000,
        default: 25,
        currency: "USDC",
      },
      {
        key: "daily_budget",
        type: "currency",
        label: "Daily budget",
        funLabel: "What's my total daily trading budget?",
        min: 5,
        max: 10000,
        default: 50,
        currency: "USDC",
      },
      {
        key: "copy_trader_address",
        type: "text",
        label: "Copy trader wallet (optional)",
        funLabel: "Is there a trader whose moves I should follow?",
        placeholder: "0x...",
        description: "Leave empty to disable copy trading",
      },
      {
        key: "copy_percentage",
        type: "slider",
        label: "Copy trade size",
        funLabel: "How much of their position should I copy?",
        min: 5,
        max: 100,
        step: 5,
        default: 10,
        suffix: "%",
      },
      {
        key: "stop_loss",
        type: "slider",
        label: "Stop loss",
        funLabel: "When should I cut losses?",
        min: 5,
        max: 50,
        step: 5,
        default: 15,
        suffix: "%",
      },
      {
        key: "categories",
        type: "multiselect",
        label: "Allowed markets",
        funLabel: "Which types of markets should I trade in?",
        options: [
          { value: "crypto", label: "Crypto" },
          { value: "politics", label: "Politics" },
          { value: "sports", label: "Sports" },
          { value: "entertainment", label: "Entertainment" },
        ],
        default: ["crypto"],
      },
    ],
    defaultConfig: {
      exchange: "hyperliquid",
      api_key: "",
      api_secret: "",
      max_trade_size: 25,
      daily_budget: 50,
      copy_trader_address: "",
      copy_percentage: 10,
      stop_loss: 15,
      categories: ["crypto"],
    },
  },

  // ----------------------------------------------------------
  // 8. PDF Operations
  // ----------------------------------------------------------
  pdf: {
    slug: "pdf",
    name: "PDF Operations",
    icon: "FileText",
    description: "Read, create, and manipulate PDF documents",
    funDescription: "I can read and create PDFs for you!",
    category: "documents",
    fields: [
      {
        key: "output_dir",
        type: "text",
        label: "Output directory",
        funLabel: "Where should I save PDFs I create?",
        placeholder: "~/Documents/clawsight-pdfs",
      },
      {
        key: "max_pages",
        type: "slider",
        label: "Max pages to read",
        funLabel: "How many pages should I read from large PDFs?",
        min: 10,
        max: 500,
        step: 10,
        default: 100,
        suffix: "pages",
      },
      {
        key: "ocr_enabled",
        type: "toggle",
        label: "Enable OCR for scanned documents",
        funLabel: "Should I try to read text from scanned images?",
        default: false,
      },
      {
        key: "extract_images",
        type: "toggle",
        label: "Extract images from PDFs",
        funLabel: "Should I pull out images when reading PDFs?",
        default: false,
      },
    ],
    defaultConfig: {
      output_dir: "~/Documents/clawsight-pdfs",
      max_pages: 100,
      ocr_enabled: false,
      extract_images: false,
    },
  },
};

// All skill slugs that have custom forms
export const CURATED_SKILL_SLUGS = Object.keys(SKILL_FORMS);

// Helper to check if a skill has a custom form
export function hasCustomForm(slug: string): boolean {
  return slug in SKILL_FORMS;
}

// Get form definition or null for generic editor
export function getSkillForm(slug: string): SkillFormDefinition | null {
  return SKILL_FORMS[slug] || null;
}

// Get default config for a skill
export function getDefaultConfig(slug: string): Record<string, unknown> {
  return SKILL_FORMS[slug]?.defaultConfig || {};
}
