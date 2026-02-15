import { ApiClient, ActivityEventPayload } from "./api-client";

/**
 * Offline-capable event queue.
 *
 * Buffers activity events locally and batch-syncs to the API.
 * If the API is unreachable, events are queued until connectivity returns.
 */
export class EventQueue {
  private queue: ActivityEventPayload[] = [];
  private api: ApiClient;
  private batchSize: number;
  private maxSize: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(api: ApiClient, batchSize: number, maxSize: number) {
    this.api = api;
    this.batchSize = batchSize;
    this.maxSize = maxSize;

    // Auto-flush every 10 seconds
    this.flushTimer = setInterval(() => this.flush(), 10_000);
  }

  enqueue(event: ActivityEventPayload): void {
    if (this.queue.length >= this.maxSize) {
      // Drop oldest events when full
      this.queue.shift();
      console.warn("[ClawSight] Event queue full, dropping oldest event");
    }
    this.queue.push(event);

    // Flush immediately if batch size reached
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    const success = await this.api.syncEvents(batch);

    if (!success) {
      // Put events back at the front of the queue
      this.queue.unshift(...batch);
      console.warn(
        `[ClawSight] Sync failed, ${this.queue.length} events queued`
      );
    }
  }

  get size(): number {
    return this.queue.length;
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
