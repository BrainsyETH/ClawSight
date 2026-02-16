import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookEvent } from "@/lib/server/stripe";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * POST /v1/api/billing/webhook
 *
 * Stripe webhook handler. Processes subscription lifecycle events:
 *   - checkout.session.completed → activate subscription
 *   - customer.subscription.updated → update status/plan
 *   - customer.subscription.deleted → cancel subscription
 *   - invoice.paid → record invoice
 *   - invoice.payment_failed → mark past_due
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const event = await verifyWebhookEvent(body, signature);
  if (!event) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const wallet = session.metadata?.wallet_address;
      const planId = session.metadata?.plan_id;
      if (!wallet || !planId) break;

      await supabase
        .from("subscriptions")
        .upsert(
          {
            wallet_address: wallet,
            plan_id: planId,
            status: "active",
            payment_method: "stripe",
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          { onConflict: "wallet_address" }
        );
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const wallet = sub.metadata?.wallet_address;
      if (!wallet) break;

      const statusMap: Record<string, string> = {
        active: "active",
        past_due: "past_due",
        canceled: "canceled",
        trialing: "trialing",
        incomplete: "past_due",
        incomplete_expired: "canceled",
        unpaid: "past_due",
        paused: "past_due",
      };

      await supabase
        .from("subscriptions")
        .update({
          status: statusMap[sub.status] || "active",
          cancel_at_period_end: sub.cancel_at_period_end || false,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        .eq("wallet_address", wallet);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const wallet = sub.metadata?.wallet_address;
      if (!wallet) break;

      // Downgrade to free plan
      await supabase
        .from("subscriptions")
        .update({
          plan_id: "free",
          status: "canceled",
          payment_method: "free",
          stripe_subscription_id: null,
        })
        .eq("wallet_address", wallet);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const wallet = invoice.subscription_details?.metadata?.wallet_address
        || invoice.metadata?.wallet_address;
      if (!wallet) break;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id")
        .eq("wallet_address", wallet)
        .single();

      await supabase.from("invoices").insert({
        wallet_address: wallet,
        period_start: new Date(invoice.period_start * 1000).toISOString().split("T")[0],
        period_end: new Date(invoice.period_end * 1000).toISOString().split("T")[0],
        plan_id: sub?.plan_id || "free",
        plan_cost_usdc: (invoice.amount_paid || 0) / 100,
        usage_cost_usdc: 0,
        total_usdc: (invoice.amount_paid || 0) / 100,
        status: "paid",
        stripe_invoice_id: invoice.id,
        paid_at: new Date().toISOString(),
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const wallet = invoice.subscription_details?.metadata?.wallet_address
        || invoice.metadata?.wallet_address;
      if (!wallet) break;

      await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("wallet_address", wallet);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
