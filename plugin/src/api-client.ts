import { RetryConfig } from "./config";

export interface ActivityEventPayload {
  event_type: string;
  skill_slug?: string;
  session_id?: string;
  event_data: Record<string, unknown>;
  occurred_at: string;
}

/**
 * Wallet signer interface for x402 payments.
 * Implemented by the OpenClaw wallet integration.
 */
export interface WalletSigner {
  /** Sign a USDC transfer on Base L2 and return the signed transaction hex. */
  signUSDCTransfer(recipient: string, amountUsd: number): Promise<string>;
  /** Get the wallet address. */
  getAddress(): string;
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
  private walletSigner: WalletSigner | null = null;

  constructor(baseUrl: string, retry: RetryConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.retry = retry;
  }

  /**
   * Set the wallet signer for x402 payments.
   * Must be called after OpenClaw provides wallet access.
   */
  setWalletSigner(signer: WalletSigner): void {
    this.walletSigner = signer;
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
    const result = await this.get<{ configs: Record<string, unknown>[] }>("/v1/api/config");
    return result?.configs || null;
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
   *
   * x402 flow:
   * 1. Server responds with 402 + X-Payment-Required header
   * 2. Header format: "USDC <amount> <recipient_address>"
   * 3. Client signs a USDC transfer on Base L2
   * 4. Client retries request with X-Payment header containing signed tx
   */
  private async signPayment(response: Response): Promise<string | null> {
    const paymentHeader = response.headers.get("X-Payment-Required");
    if (!paymentHeader) return null;

    if (!this.walletSigner) {
      console.warn(
        "[ClawSight] x402 payment required but no wallet signer configured. " +
        "Payment amount:", paymentHeader
      );
      return null;
    }

    try {
      // Parse "USDC <amount> <recipient>" format
      const parts = paymentHeader.split(" ");
      if (parts.length < 3 || parts[0] !== "USDC") {
        console.error("[ClawSight] Invalid X-Payment-Required format:", paymentHeader);
        return null;
      }

      const amount = parseFloat(parts[1]);
      const recipient = parts[2];

      if (isNaN(amount) || amount <= 0) {
        console.error("[ClawSight] Invalid payment amount:", parts[1]);
        return null;
      }

      console.log(`[ClawSight] Signing x402 payment: $${amount} USDC to ${recipient}`);

      const signedTx = await this.walletSigner.signUSDCTransfer(recipient, amount);

      // Return payment proof as base64 JSON
      const proof = {
        type: "x402-payment",
        chain: "base",
        token: "USDC",
        amount: amount.toString(),
        recipient,
        signed_tx: signedTx,
        payer: this.walletSigner.getAddress(),
        timestamp: new Date().toISOString(),
      };

      return Buffer.from(JSON.stringify(proof)).toString("base64");
    } catch (err) {
      console.error("[ClawSight] x402 payment signing failed:", err);
      return null;
    }
  }
}
