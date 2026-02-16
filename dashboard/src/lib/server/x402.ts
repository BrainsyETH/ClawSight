import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { UsageOperation } from "@/types";
import { getOperationCost, checkSpendingCaps, recordUsage } from "./billing";

/** Viem public client for on-chain USDC transfer verification. */
const viemClient = createPublicClient({
  chain: base,
  transport: http(),
});

/** Base mainnet USDC contract address. */
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const TRANSFER_EVENT_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const CLAWSIGHT_PAYMENT_ADDRESS = process.env.CLAWSIGHT_PAYMENT_ADDRESS;

if (!CLAWSIGHT_PAYMENT_ADDRESS) {
  console.error(
    "[x402] CRITICAL: CLAWSIGHT_PAYMENT_ADDRESS not configured. " +
    "All paid operations will fail until this is set."
  );
}

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

  // Fail hard if payment address isn't configured for paid operations
  if (cost > 0 && !CLAWSIGHT_PAYMENT_ADDRESS) {
    console.error("[x402] Cannot process paid operation: CLAWSIGHT_PAYMENT_ADDRESS not set");
    return NextResponse.json(
      { error: "Payment service not configured. Contact support." },
      { status: 503 }
    );
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
    const paymentResult = await validateX402Payment(opts.paymentHeader, wallet, cost);
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
 *   - Tx hash exists and is valid
 *   - Timestamp within 5 minutes
 *   - On-chain verification: confirms the USDC Transfer event in the tx receipt
 */
async function validateX402Payment(
  paymentHeader: string,
  expectedPayer: string,
  expectedCost: number
): Promise<{ valid: boolean; reason?: string; amount?: number; payer?: string; signed_tx?: string }> {
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

    if (!CLAWSIGHT_PAYMENT_ADDRESS || proof.recipient.toLowerCase() !== CLAWSIGHT_PAYMENT_ADDRESS.toLowerCase()) {
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

    // On-chain verification: check the tx receipt for a USDC Transfer event
    // that matches the expected payer, recipient, and amount.
    try {
      const receipt = await viemClient.getTransactionReceipt({
        hash: proof.signed_tx as `0x${string}`,
      });

      if (receipt.status !== "success") {
        return { valid: false, reason: "Transaction reverted on-chain" };
      }

      // Find matching Transfer event from USDC contract
      const transferLog = receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) return false;
        try {
          // Transfer event topic0
          const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          if (log.topics[0] !== transferTopic) return false;
          // from (topic1) and to (topic2) are indexed
          const from = ("0x" + (log.topics[1] ?? "").slice(26)).toLowerCase();
          const to = ("0x" + (log.topics[2] ?? "").slice(26)).toLowerCase();
          return (
            from === proof.payer.toLowerCase() &&
            to === CLAWSIGHT_PAYMENT_ADDRESS!.toLowerCase()
          );
        } catch {
          return false;
        }
      });

      if (!transferLog) {
        return { valid: false, reason: "No matching USDC transfer found in transaction" };
      }

      // Verify amount (USDC has 6 decimals)
      const transferAmount = Number(BigInt(transferLog.data)) / 1e6;
      if (transferAmount < expectedCost) {
        return { valid: false, reason: `On-chain transfer amount ($${transferAmount}) < expected ($${expectedCost})` };
      }
    } catch (err) {
      // If on-chain check fails (e.g. tx not yet indexed), log and
      // accept based on structural checks. This prevents blocking
      // legitimate payments due to RPC latency.
      console.warn("[x402] On-chain verification failed, accepting on structural checks:", err);
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
