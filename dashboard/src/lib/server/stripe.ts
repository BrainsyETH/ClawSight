/**
 * Stripe integration for fiat billing.
 *
 * Users can pay with either:
 *   - x402 (USDC on Base L2) — native crypto path
 *   - Stripe (credit card) — traditional fiat path
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   NEXT_PUBLIC_APP_URL
 */

// Lazy-init Stripe to avoid import errors when key is unset
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Dynamic import to avoid bundling stripe on client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Create or retrieve a Stripe customer for a wallet address.
 */
export async function getOrCreateStripeCustomer(
  wallet: string,
  email?: string
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  // Search for existing customer by metadata
  const existing = await stripe.customers.search({
    query: `metadata["wallet_address"]:"${wallet}"`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: { wallet_address: wallet },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for plan subscription.
 */
export async function createCheckoutSession(
  wallet: string,
  planId: string,
  stripePriceId: string,
  stripeCustomerId?: string
): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const customerId = stripeCustomerId || (await getOrCreateStripeCustomer(wallet));
  if (!customerId) return null;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/billing?canceled=true`,
    metadata: {
      wallet_address: wallet,
      plan_id: planId,
    },
    subscription_data: {
      metadata: {
        wallet_address: wallet,
        plan_id: planId,
      },
    },
  });

  return { url: session.url };
}

/**
 * Create a Stripe billing portal session for managing subscription.
 */
export async function createPortalSession(
  stripeCustomerId: string
): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${APP_URL}/billing`,
  });

  return { url: session.url };
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 */
export async function verifyWebhookEvent(
  body: string,
  signature: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return null;

  try {
    return stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return null;
  }
}
