# ClawSight MVP Specification Review

**Reviewer:** Claude (Automated Review)
**Date:** February 15, 2026
**Documents Reviewed:**
- `ClawSight_Product_Specification.docx` (v1.0 MVP — Observability Dashboard)
- `ClawSight_Specification_Final.docx` (v2.0 — GUI Layer for OpenClaw Skills)

---

## Overall Assessment

ClawSight has a clear product vision: make OpenClaw agents visible, manageable, and personal. The two specs represent a coherent evolution — v1.0 solves the "what is my agent doing?" problem, v2.0 expands into "how do I customize my agent?" Both are well-structured and show genuine understanding of the target user.

This review covers architectural concerns, specification gaps, monetization risks, and concrete suggestions for improvement.

---

## 1. Specification Coherence: v1.0 vs v2.0

### Problem: Two specs, unclear relationship

The repo contains two specifications with overlapping but divergent scopes. It's unclear whether v2.0 **replaces** v1.0 or **extends** it. Specific conflicts:

| Area | v1.0 MVP | v2.0 Final | Conflict |
|------|----------|------------|----------|
| Scope | Observability dashboard | Skill config + marketplace | Different products |
| MVP Timeline | 6 weeks | 8 weeks | Which timeline governs? |
| Database | 5 tables (agent-centric) | 6 tables (user-centric with `users` table) | Schema divergence |
| Core identity | Privacy-first monitoring | Character-based personalization | Different positioning |
| Agent table PK | `id` (UUID) | `id` with separate `users` table | Structural mismatch |

### Recommendation

Consolidate into a **single specification** with clear phases:
- **Phase 1 (MVP):** Observability core from v1.0 (status, activity, spending, privacy)
- **Phase 2:** Skill management and visual config from v2.0
- **Phase 3:** Marketplace and presets from v2.0

The v1.0 observability features are the stronger MVP because they solve an immediate pain point ("is my agent doing anything?") with less implementation risk than the marketplace. The character layer (Mrs. Claws) can be introduced in Phase 1 as a UI personality without requiring the full skill config system.

---

## 2. Architecture & Technical Concerns

### 2.1 x402 as the sole monetization layer — High Risk

**The concern:** Every API call requires a 402 → payment → retry round-trip. This has significant implications:

- **Latency:** Each API call requires at minimum 3 HTTP round-trips (initial request → 402 response → payment signing → retry with payment header → facilitator verification). For real-time features like heartbeats every 30 seconds, this adds meaningful overhead.
- **Failure modes:** If the x402 facilitator is down, the entire product is down. There's no fallback.
- **Wallet dependency:** The plugin requires the agent's wallet to have USDC on Base L2 at all times. If the wallet is empty, the dashboard goes dark — even for read operations like checking status.
- **Cold start problem:** New users who haven't funded their x402 wallet can't even see the dashboard. This directly conflicts with the "Curious Experimenter" persona defined in v1.0.

**Suggestions:**
1. **Free tier for reads:** Make `GET /api/activity` and `GET /api/wallet` free (or auth-gated without payment) for the first N requests per day. Let users see value before paying.
2. **Batch payments:** Instead of per-request micropayments, implement a prepaid credit system. User deposits $1 USDC, gets 1000 API credits. Eliminates per-call 402 negotiation overhead.
3. **Graceful degradation:** If payment fails, serve cached/stale data with a "last updated X minutes ago" indicator rather than blocking entirely.
4. **Heartbeat should be free or bundled:** At $0.0001 per heartbeat × every 30 seconds, that's $0.29/day just for status updates. This is 19% of the "light user" monthly budget ($0.50/month) spent on a single feature. Consider making heartbeats free and monetizing higher-value operations.

### 2.2 Plugin Architecture — Missing error handling and resilience

The plugin spec defines lifecycle hooks and a sync client but doesn't address:

- **Offline behavior:** What happens when the user's machine has no internet? Events should be queued locally and batch-synced on reconnect.
- **Retry logic:** No retry strategy is defined for failed API calls or payment failures.
- **Plugin versioning:** No mechanism for the API to reject outdated plugin versions or negotiate capabilities.
- **Rate limiting:** No client-side rate limiting. A misconfigured `heartbeat_interval_seconds: 1` could drain the wallet rapidly.
- **Idempotency:** `POST /api/sync` has no idempotency key. Network retries could create duplicate events.

**Suggestions:**
1. Add an offline event queue with configurable max size (e.g., 1000 events).
2. Define exponential backoff for all API calls (2s, 4s, 8s, max 60s).
3. Add a `plugin_version` field to all API requests; allow the server to return a `426 Upgrade Required` response.
4. Enforce minimum heartbeat interval (30s) in plugin code, regardless of config.
5. Add an `idempotency_key` (UUID) to `/api/sync` requests.

### 2.3 Supabase Realtime for dashboard updates — Scalability concern

The spec relies on Supabase Realtime for live dashboard updates. This is fine for the MVP, but consider:

- **Supabase Realtime has connection limits** (500 concurrent on Pro plan). At scale, this becomes a bottleneck.
- **RLS + Realtime can be slow.** Every broadcast through Realtime with RLS enabled hits the database. For high-frequency events (heartbeats, activity), this could cause latency.

**Suggestion:** For MVP this is acceptable. Plan for a migration path to a dedicated WebSocket server or SSE (Server-Sent Events) if you exceed 200-300 concurrent dashboard users.

### 2.4 Database Schema Issues

**v1.0 Schema:**
- `agents` table uses `wallet_address` as a field but there's no dedicated `users` table. This means if a user has multiple agents (the schema implies this is possible), there's no clean way to store user-level preferences.
- `transactions` table stores `is_clawsight` as a boolean — this is a leaky abstraction. Use a `source` enum (`clawsight`, `external`, `agent`) instead, since you'll likely want to distinguish more categories later.
- `memory_metadata` stores `file_path` — this is a potential privacy leak. File paths can reveal directory structures, usernames, and project names. Consider hashing or normalizing paths.

**v2.0 Schema:**
- `config_presets` has `installs` (integer counter) and `rating` (numeric). Direct counter/average fields are prone to race conditions. Use a separate `preset_reviews` table and compute aggregates.
- `skill_configs` uses `skill_slug` as a string identifier but there's no validation that it maps to an actual ClawHub skill. Consider a `skills` reference table or validate against ClawHub's API.

**Suggestions:**
1. Add a `users` table from the start (v2.0 has this right, v1.0 doesn't).
2. Replace `is_clawsight` with `source` enum.
3. Hash `file_path` in `memory_metadata` or store only the filename (not full path).
4. Use a `preset_reviews` table instead of denormalized counters.
5. Add `updated_at` timestamps to all mutable tables.
6. Add database indexes on: `activity_events(wallet_address, occurred_at)`, `transactions(wallet_address, created_at)`, `skill_configs(wallet_address, skill_slug)`.

### 2.5 Authentication: SIWE is right, but JWT in httpOnly cookie needs more detail

The SIWE approach is correct for the target audience. However:

- **Session refresh:** 7-day expiry with no refresh mechanism means users get logged out weekly. Define a silent refresh flow.
- **Plugin auth vs. dashboard auth:** These are two different auth flows (API key vs. SIWE) but the spec doesn't clarify how they're linked. Can anyone with a plugin API key impersonate the user?
- **API key generation:** "Generated on setup, stored locally" — where exactly? Is it encrypted at rest? What happens if the file is readable by other processes?

**Suggestions:**
1. Implement sliding window sessions: refresh the JWT on every authenticated request, keeping the 7-day window rolling.
2. Define the plugin API key as a scoped token — it should only allow write access to the specific agent's data, not full account access.
3. Store the API key in the OS keychain (macOS Keychain, Linux secret-service) rather than a plaintext config file.

---

## 3. Product & UX Concerns

### 3.1 The Mrs. Claws character — Bold but risky

The character-based UX is the most distinctive aspect of ClawSight. It's also the highest-risk design decision:

**Strengths:**
- Genuinely differentiating. No competitor does this.
- Makes the product memorable and shareable.
- First-person agent voice ("I've been busy today") creates emotional connection.

**Risks:**
- **Audience mismatch:** The v1.0 persona is a "technically comfortable" power user. Lobster characters may feel unserious to this audience.
- **Customization complexity:** Avatar systems (preset styles, color pickers, ENS avatar import) are deceptively expensive to build well. This is scope creep for an MVP.
- **Cultural assumptions:** "Santa's wife, but a lobster" is charming but very niche. International users may not connect with the reference.

**Suggestions:**
1. For MVP, ship Mrs. Claws as a **fixed brand mascot** (like Clippy or the GitHub Octocat), not a customizable character system. Show her in the UI, use first-person voice, but don't build the avatar editor yet.
2. Keep the character personality in the UI copy. This is cheap to implement and high-impact.
3. Defer the full customization system (name, avatar, color) to Phase 2 when you have user feedback on whether people want it.

### 3.2 Onboarding: 9 steps is too many

The v2.0 onboarding has 9 steps. Even with "skippable everything," this creates friction:

- Step 1 (Connect Wallet) — required, correct
- Step 2 (Detect OpenClaw) — required, correct
- Steps 3-8 — all skippable, which means they're probably not essential

**The "skippable" pattern is an anti-pattern.** If most users will skip a step, that step shouldn't be in the onboarding flow. It should be discoverable in-app.

**Suggestion:** Reduce onboarding to 3 steps:
1. **Connect Wallet** (required)
2. **Detect OpenClaw** (required, with install guidance if missing)
3. **Dashboard** (land directly, with contextual prompts to customize)

Move name, avatar, budget, and first skill to progressive disclosure — nudge the user from within the dashboard when contextually relevant (e.g., "Want to name your agent?" as a dismissable card on the dashboard).

### 3.3 Memory Inspector — Underspecified

Both specs mention memory metadata as a feature, but it's the least defined:

- What does the memory view actually show? A list of filenames and timestamps is not very useful on its own.
- What actions can a user take? Can they delete a memory? Request the agent forget something?
- How does this interact with privacy if memory filenames contain sensitive information?

**Suggestion:** Either spec this out fully (what the UI shows, what actions are available, how deletion works) or defer it to post-MVP. The observability value of memory metadata is lower than activity feed and spending — those should be the priority.

### 3.4 Missing: Error states and empty states

Neither spec defines what the user sees when:
- The agent is offline and has never synced (first-time empty state)
- The wallet has insufficient funds
- The plugin fails to connect
- The API is unreachable
- A skill installation fails

**Suggestion:** Define at minimum the following empty/error states:
1. **No agent connected** — "Install the ClawSight plugin to get started" with setup guide
2. **Agent offline** — Show last-known state with "last seen X ago" timestamp
3. **Empty wallet** — "Fund your wallet to enable syncing" with link to Base bridge
4. **API unreachable** — "Showing cached data from [timestamp]"
5. **No activity yet** — "Your agent hasn't done anything yet. Here's how to get started."

---

## 4. Monetization Analysis

### 4.1 Revenue projections are optimistic

The v2.0 spec projects 10,000 users generating $330,000/year. This assumes:
- 10,000 installs of an OpenClaw plugin for a product that doesn't exist yet
- Average $1.50/month in x402 spending per user (requires funded wallets)
- $150,000/year in marketplace revenue (requires a thriving preset economy)

**Reality check:** OpenClaw itself is early-stage. The total addressable market for "OpenClaw users who want a dashboard and will pay micropayments" is likely in the hundreds, not thousands, at launch.

**Suggestion:** Model revenue conservatively:
- **Month 1:** 20-30 users, $30-50 revenue
- **Month 3:** 50-100 users, $100-200 revenue
- **Month 6:** 150-300 users, $300-600 revenue

This is still profitable given the $50/month infrastructure cost, but sets realistic expectations.

### 4.2 Marketplace economics need a critical mass

The preset marketplace (15% commission on config sales) is potentially the strongest revenue stream, but it has a classic **chicken-and-egg problem:**
- Buyers won't come without presets to browse.
- Sellers won't create presets without buyers.

**Suggestions:**
1. **Seed the marketplace** with 10-20 free and premium presets created by the team before launch.
2. **Feature top creators** prominently to incentivize early sellers.
3. **Don't launch the marketplace in MVP.** Focus on observability and manual skill config first. Add marketplace in Phase 2 once you have users who understand the config system.

### 4.3 The x402 pricing table needs a "why"

The spec lists prices ($0.0001 for heartbeat, $0.001 for activity feed) but doesn't explain the rationale. Are these based on Supabase costs? Competitive benchmarks? Round numbers?

**Suggestion:** Document the pricing rationale:
- What is the infrastructure cost per API call? (Supabase Edge Function invocation + DB query)
- What margin is being applied? (e.g., 10x cost, 100x cost)
- How do prices compare to alternatives? (e.g., Datadog per-host pricing, Grafana Cloud per-metric pricing)

This helps with future pricing decisions and makes price changes defensible.

---

## 5. Security Concerns

### 5.1 RLS policy has a performance concern

The example RLS policy uses a subquery:
```sql
CREATE POLICY "Users can only view their own events"
  ON activity_events FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE wallet_address = auth.jwt()->>'wallet_address'
    )
  );
```

This subquery runs on every row evaluation. For tables with millions of rows, this will be slow.

**Suggestion:** Denormalize `wallet_address` onto `activity_events` directly and use a simple equality check:
```sql
CREATE POLICY "Users can only view their own events"
  ON activity_events FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');
```

### 5.2 No rate limiting defined

Neither spec mentions API rate limiting. Without it:
- A buggy plugin could send thousands of requests per second.
- A malicious actor could use a valid wallet to flood the database.
- x402 payments don't inherently rate-limit — they just require payment.

**Suggestion:** Implement rate limits per wallet address:
- Heartbeat: max 1 per 15 seconds
- Sync: max 10 per minute
- Dashboard reads: max 60 per minute

### 5.3 Event data is stored as JSONB — injection risk

`event_data` in `activity_events` is unstructured JSONB. If the plugin sends arbitrary JSON and the dashboard renders it without sanitization, this is an XSS vector.

**Suggestion:**
1. Validate `event_data` against a JSON Schema on the server side.
2. Sanitize all JSONB content before rendering in the dashboard.
3. Define allowed `event_type` values as an enum, not a free string.

---

## 6. Missing from Both Specs

| Missing Element | Impact | Priority |
|----------------|--------|----------|
| **Data retention policy** | How long are activity events stored? Forever? 30 days? User-configurable? | High |
| **Data export** | GDPR requires data portability. Users should be able to export all their data. | High |
| **Multi-agent support** | Both schemas imply multiple agents per wallet, but the UX is designed for a single agent. Clarify. | Medium |
| **Plugin update mechanism** | How does the plugin update itself? Manual reinstall? Auto-update? | Medium |
| **Accessibility (a11y)** | No mention of keyboard navigation, screen readers, color contrast, or ARIA labels. | Medium |
| **Internationalization (i18n)** | No mention of language support. "Mrs. Claws" and first-person English copy don't translate well. | Low (MVP) |
| **Disaster recovery** | What happens if Supabase goes down? Backup strategy? | Medium |
| **API versioning** | No `/v1/` prefix on endpoints. Breaking changes will be painful. | High |
| **Testing strategy** | No mention of unit tests, integration tests, or E2E tests. | High |
| **Monitoring/alerting for the service itself** | Who monitors ClawSight? How do you know if the API is down? | Medium |
| **Terms of service / privacy policy** | Required for any product handling financial data (USDC transactions). | High |

---

## 7. Suggested Revised MVP Scope

Based on this review, here's a recommended MVP that reduces risk while preserving the core value proposition:

### Phase 1 — MVP (4 weeks)

**Plugin:**
- Lifecycle hooks (onStart, onStop, onToolCall, onError)
- Session log parser → activity event sync
- Heartbeat for status
- Offline event queue with batch sync
- Local config file with sync toggles

**API:**
- Supabase schema: `users`, `agents`, `activity_events`, `transactions`
- SIWE auth with sliding window sessions
- x402 middleware on write endpoints; reads are free for MVP
- Rate limiting per wallet
- API versioned under `/v1/`

**Dashboard:**
- Status indicator (online/thinking/idle/offline)
- Activity feed (filterable by event type)
- Wallet balance + daily/weekly spending
- Mrs. Claws branding (fixed mascot, first-person copy)
- Error states and empty states
- PWA shell

**Not in MVP (defer to Phase 2):**
- Skill configuration UI
- Avatar customization
- Preset marketplace
- Memory metadata
- Push notifications
- Spending breakdown by service (use simple total for MVP)
- ENS integration (nice-to-have, not essential)

### Phase 2 — Skill Management (3 weeks)
- Visual skill config editor
- My Skills view with toggles
- Spending breakdown by service
- ENS name/avatar integration
- Push notifications

### Phase 3 — Marketplace (3 weeks)
- Preset creation and publishing
- Preset browsing and purchasing
- 15% commission system
- Premium first-party presets
- Creator profiles

---

## 8. Quick Wins — Low effort, high impact

1. **Add `/v1/` prefix to all API routes now.** Costs nothing, saves pain later.
2. **Define `event_type` as an enum** (`tool_call`, `message_sent`, `payment`, `error`, `status_change`) rather than a free string.
3. **Add `created_at` and `updated_at` to every table** with default values. You'll thank yourself later.
4. **Add a `data_retention_days` column to `users`** with a default of 90 days. Run a daily cleanup job.
5. **Make the `/api/usage` endpoint return spending against limits** — this is the most important self-service debugging tool for users who think they're being overcharged.
6. **Define a plugin health-check endpoint** (`GET /api/health`, free, no auth) so the plugin can verify connectivity before syncing.
7. **Add request/response logging on the API** from day one. When a user reports "my events aren't showing up," you need to be able to trace the request.

---

## Summary

ClawSight has strong product instincts — the privacy-first positioning, the x402 micropayment model, and the character-based UX are all genuine differentiators. The main risks are:

1. **Scope creep** between two divergent specs — consolidate into one phased plan.
2. **x402-only monetization** creating friction for new users — add a free tier for reads.
3. **Marketplace chicken-and-egg** — defer to Phase 3, seed with first-party content.
4. **Missing operational basics** — rate limiting, data retention, API versioning, error states.

The strongest path to launch is a lean observability MVP (status + activity + spending) with the Mrs. Claws personality baked into the UI copy, followed by skill management and marketplace as separate phases informed by real user feedback.
