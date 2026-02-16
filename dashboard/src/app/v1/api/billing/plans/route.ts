import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * GET /v1/api/billing/plans
 *
 * Public endpoint — returns all active billing plans.
 * No auth required (plan browsing is pre-signup).
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }

  return NextResponse.json({ plans: data });
}
