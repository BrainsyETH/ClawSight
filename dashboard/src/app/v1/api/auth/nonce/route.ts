import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/server/auth";

/**
 * GET /v1/api/auth/nonce
 *
 * Issue a server-side nonce for SIWE. The client must embed this
 * nonce in the SIWE message before signing. The server validates
 * that the nonce is fresh and unused when verifying the signature.
 *
 * This prevents replay attacks — a captured signature cannot be
 * reused because the nonce is consumed on first verification.
 */
export async function GET() {
  const nonce = issueNonce();
  return NextResponse.json({ nonce });
}
