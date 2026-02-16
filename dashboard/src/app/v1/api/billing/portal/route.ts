import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";
import { createPortalSession } from "@/lib/server/stripe";

/**
 * POST /v1/api/billing/portal
 *
 * Create a Stripe billing portal session for managing the subscription.
 * Redirects to Stripe's hosted portal page.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "billing-portal", 5, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Look up subscription for Stripe customer ID
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("wallet_address", wallet)
    .single();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe subscription found. You may be using x402 payments." },
      { status: 400 }
    );
  }

  const session = await createPortalSession(sub.stripe_customer_id);
  if (!session) {
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
