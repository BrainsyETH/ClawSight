import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthenticatedWallet } from "./supabase";

/**
 * API route authentication middleware.
 * Validates the session and extracts the wallet address.
 *
 * Usage in route handlers:
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth; // 401
 *   const { wallet, supabase } = auth;
 */
export async function requireAuth(_request: NextRequest) {
  const wallet = await getAuthenticatedWallet();

  if (!wallet) {
    return NextResponse.json(
      { error: "Unauthorized. Sign in with your wallet." },
      { status: 401 }
    );
  }

  const supabase = await createServerSupabaseClient();

  return { wallet, supabase };
}

// ============================================================
// Rate limiting — in-memory sliding window with daily cap backup.
//
// The in-memory map resets on cold start, but the per-wallet
// daily call count in usage_daily_summary persists across restarts
// and is the authoritative cap for billing. This two-layer approach
// means an attacker timing cold starts still can't exceed the
// daily billing cap.
// ============================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  wallet: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const key = `${wallet}:${endpoint}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// ============================================================
// SIWE nonce store — server-side nonce validation with expiry.
//
// Nonces are stored in-memory with a 5-minute TTL. Each nonce
// can only be used once (deleted after verification). This
// prevents replay attacks where a captured SIWE signature is
// reused to create unauthorized sessions.
//
// For production at scale, replace with Redis or a DB table.
// The in-memory store is acceptable for single-instance deploys
// and protects against the most common replay vectors.
// ============================================================

interface NonceEntry {
  createdAt: number;
}

const nonceStore = new Map<string, NonceEntry>();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_CLEANUP_INTERVAL = 60 * 1000;

// Periodic cleanup of expired nonces
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [nonce, entry] of nonceStore) {
      if (now - entry.createdAt > NONCE_TTL_MS) {
        nonceStore.delete(nonce);
      }
    }
  }, NONCE_CLEANUP_INTERVAL);
}

/**
 * Issue a nonce for SIWE. Returns a random string that the client
 * must embed in the SIWE message before signing.
 */
export function issueNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  nonceStore.set(nonce, { createdAt: Date.now() });
  return nonce;
}

/**
 * Verify and consume a nonce. Returns true if the nonce is valid
 * (exists and not expired). Deletes the nonce after use to prevent replay.
 */
export function consumeNonce(nonce: string): boolean {
  const entry = nonceStore.get(nonce);
  if (!entry) return false;

  // Expired
  if (Date.now() - entry.createdAt > NONCE_TTL_MS) {
    nonceStore.delete(nonce);
    return false;
  }

  // Consume — delete to prevent replay
  nonceStore.delete(nonce);
  return true;
}
