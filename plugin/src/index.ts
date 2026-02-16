/**
 * ClawSight Plugin — Main Entry Point
 *
 * Hooks into OpenClaw lifecycle events, syncs activity to ClawSight API,
 * manages skill configs, and maintains agent status heartbeats.
 */

import { ClawSightConfig, loadConfig } from "./config";
import { ApiClient } from "./api-client";
import { EventQueue } from "./event-queue";
import { Heartbeat } from "./heartbeat";
import { SessionParser } from "./session-parser";
import { ConfigSync } from "./config-sync";

// ============================================================
// Plugin lifecycle
// ============================================================

let config: ClawSightConfig;
let api: ApiClient;
let queue: EventQueue;
let heartbeat: Heartbeat;
let sessionParser: SessionParser;
let configSync: ConfigSync;

export async function activate(): Promise<void> {
  config = loadConfig();
  if (!config.enabled) return;

  api = new ApiClient(config.api_endpoint, config.retry);
  queue = new EventQueue(api, config.sync_batch_size, config.offline_queue_max_size);
  heartbeat = new Heartbeat(api, config.heartbeat_interval_seconds, (spending) => {
    console.warn(
      `[ClawSight] Spending cap exceeded: ${spending.warning}. ` +
      `Daily: $${spending.daily_spend.toFixed(4)}/$${spending.daily_cap.toFixed(2)}, ` +
      `Monthly: $${spending.monthly_spend.toFixed(4)}/$${spending.monthly_cap.toFixed(2)}. ` +
      `Agent operations will be paused until the cap resets or is increased.`
    );
  });
  sessionParser = new SessionParser(queue);
  configSync = new ConfigSync(api, config.api_endpoint);

  // Start background processes
  heartbeat.start();
  configSync.startListening();

  console.log("[ClawSight] Plugin activated");
}

export async function deactivate(): Promise<void> {
  heartbeat.stop();
  configSync.stopListening();
  await queue.flush();

  console.log("[ClawSight] Plugin deactivated");
}

// ============================================================
// OpenClaw lifecycle hooks
// ============================================================

export async function before_agent_start(context: {
  session_id: string;
}): Promise<void> {
  queue.enqueue({
    event_type: "status_change",
    event_data: { new_status: "online" },
    session_id: context.session_id,
    occurred_at: new Date().toISOString(),
  });
}

export async function after_agent_end(context: {
  session_id: string;
}): Promise<void> {
  queue.enqueue({
    event_type: "status_change",
    event_data: { new_status: "offline" },
    session_id: context.session_id,
    occurred_at: new Date().toISOString(),
  });
  await queue.flush();
}

export async function before_tool_call(context: {
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id: string;
}): Promise<void> {
  // Track the start time for duration measurement
  (context as Record<string, unknown>).__clawsight_start = Date.now();
}

export async function after_tool_call(context: {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: unknown;
  session_id: string;
  __clawsight_start?: number;
}): Promise<void> {
  const duration_ms = context.__clawsight_start
    ? Date.now() - context.__clawsight_start
    : undefined;

  queue.enqueue({
    event_type: "tool_call",
    skill_slug: inferSkillSlug(context.tool_name),
    event_data: {
      tool: context.tool_name,
      duration_ms,
    },
    session_id: context.session_id,
    occurred_at: new Date().toISOString(),
  });
}

export async function on_error(context: {
  error: Error;
  session_id: string;
}): Promise<void> {
  queue.enqueue({
    event_type: "error",
    event_data: {
      message: context.error.message,
      stack: context.error.stack?.split("\n").slice(0, 3).join("\n"),
    },
    session_id: context.session_id,
    occurred_at: new Date().toISOString(),
  });
}

// ============================================================
// Helpers
// ============================================================

function inferSkillSlug(toolName: string): string | undefined {
  const mappings: Record<string, string> = {
    web_search: "web_search",
    brave_search: "web_search",
    google_search: "web_search",
    slack_send: "slack",
    slack_read: "slack",
    github_pr: "github",
    github_issue: "github",
    calendar_read: "google_calendar",
    calendar_create: "google_calendar",
    discord_send: "discord",
    discord_read: "discord",
    trade: "crypto_trading",
    polymarket: "crypto_trading",
    pdf_read: "pdf",
    pdf_create: "pdf",
    memory_store: "memory",
    memory_recall: "memory",
  };
  return mappings[toolName];
}
