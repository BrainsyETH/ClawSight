import { RetryConfig } from "./config";

export interface ActivityEventPayload {
  event_type: string;
  skill_slug?: string;
  session_id?: string;
  event_data: Record<string, unknown>;
  occurred_at: string;
}

/**
 * x402-aware HTTP client for the ClawSight API.
 *
 * Handles:
 * - Automatic x402 payment flow (402 → sign → retry)
 * - Exponential backoff on failure
 * - Idempotency keys on POST requests
 */
export class ApiClient {
  private baseUrl: string;
  private retry: RetryConfig;

  constructor(baseUrl: string, retry: RetryConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.retry = retry;
  }

  async syncEvents(events: ActivityEventPayload[]): Promise<boolean> {
    return this.post("/v1/api/sync", {
      events,
      idempotency_key: crypto.randomUUID(),
    });
  }

  async heartbeat(status: string, sessionId?: string): Promise<boolean> {
    return this.post("/v1/api/heartbeat", { status, session_id: sessionId });
  }

  async getSkillConfigs(): Promise<Record<string, unknown>[] | null> {
    return this.get("/v1/api/skills");
  }

  async updateConfigSyncStatus(
    skillSlug: string,
    status: "applied" | "failed",
    error?: string
  ): Promise<boolean> {
    return this.post("/v1/api/config/status", {
      skill_slug: skillSlug,
      sync_status: status,
      sync_error: error,
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // HTTP helpers with retry + x402
  // ----------------------------------------------------------

  private async post(path: string, body: unknown): Promise<boolean> {
    return this.request("POST", path, body);
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await this.fetchWithRetry("GET", path);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<boolean> {
    try {
      const res = await this.fetchWithRetry(method, path, body);
      return res.ok;
    } catch {
      return false;
    }
  }

  private async fetchWithRetry(
    method: string,
    path: string,
    body?: unknown
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retry.max_attempts; attempt++) {
      try {
        let res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });

        // Handle x402 payment flow
        if (res.status === 402) {
          const paymentHeader = await this.signPayment(res);
          if (paymentHeader) {
            res = await fetch(`${this.baseUrl}${path}`, {
              method,
              headers: {
                "Content-Type": "application/json",
                "X-Payment": paymentHeader,
              },
              body: body ? JSON.stringify(body) : undefined,
            });
          }
        }

        if (res.ok || (res.status >= 400 && res.status < 500)) {
          return res;
        }

        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err as Error;
      }

      // Exponential backoff
      if (attempt < this.retry.max_attempts - 1) {
        const delay = Math.min(
          this.retry.base_delay_ms * Math.pow(2, attempt),
          this.retry.max_delay_ms
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Sign an x402 payment using the agent's wallet.
   * In production, this reads the wallet key and signs a USDC transfer on Base L2.
   */
  private async signPayment(response: Response): Promise<string | null> {
    const price = response.headers.get("X-Payment-Required");
    if (!price) return null;

    // TODO: Integrate with OpenClaw wallet to sign actual USDC payment
    // This is a placeholder for the x402 signing flow:
    // 1. Parse price from header
    // 2. Create USDC transfer transaction on Base L2
    // 3. Sign with agent wallet
    // 4. Return signed payment proof
    console.log(`[ClawSight] x402 payment required: ${price}`);

    return `x402-signed-payment-placeholder`;
  }
}
