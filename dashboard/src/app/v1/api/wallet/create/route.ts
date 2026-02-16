import { NextRequest, NextResponse } from "next/server";
import { CdpClient } from "@coinbase/cdp-sdk";

/**
 * IP-based rate limiter for unauthenticated endpoints.
 * Wallet creation happens before the user has a session.
 */
const ipRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = ipRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimit.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

/**
 * POST /v1/api/wallet/create
 *
 * Creates a new EVM wallet via Coinbase Developer Platform (CDP).
 * The private key is managed by CDP in a Trusted Execution Environment (TEE) —
 * it never touches our server or the user's browser.
 *
 * Returns { address } on success.
 *
 * Rate-limited: 5 wallet creations per IP per hour.
 */
export async function POST(request: NextRequest) {
  // Rate limit by IP (pre-auth endpoint)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkIpRateLimit(ip, 5, 3_600_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  // Validate CDP credentials are configured
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    console.error("[wallet/create] CDP_API_KEY_ID or CDP_API_KEY_SECRET not configured");
    return NextResponse.json(
      { error: "Wallet service not configured. Contact support." },
      { status: 503 }
    );
  }

  try {
    const cdp = new CdpClient({
      apiKeyId,
      apiKeySecret,
      walletSecret: walletSecret || undefined,
    });

    // Create an EVM account on Base
    const account = await cdp.evm.createAccount();

    return NextResponse.json({
      address: account.address,
    });
  } catch (err) {
    console.error("[wallet/create] CDP wallet creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create wallet. Please try again." },
      { status: 500 }
    );
  }
}
