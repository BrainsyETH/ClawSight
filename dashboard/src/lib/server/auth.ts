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

/**
 * Rate limiting state (in-memory for MVP, Redis for production).
 */
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
