# ClawSight MVP Review — Updated

**Reviewer:** Claude
**Date:** February 15, 2026
**Scope:** v2.0 specification (character-driven skill management GUI), incorporating scoping decisions made during planning.

---

## Context: Decisions Already Made

This review accounts for the following product decisions:

| Decision | Choice |
|----------|--------|
| Direction | v2.0 — GUI layer for skill management with character-driven UX |
| Marketplace | Deferred to v3. MVP focuses on skill configuration, not buying/selling. |
| Platform | Desktop-first (config editing), mobile for monitoring only. Native app later. |
| Character | Mrs. Claws is the default. Users can customize name, avatar, and switch between Fun/Professional modes. |
| ENS | Nice-to-have, not in MVP |
| Plugin distribution | GitHub repository |
| Priority skills | 8 custom config forms (Web Search, Memory/LanceDB, Slack, GitHub, Google Calendar, Discord, Crypto Trading, PDF Operations) + generic JSON editor for everything else |

---

## 1. What's Strong

**The pivot is the right call.** v2.0 has a larger addressable market than v1.0. "Make OpenClaw accessible to non-technical users" is a bigger opportunity than "give power users a monitoring dashboard." The character-driven UX is genuinely differentiating — nobody else in the AI agent space is doing this.

**The fun/professional toggle resolves the audience tension.** My earlier concern about Mrs. Claws alienating serious users is addressed. Shipping both modes from day one means you don't have to pick an audience.

**Deferring the marketplace is correct.** Building config management well is hard enough. The marketplace layer adds payment flows, creator payouts, content moderation, and discovery — all of which compound complexity. Get skill config right first.

**Desktop config + mobile monitoring is pragmatic.** Visual config editors need screen real estate. Trying to make complex form editors work on mobile would slow development and compromise the desktop experience.

---

## 2. Architecture Concerns for the Refined MVP

### 2.1 Config write-path is the riskiest technical assumption

The entire product depends on this flow:

```
Dashboard → API → Plugin → ~/.openclaw/openclaw.json → Hot reload
```

This chain has several failure points that the spec doesn't fully address:

**Problem 1: Plugin must poll for config changes.**
The plugin runs locally. The API stores config in Supabase. How does the plugin know a config change happened? Options:
- **Polling:** Plugin checks API every N seconds for config updates. Simple but adds latency and x402 cost.
- **Supabase Realtime in the plugin:** Plugin subscribes to config changes via WebSocket. Better UX but adds persistent connection overhead on the user's machine.
- **Dashboard → Plugin direct communication:** Dashboard sends changes directly to the plugin via localhost. Fastest but requires the plugin to run an HTTP server locally.

**Recommendation:** Use a hybrid. Dashboard writes to Supabase. Plugin subscribes to Supabase Realtime for config changes (WebSocket is lightweight). Fallback to polling every 60s if the WebSocket disconnects. Avoid running a local HTTP server in the plugin — it introduces security surface.

**Problem 2: Config format coupling.**
ClawSight stores config as JSONB in `skill_configs.config`. The plugin writes it to `~/.openclaw/openclaw.json`. If OpenClaw changes its config format, ClawSight breaks silently. There's no validation that the config ClawSight writes is actually valid for the target skill.

**Recommendation:**
1. The plugin should own the translation layer — read from API, validate against expected schema, write to OpenClaw format. Don't have the API write OpenClaw-format configs directly.
2. Add a `config_schema_version` field to `skill_configs` so you can detect and handle format migrations.
3. After writing config, the plugin should read it back from OpenClaw and confirm the hot-reload succeeded. Report success/failure to the API so the dashboard can show confirmation.

**Problem 3: Concurrent config edits.**
What if the user edits a skill config in the dashboard while also manually editing `openclaw.json`? Or if two browser tabs submit different configs?

**Recommendation:** Add an `updated_at` optimistic lock. When the dashboard submits a config change, include the `updated_at` timestamp it last read. If the server's `updated_at` is newer, reject the write with a conflict error. For local file conflicts, the plugin should detect external `openclaw.json` changes (file watcher) and sync them back to ClawSight, with the local file always winning in a conflict.

### 2.2 Custom config forms: build a form registry, not 8 bespoke components

Building 8 separate React components (one per skill) seems manageable but will create maintenance burden. Each form is slightly different but shares patterns: text inputs, sliders, toggles, dropdowns, currency fields.

**Better approach: Declarative form definitions.**

```typescript
// Define skill config forms as data, not components
const SKILL_FORMS: Record<string, SkillFormDefinition> = {
  web_search: {
    fields: [
      { key: "provider", type: "select", label: "Search provider",
        options: ["google", "bing", "duckduckgo"], default: "google" },
      { key: "api_key", type: "secret", label: "API key",
        placeholder: "sk-..." },
      { key: "max_results", type: "number", label: "Max results per query",
        min: 1, max: 50, default: 10 },
    ]
  },
  slack: {
    fields: [
      { key: "bot_token", type: "secret", label: "Bot token" },
      { key: "default_channel", type: "text", label: "Default channel",
        placeholder: "#general" },
      { key: "notify_on_error", type: "toggle",
        label: "Send me errors in Slack", default: true },
    ]
  },
  // ... 6 more
};
```

Then build **one** generic `<SkillConfigForm definition={SKILL_FORMS[slug]} />` renderer. Benefits:
- Adding new skills = adding data, not writing components
- Consistent UX across all skill forms
- Easier to test (test the renderer once, test data separately)
- Path to JSON Schema-driven forms later (community-contributed schemas become form definitions)

For the generic JSON editor fallback, use Monaco Editor (same as VS Code) with JSON validation.

### 2.3 Skill installation needs a defined contract with OpenClaw

"One-click install" from the ClawHub browser assumes the plugin can trigger `clawhub install <skill-slug>`. This raises questions:

- **Does `clawhub install` require user interaction?** (y/n prompts, license acceptance)
- **Can it run while the Gateway is active?** Or does installation require a restart?
- **What happens if installation fails?** (network error, incompatible version, missing dependencies)
- **How does ClawSight know what's already installed?** Does it read the filesystem, or does OpenClaw expose an API?

**Recommendation:** Before building the skill browser, write a proof-of-concept that:
1. Reads the list of installed skills from `~/.openclaw/openclaw.json`
2. Calls `clawhub install <slug>` programmatically
3. Verifies the skill appears in the installed list
4. Handles at least one failure case (skill not found, network error)

If any of these steps require user interaction or Gateway restart, the "one-click install" UX needs to be redesigned as "request install → user confirms on their machine."

### 2.4 The schema needs adjustments for the refined scope

The proposed schema in the conversation is close, but needs refinement:

```sql
-- ISSUE 1: display_mode should be on users, not agents
-- A user's preference for fun/professional affects the whole UI, not one agent.
CREATE TABLE users (
  wallet_address TEXT PRIMARY KEY,
  display_mode TEXT DEFAULT 'fun' CHECK (display_mode IN ('fun', 'professional')),
  agent_name TEXT DEFAULT 'Mrs. Claws',
  avatar_style TEXT DEFAULT 'lobster',
  avatar_color TEXT DEFAULT '#FF6B6B',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ISSUE 2: agents table may be premature if MVP is single-agent.
-- If one wallet = one agent for MVP, merge agent fields into users.
-- Add agents table later when multi-agent is needed.

-- ISSUE 3: skill_configs needs a "source" field
-- Track whether config came from ClawSight UI, manual file edit, or future preset
CREATE TABLE skill_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES users(wallet_address),
  skill_slug TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  config_source TEXT DEFAULT 'manual'
    CHECK (config_source IN ('clawsight', 'manual', 'preset', 'default')),
  config_schema_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, skill_slug)
);

-- ISSUE 4: activity_events needs a session_id for grouping
-- Without this, the activity feed is a flat timeline with no way to
-- show "Session: 4h 23m" or group events by session.
CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  skill_slug TEXT,
  session_id TEXT, -- Groups events into agent sessions
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'tool_call', 'message_sent', 'payment', 'error',
      'status_change', 'skill_installed', 'config_changed'
    )),
  event_data JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_activity_wallet_time
  ON activity_events (wallet_address, occurred_at DESC);
CREATE INDEX idx_activity_session
  ON activity_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_skill_configs_wallet
  ON skill_configs (wallet_address);
```

### 2.5 x402 cost modeling for the MVP feature set

With marketplace deferred, all revenue comes from x402 API calls. Let me recalculate costs based on the actual MVP feature set:

| Endpoint | Frequency (active user/day) | Price | Daily cost |
|----------|-----------------------------|-------|------------|
| POST /api/sync (activity) | ~100 events/day in batches of 50 = 2 calls | $0.0005 | $0.001 |
| POST /api/heartbeat | 1 per 30s × 16 active hours = 1,920 calls | $0.0001 | $0.192 |
| POST /api/config (write config) | ~2/day | $0.0005 | $0.001 |
| GET /api/skills (read configs) | ~5/day | $0.001 | $0.005 |
| GET /api/activity (dashboard load) | ~10/day | $0.001 | $0.01 |
| **Total** | | | **$0.209/day** |

**The heartbeat dominates at 92% of cost.** This is a problem — the least valuable operation (status ping) is the most expensive line item for users.

**Recommendations:**
1. **Make heartbeats free.** They're tiny writes (status enum + timestamp). Absorb the cost. A user who sees their agent status is a user who stays engaged.
2. **Charge for dashboard reads and config writes.** These are higher-value operations where the user is getting clear value.
3. **Revised daily cost without heartbeat fees:** ~$0.017/day = ~$0.51/month. Still profitable at 50+ users.
4. Alternative: **Bundle heartbeats into sync calls.** Include status in the activity sync payload. One endpoint, one payment, two purposes.

---

## 3. Product & UX Suggestions

### 3.1 Onboarding: 3 steps, not 9

Previous recommendation stands. But with the fun/professional toggle confirmed, the revised flow:

1. **Connect Wallet** (required — SIWE sign-in)
2. **Detect OpenClaw** (required — verify gateway connection, guide to install if missing)
3. **Choose your style** (one screen — "Fun" shows Mrs. Claws preview, "Professional" shows clean dashboard preview, pick one, done)
4. **Dashboard** (land here, with contextual prompts for name/avatar/first skill)

Step 3 is important because the mode toggle affects the entire UI. Better to ask once upfront than have users confused by a lobster they didn't expect.

### 3.2 The "My Skills" view needs a sync-state indicator

When a user toggles a skill on/off or saves a config, the change must propagate: Dashboard → API → Plugin → OpenClaw. This takes time and can fail. The UI needs to show:

- **Syncing...** (config submitted, waiting for plugin confirmation)
- **Applied** (plugin confirmed the config was written and hot-reloaded)
- **Failed** (plugin couldn't apply the config — show reason, offer retry)
- **Pending restart** (change requires Gateway restart — tell the user what to do)

Without this, users will toggle a skill, see no immediate effect, and toggle it again — potentially causing double-writes or confusion.

### 3.3 Fun/Professional mode affects more than UI text

The spec describes mode as a voice/tone toggle. But it should affect information density too:

| Element | Fun Mode | Professional Mode |
|---------|----------|-------------------|
| Agent greeting | "Good morning! I've been busy today." | Hidden |
| Skill card | "I follow @Dust and copy his moves" | "Polymarket copy trading — active" |
| Activity feed | Conversational descriptions | Compact log format |
| Dashboard density | Spacious, card-based, illustrative | Dense, table-based, data-forward |
| Avatar | Prominent, animated | Small icon or hidden |
| Empty state | Character speaking ("I don't have any skills yet!") | Standard "No skills configured" |

This means you're building **two UI variants**, not just swapping strings. Scope this carefully — for MVP, it may be enough to only toggle the text voice and avatar visibility, keeping the layout the same.

### 3.4 Skill browser needs a curated "featured" section

Browsing 3,000+ ClawHub skills is overwhelming. The spec mentions search and categories, but discovery UX matters more than search for new users.

**Recommendation for MVP:**
1. **Featured section:** Hand-pick 10-15 skills across categories. Update monthly.
2. **"Works great with ClawSight" badge:** Flag skills that have custom config forms in ClawSight.
3. **Category filters:** Trading, Productivity, Communication, Development, Smart Home.
4. **Search** as secondary navigation (most users won't know what to search for).

Don't try to replicate ClawHub's full catalog. Curate a focused selection that shows ClawSight's config editing at its best.

### 3.5 Define what "character customization" actually means for MVP

The decision is "users can customize character and mode." But how much customization?

**Suggested MVP scope:**
- **Name:** Free text input, defaults to "Mrs. Claws"
- **Avatar style:** 4-5 presets (Lobster, Robot, Pixel, Cat, Custom/Upload)
- **Avatar color:** Color picker (accent color applied to chosen style)
- **Mode:** Fun / Professional toggle

**Not in MVP:**
- Personality/voice customization (changes the first-person copy)
- Multiple saved characters
- Avatar animation options
- Character "backstory" or bios

Keep it to name + visual appearance + mode. Personality customization is a rabbit hole.

---

## 4. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenClaw plugin API doesn't support runtime config writes | Medium | Critical | Build proof-of-concept in week 1 before committing to full build |
| ClawHub has no browsable API for skill discovery | Medium | High | Fall back to curated list of skills. Don't depend on ClawHub API for MVP. |
| Hot-reload fails silently for some skills | Medium | High | Plugin must verify config was applied and report back to dashboard |
| Users don't fund x402 wallets | High | High | Make read endpoints free. Show value before requiring payment. |
| 8 custom config forms is too many for MVP timeline | Medium | Medium | Start with 3 (Web Search, Slack, GitHub). Add others if time allows. |
| Config format changes when OpenClaw updates | Medium | High | Version configs. Plugin handles migration between schema versions. |
| Desktop-only config editing limits adoption | Low (MVP) | Medium (long-term) | Acceptable for MVP. Mobile config editing in v2.5 or native app. |

---

## 5. Revised Roadmap Suggestion

### Phase 1: Foundation + Proof of Concept (Weeks 1-2)

**Critical path: Validate the config write-path before building UI.**

- [ ] Set up Supabase project with schema (users, skill_configs, activity_events)
- [ ] Implement SIWE authentication flow
- [ ] Build plugin skeleton with lifecycle hooks (before_tool_call, after_tool_call)
- [ ] **Proof of concept:** Plugin reads skill config from Supabase, writes to `openclaw.json`, triggers hot-reload, confirms success
- [ ] **Proof of concept:** Plugin detects manual `openclaw.json` edits and syncs back to Supabase
- [ ] Set up Next.js 14 project with Tailwind + shadcn/ui
- [ ] Landing page
- [ ] RLS policies on all tables

**Exit criteria:** Can change a skill config from Supabase console and see it applied in OpenClaw within 5 seconds.

### Phase 2: Core Dashboard (Weeks 3-4)

- [ ] Onboarding flow (3 steps: wallet, detect OpenClaw, choose mode)
- [ ] Home dashboard (status, activity summary, wallet balance)
- [ ] Activity feed with filtering (by event type, by skill)
- [ ] My Skills view (list installed skills, on/off toggles)
- [ ] Sync state indicators (syncing / applied / failed / pending restart)
- [ ] Agent customization (name, avatar preset, color, mode toggle)
- [ ] Plugin: session log parser + activity sync
- [ ] Plugin: heartbeat + status updates
- [ ] Fun/Professional mode toggle (text voice + avatar visibility)
- [ ] Error states and empty states for all views

### Phase 3: Skill Configuration (Weeks 5-6)

- [ ] Declarative form registry for skill configs
- [ ] Custom config forms for top 3 skills (Web Search, Slack, GitHub)
- [ ] Generic JSON editor (Monaco) for all other skills
- [ ] Config change → plugin sync → confirmation flow
- [ ] Skill browser (curated featured list, category filters, search)
- [ ] One-click skill installation via plugin
- [ ] Custom config forms for 3 more skills (Discord, Calendar, Crypto Trading)
- [ ] x402 payment integration on write endpoints

### Phase 4: Polish + Launch (Weeks 7-8)

- [ ] PWA setup for mobile monitoring
- [ ] Mobile-optimized read-only views (status, activity, wallet)
- [ ] PDF Operations + Memory/LanceDB config forms (skills 7-8)
- [ ] Rate limiting on API
- [ ] Plugin published to GitHub with installation docs
- [ ] Documentation site
- [ ] Launch to OpenClaw community

### Post-MVP Backlog

- Push notifications (error alerts, spending thresholds)
- Spending breakdown by service
- ENS name/avatar integration
- Memory metadata viewer
- Data export (GDPR compliance)
- JSON Schema-driven auto-form generation for community skills
- Native mobile app
- Config marketplace (v3)

---

## 6. Consolidated Quick Wins

These are low-effort changes that should be adopted regardless of timeline:

1. **API versioning:** Prefix all routes with `/v1/`. Do this in the Next.js route structure from day one.
2. **Heartbeats should be free.** They cost you nearly nothing and represent 92% of per-user x402 spend.
3. **`event_type` as CHECK constraint**, not a free string. Prevents garbage data from day one.
4. **`updated_at` on every mutable table** with automatic trigger. You will need this for conflict detection.
5. **Health check endpoint** (`GET /api/health`, free, no auth). Plugin uses this to verify connectivity before attempting syncs.
6. **`session_id` on activity events.** Without it, you can't show session duration or group events meaningfully.
7. **Merge `agents` into `users` for MVP.** One wallet = one agent simplifies everything. Add the `agents` table when multi-agent is a real requirement.
8. **Start with 3 custom config forms, not 8.** Web Search, Slack, and GitHub are enough to validate the form registry pattern. Add others incrementally.
9. **Build the form registry pattern from day one.** Declarative form definitions, generic renderer. Don't build 3 bespoke components.
10. **Log every config change** as an `activity_event` of type `config_changed`. Users need an audit trail of what changed and when.

---

## Summary

The refined MVP (v2.0 without marketplace, desktop-first, character customization) is a solid product. The highest-risk element is the **config write-path** (Dashboard → API → Plugin → OpenClaw hot-reload). Validate this in week 1 with a proof of concept before building UI.

The three things most likely to derail the timeline:
1. **OpenClaw's plugin API** doesn't support what you need for runtime config management
2. **Custom config forms** take longer than expected (solve with declarative form registry)
3. **x402 integration** adds unexpected complexity to every API call (solve by making reads and heartbeats free)

Ship the observability layer (status + activity + wallet) first, then layer skill config editing on top. Users will use the dashboard for monitoring even before the config editor is ready — that's your retention hook while you build the harder features.
