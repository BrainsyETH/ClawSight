import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { UsageOperation } from "@/types";
import { getOperationCost, checkSpendingCaps, recordUsage } from "./billing";

const CLAWSIGHT_PAYMENT_ADDRESS = process.env.CLAWSIGHT_PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000000";

interface X402PaymentProof {
  type: string;
  chain: string;
  token: string;
  amount: string;
  recipient: string;
  signed_tx: string;
  payer: string;
  timestamp: string;
}

/**
 * Billing gate for API routes.
 *
 * Flow:
 *   1. Free ops → record + pass through
 *   2. Paid ops → check user spending caps (daily/monthly)
 *   3. If over cap → return 402 with X-Payment-Required header
 *   4. If x402 payment header present → validate proof, record payment
 *   5. Record operation usage
 *
 * Returns null if allowed, or a NextResponse (402) if blocked.
 */
export async function billingGate(
  supabase: SupabaseClient,
  wallet: string,
  operation: UsageOperation,
  opts?: {
    paymentHeader?: string | null;
    skill_slug?: string;
  }
): Promise<NextResponse | null> {
  const cost = getOperationCost(operation);

  // Free operations always pass (heartbeat, config_read, skill_install)
  if (cost === 0 && operation !== "api_call") {
    await recordUsage(supabase, wallet, operation, { skill_slug: opts?.skill_slug });
    return null;
  }

  // Check user spending caps
  if (cost > 0) {
    const capCheck = await checkSpendingCaps(supabase, wallet);
    if (!capCheck.allowed) {
      return x402Response(cost, capCheck.reason || "Spending cap reached");
    }
  }

  // If x402 payment header is present, validate it
  if (opts?.paymentHeader) {
    const paymentResult = validateX402Payment(opts.paymentHeader, wallet, cost);
    if (!paymentResult.valid) {
      return NextResponse.json(
        { error: `Payment validation failed: ${paymentResult.reason}` },
        { status: 402 }
      );
    }

    // Record the x402 payment
    await recordUsage(supabase, wallet, "x402_payment", {
      cost_override: paymentResult.amount,
      skill_slug: opts.skill_slug,
      metadata: {
        payer: paymentResult.payer,
        signed_tx: paymentResult.signed_tx?.slice(0, 20) + "...",
      },
    });
  }

  // Record the operation usage
  await recordUsage(supabase, wallet, operation, {
    skill_slug: opts?.skill_slug,
  });

  return null; // Allowed
}

/**
 * Build a 402 Payment Required response with x402 headers.
 * Plugin client reads X-Payment-Required to sign a USDC transfer.
 */
function x402Response(cost: number, reason: string): NextResponse {
  const res = NextResponse.json(
    {
      error: reason,
      code: "PAYMENT_REQUIRED",
      cost_usdc: cost,
      recipient: CLAWSIGHT_PAYMENT_ADDRESS,
    },
    { status: 402 }
  );

  // x402 header: "USDC <amount> <recipient>"
  res.headers.set(
    "X-Payment-Required",
    `USDC ${cost.toFixed(6)} ${CLAWSIGHT_PAYMENT_ADDRESS}`
  );

  return res;
}

/**
 * Validate an X-Payment header from the plugin client.
 *
 * Checks:
 *   - Payment type, chain, token
 *   - Amount >= expected cost
 *   - Recipient matches our address
 *   - Payer matches authenticated wallet
 *   - Signed tx exists
 *   - Timestamp within 5 minutes
 *
 * TODO: On-chain verification via viem publicClient for production.
 */
function validateX402Payment(
  paymentHeader: string,
  expectedPayer: string,
  expectedCost: number
): { valid: boolean; reason?: string; amount?: number; payer?: string; signed_tx?: string } {
  try {
    const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
    const proof: X402PaymentProof = JSON.parse(decoded);

    if (proof.type !== "x402-payment") {
      return { valid: false, reason: "Invalid payment type" };
    }
    if (proof.chain !== "base") {
      return { valid: false, reason: "Invalid chain (expected base)" };
    }
    if (proof.token !== "USDC") {
      return { valid: false, reason: "Invalid token (expected USDC)" };
    }

    const amount = parseFloat(proof.amount);
    if (isNaN(amount) || amount < expectedCost) {
      return { valid: false, reason: `Insufficient payment ($${amount} < $${expectedCost})` };
    }

    if (proof.recipient.toLowerCase() !== CLAWSIGHT_PAYMENT_ADDRESS.toLowerCase()) {
      return { valid: false, reason: "Payment to wrong recipient" };
    }

    if (proof.payer.toLowerCase() !== expectedPayer.toLowerCase()) {
      return { valid: false, reason: "Payer doesn't match authenticated wallet" };
    }

    if (!proof.signed_tx || proof.signed_tx.length < 10) {
      return { valid: false, reason: "Missing or invalid signed transaction" };
    }

    const paymentTime = new Date(proof.timestamp).getTime();
    if (isNaN(paymentTime) || Date.now() - paymentTime > 5 * 60 * 1000) {
      return { valid: false, reason: "Payment expired (>5 min old)" };
    }

    return {
      valid: true,
      amount,
      payer: proof.payer,
      signed_tx: proof.signed_tx,
    };
  } catch {
    return { valid: false, reason: "Invalid payment proof format" };
  }
}
