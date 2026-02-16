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
 * Minimum interval enforced at 30 seconds to prevent wallet drain.
 */
export class Heartbeat {
  private api: ApiClient;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentStatus: string = "online";
  private currentSessionId?: string;
  private onCapExceeded?: CapExceededCallback;
  private _lastSpending: HeartbeatResponse["spending"] | null = null;

  constructor(api: ApiClient, intervalSeconds: number, onCapExceeded?: CapExceededCallback) {
    this.api = api;
    this.intervalMs = Math.max(intervalSeconds, 30) * 1000;
    this.onCapExceeded = onCapExceeded;
  }

  start(sessionId?: string): void {
    this.currentSessionId = sessionId;
    this.stop();

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

  /** Last known spending status from most recent heartbeat. */
  get lastSpending(): HeartbeatResponse["spending"] | null {
    return this._lastSpending;
  }

  private async send(): Promise<void> {
    const result = await this.api.heartbeat(this.currentStatus, this.currentSessionId);

    if (result?.spending) {
      this._lastSpending = result.spending;

      if (result.spending.cap_exceeded && this.onCapExceeded) {
        this.onCapExceeded(result.spending);
      }
    }
  }
}
