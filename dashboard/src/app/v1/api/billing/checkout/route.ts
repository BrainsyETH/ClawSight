import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";
import { createCheckoutSession, getOrCreateStripeCustomer } from "@/lib/server/stripe";

/**
 * POST /v1/api/billing/checkout
 *
 * Create a Stripe Checkout session for upgrading to a paid plan.
 * Body: { plan_id: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "billing-checkout", 5, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const { plan_id } = body;

  if (!plan_id || typeof plan_id !== "string") {
    return NextResponse.json(
      { error: "plan_id is required" },
      { status: 400 }
    );
  }

  // Look up the plan
  const { data: plan } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("active", true)
    .single();

  if (!plan) {
    return NextResponse.json(
      { error: "Plan not found" },
      { status: 404 }
    );
  }

  if (!plan.stripe_price_id) {
    // Plan doesn't support Stripe (x402 only)
    return NextResponse.json(
      { error: "This plan only supports x402 (USDC) payment. Use the x402 upgrade path." },
      { status: 400 }
    );
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(wallet);
  if (!customerId) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in environment." },
      { status: 503 }
    );
  }

  // Update subscription record with Stripe customer ID
  await supabase
    .from("subscriptions")
    .upsert(
      {
        wallet_address: wallet,
        stripe_customer_id: customerId,
      },
      { onConflict: "wallet_address" }
    );

  // Create Checkout session
  const session = await createCheckoutSession(
    wallet,
    plan_id,
    plan.stripe_price_id,
    customerId
  );

  if (!session) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
