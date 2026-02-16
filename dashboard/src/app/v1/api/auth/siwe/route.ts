import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { SignJWT } from "jose";
import { createHash } from "crypto";
import { createAdminSupabaseClient } from "@/lib/server/supabase-admin";

/**
 * Derive a deterministic UUID from a wallet address so we can
 * always map the same wallet to the same Supabase auth user.
 */
function walletToUserId(wallet: string): string {
  const hash = createHash("sha256")
    .update(`clawsight:${wallet.toLowerCase()}`)
    .digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

/**
 * POST /v1/api/auth/siwe
 *
 * Accepts a signed SIWE message, verifies it server-side,
 * creates/finds the Supabase auth user, and returns a signed
 * JWT that works with Supabase RLS policies.
 */
export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json();

    if (!message || !signature) {
      return NextResponse.json(
        { error: "message and signature are required" },
        { status: 400 }
      );
    }

    // 1. Verify SIWE signature
    const siweMessage = new SiweMessage(message);
    let verifyResult: Awaited<ReturnType<SiweMessage["verify"]>>;
    try {
      verifyResult = await siweMessage.verify({ signature });
    } catch {
      return NextResponse.json(
        { error: "Invalid SIWE signature" },
        { status: 401 }
      );
    }

    if (!verifyResult.success) {
      return NextResponse.json(
        { error: "SIWE verification failed" },
        { status: 401 }
      );
    }

    const walletAddress = verifyResult.data.address.toLowerCase();
    const userId = walletToUserId(walletAddress);
    const email = `${walletAddress}@wallet.clawsight.app`;

    // 2. Ensure user exists in Supabase auth
    const admin = createAdminSupabaseClient();

    const { error: createError } = await admin.auth.admin.createUser({
      id: userId,
      email,
      email_confirm: true,
      user_metadata: { wallet_address: walletAddress },
      app_metadata: { wallet_address: walletAddress },
    });

    // Ignore "user already exists" errors
    if (createError && !createError.message.includes("already")) {
      console.error("[siwe] Failed to create auth user:", createError);
      return NextResponse.json(
        { error: "Failed to create user session" },
        { status: 500 }
      );
    }

    // 3. Sign a JWT that Supabase RLS can use
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error("[siwe] SUPABASE_JWT_SECRET not configured");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 60; // 1 hour

    const secret = new TextEncoder().encode(jwtSecret);
    const accessToken = await new SignJWT({
      sub: userId,
      wallet_address: walletAddress,
      role: "authenticated",
      aud: "authenticated",
      user_metadata: { wallet_address: walletAddress },
      app_metadata: { wallet_address: walletAddress },
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .setIssuer(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`)
      .sign(secret);

    return NextResponse.json({
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      wallet_address: walletAddress,
    });
  } catch (err) {
    console.error("[siwe] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
