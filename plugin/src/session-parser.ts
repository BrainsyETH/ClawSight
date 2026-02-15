import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { EventQueue } from "./event-queue";

/**
 * Parses OpenClaw JSONL session logs into activity events.
 *
 * Watches the session log directory for new files and streams
 * events into the queue as they're written.
 */
export class SessionParser {
  private queue: EventQueue;
  private watcher: fs.FSWatcher | null = null;
  private watching: Set<string> = new Set();

  constructor(queue: EventQueue) {
    this.queue = queue;
  }

  /**
   * Start watching the session log directory for new log files.
   */
  watchDirectory(logDir: string): void {
    if (!fs.existsSync(logDir)) {
      console.warn(`[ClawSight] Session log directory not found: ${logDir}`);
      return;
    }

    this.watcher = fs.watch(logDir, (eventType, filename) => {
      if (!filename || !filename.endsWith(".jsonl")) return;
      const filePath = path.join(logDir, filename);
      if (!this.watching.has(filePath)) {
        this.watching.add(filePath);
        this.tailFile(filePath);
      }
    });

    // Also process any existing log files
    const existing = fs.readdirSync(logDir).filter((f) => f.endsWith(".jsonl"));
    for (const file of existing) {
      const filePath = path.join(logDir, file);
      if (!this.watching.has(filePath)) {
        this.watching.add(filePath);
        this.tailFile(filePath);
      }
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Stream-reads a JSONL file line by line, parsing each line into an activity event.
   */
  private async tailFile(filePath: string): Promise<void> {
    try {
      const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
      const rl = readline.createInterface({ input: stream });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          this.processLogEntry(entry);
        } catch {
          // Skip malformed lines
        }
      }
    } catch (err) {
      console.error(`[ClawSight] Error reading log file ${filePath}:`, err);
    }
  }

  private processLogEntry(entry: Record<string, unknown>): void {
    const type = entry.type as string;
    if (!type) return;

    const eventMap: Record<string, string> = {
      tool_call: "tool_call",
      tool_result: "tool_call",
      message: "message_sent",
      error: "error",
      payment: "payment",
    };

    const eventType = eventMap[type];
    if (!eventType) return;

    this.queue.enqueue({
      event_type: eventType,
      skill_slug: entry.skill as string | undefined,
      session_id: entry.session_id as string | undefined,
      event_data: {
        tool: entry.tool_name,
        duration_ms: entry.duration_ms,
        message: entry.message || entry.error,
        amount: entry.amount,
        service: entry.service,
      },
      occurred_at:
        (entry.timestamp as string) || new Date().toISOString(),
    });
  }
}
