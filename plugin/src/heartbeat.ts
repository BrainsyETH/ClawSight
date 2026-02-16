import { ApiClient, HeartbeatResponse } from "./api-client";

export type CapExceededCallback = (spending: HeartbeatResponse["spending"]) => void;

/**
 * Periodic heartbeat to keep agent status updated.
 *
 * Sends a lightweight status ping every N seconds.
 * The server responds with compute billing and spending cap status.
 * If cap_exceeded is true, fires the onCapExceeded callback so the
 * plugin can gracefully pause the agent before the server hard-stops it.
 *
 * Exponential backoff: on consecutive failures, the interval doubles
 * (up to 5 minutes) to avoid hammering an unavailable server.
 * Resets to normal interval on first successful heartbeat.
 *
 * Minimum interval enforced at 30 seconds to prevent wallet drain.
 */
export class Heartbeat {
  private api: ApiClient;
  private baseIntervalMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentStatus: string = "online";
  private currentSessionId?: string;
  private onCapExceeded?: CapExceededCallback;
  private _lastSpending: HeartbeatResponse["spending"] | null = null;
  private consecutiveFailures = 0;
  private readonly maxBackoffMs = 5 * 60 * 1000; // 5 minutes

  constructor(api: ApiClient, intervalSeconds: number, onCapExceeded?: CapExceededCallback) {
    this.api = api;
    this.baseIntervalMs = Math.max(intervalSeconds, 30) * 1000;
    this.onCapExceeded = onCapExceeded;
  }

  start(sessionId?: string): void {
    this.currentSessionId = sessionId;
    this.consecutiveFailures = 0;
    this.stop();

    // Send initial heartbeat immediately
    this.send();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  setStatus(status: string): void {
    this.currentStatus = status;
  }

  /** Last known spending status from most recent heartbeat. */
  get lastSpending(): HeartbeatResponse["spending"] | null {
    return this._lastSpending;
  }

  private scheduleNext(): void {
    if (this.timer) clearTimeout(this.timer);

    const delay =
      this.consecutiveFailures === 0
        ? this.baseIntervalMs
        : Math.min(
            this.baseIntervalMs * Math.pow(2, this.consecutiveFailures),
            this.maxBackoffMs
          );

    this.timer = setTimeout(() => this.send(), delay);
  }

  private async send(): Promise<void> {
    const result = await this.api.heartbeat(this.currentStatus, this.currentSessionId);

    if (result?.spending) {
      this._lastSpending = result.spending;
      this.consecutiveFailures = 0; // Reset backoff on success

      if (result.spending.cap_exceeded && this.onCapExceeded) {
        this.onCapExceeded(result.spending);
      }
    } else {
      this.consecutiveFailures++;
      if (this.consecutiveFailures === 1) {
        console.warn("[ClawSight] Heartbeat failed, will retry with backoff");
      }
    }

    this.scheduleNext();
  }
}
