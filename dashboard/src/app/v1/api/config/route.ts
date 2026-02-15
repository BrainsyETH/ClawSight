import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

/**
 * GET /v1/api/config
 * Fetch all skill configs for the authenticated wallet.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "config-read", 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("skill_configs")
    .select("*")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch configs" },
      { status: 500 }
    );
  }

  return NextResponse.json({ configs: data });
}

/**
 * PUT /v1/api/config
 * Create or update a skill config. Includes optimistic locking via updated_at.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "config-write", 20, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const { skill_slug, enabled, config, config_source, expected_updated_at } = body;

  if (!skill_slug) {
    return NextResponse.json(
      { error: "skill_slug is required" },
      { status: 400 }
    );
  }

  // Optimistic locking: reject if someone else updated since we last read
  if (expected_updated_at) {
    const { data: current } = await supabase
      .from("skill_configs")
      .select("updated_at")
      .eq("wallet_address", wallet)
      .eq("skill_slug", skill_slug)
      .single();

    if (current && current.updated_at !== expected_updated_at) {
      return NextResponse.json(
        {
          error: "Conflict: config was modified since you last read it.",
          server_updated_at: current.updated_at,
        },
        { status: 409 }
      );
    }
  }

  // Upsert the config
  const row = {
    wallet_address: wallet,
    skill_slug,
    enabled: enabled ?? true,
    config: config || {},
    config_source: config_source || "clawsight",
    sync_status: "pending" as const,
    sync_error: null,
  };

  const { data, error } = await supabase
    .from("skill_configs")
    .upsert(row, { onConflict: "wallet_address,skill_slug" })
    .select()
    .single();

  if (error) {
    console.error("[config] Upsert error:", error);
    return NextResponse.json(
      { error: "Failed to save config" },
      { status: 500 }
    );
  }

  // Log the config change as an activity event
  await supabase.from("activity_events").insert({
    wallet_address: wallet,
    skill_slug,
    event_type: "config_changed",
    event_data: {
      config_source: config_source || "clawsight",
      fields_changed: config ? Object.keys(config).length : 0,
    },
    occurred_at: new Date().toISOString(),
  });

  return NextResponse.json({ config: data });
}
