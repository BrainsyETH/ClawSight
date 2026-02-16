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
 * Returns the user's existing agent wallet if one is already persisted
 * in the DB. Otherwise creates a new EVM wallet via Coinbase Developer
 * Platform (CDP), persists it, and returns it.
 *
 * This prevents orphaned wallets from being created on every incomplete
 * onboarding attempt.
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

  // If the caller is authenticated, check if they already have an agent wallet
  try {
    const { createServerSupabaseClient, getAuthenticatedWallet } = await import("@/lib/server/supabase");
    const ownerWallet = await getAuthenticatedWallet();
    if (ownerWallet) {
      const supabase = await createServerSupabaseClient();
      const { data: user } = await supabase
        .from("users")
        .select("agent_wallet_address")
        .eq("wallet_address", ownerWallet)
        .single();

      if (user?.agent_wallet_address) {
        // Already has a wallet — return it instead of creating a new one
        return NextResponse.json({
          address: user.agent_wallet_address,
          existing: true,
        });
      }
    }
  } catch {
    // Auth check failed — continue to create a new wallet
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
    const agentAddress = account.address.toLowerCase();

    // Persist agent wallet address to DB if caller is authenticated
    try {
      const { createServerSupabaseClient, getAuthenticatedWallet } = await import("@/lib/server/supabase");
      const ownerWallet = await getAuthenticatedWallet();
      if (ownerWallet) {
        const supabase = await createServerSupabaseClient();
        await supabase
          .from("users")
          .update({ agent_wallet_address: agentAddress })
          .eq("wallet_address", ownerWallet);
      }
    } catch {
      // Non-critical — onboarding PATCH is the backup
    }

    return NextResponse.json({
      address: agentAddress,
    });
  } catch (err) {
    console.error("[wallet/create] CDP wallet creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create wallet. Please try again." },
      { status: 500 }
    );
  }
}
