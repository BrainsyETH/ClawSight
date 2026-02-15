import { ApiClient } from "./api-client";

/**
 * Periodic heartbeat to keep agent status updated.
 *
 * Sends a lightweight status ping every N seconds.
 * Minimum interval enforced at 30 seconds to prevent wallet drain.
 */
export class Heartbeat {
  private api: ApiClient;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentStatus: string = "online";
  private currentSessionId?: string;

  constructor(api: ApiClient, intervalSeconds: number) {
    this.api = api;
    // Enforce minimum 30s interval
    this.intervalMs = Math.max(intervalSeconds, 30) * 1000;
  }

  start(sessionId?: string): void {
    this.currentSessionId = sessionId;
    this.stop(); // Clear any existing timer

    // Send initial heartbeat immediately
    this.send();

    this.timer = setInterval(() => this.send(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setStatus(status: string): void {
    this.currentStatus = status;
  }

  private async send(): Promise<void> {
    await this.api.heartbeat(this.currentStatus, this.currentSessionId);
  }
}
