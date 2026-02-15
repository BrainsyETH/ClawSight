import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

/**
 * GET /v1/api/users
 * Fetch the authenticated user's profile.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "users-read", 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", wallet)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: data });
}

/**
 * PATCH /v1/api/users
 * Update the authenticated user's profile fields.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "users-write", 20, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();

  // Whitelist of allowed fields
  const allowedFields = [
    "display_mode",
    "agent_name",
    "avatar_style",
    "avatar_color",
    "custom_avatar_url",
    "daily_spend_cap_usdc",
    "monthly_spend_cap_usdc",
    "data_retention_days",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // Validate display_mode
  if (updates.display_mode && !["fun", "professional"].includes(updates.display_mode as string)) {
    return NextResponse.json(
      { error: "display_mode must be 'fun' or 'professional'" },
      { status: 400 }
    );
  }

  // Validate avatar_style
  const validStyles = ["lobster", "robot", "pixel", "cat", "custom"];
  if (updates.avatar_style && !validStyles.includes(updates.avatar_style as string)) {
    return NextResponse.json(
      { error: `avatar_style must be one of: ${validStyles.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate agent_name
  if (updates.agent_name !== undefined) {
    if (typeof updates.agent_name !== "string" || (updates.agent_name as string).length > 30) {
      return NextResponse.json(
        { error: "agent_name must be a string of 30 characters or less" },
        { status: 400 }
      );
    }
  }

  // Validate spending caps
  if (updates.daily_spend_cap_usdc !== undefined) {
    const cap = Number(updates.daily_spend_cap_usdc);
    if (isNaN(cap) || cap < 0.01 || cap > 100) {
      return NextResponse.json(
        { error: "daily_spend_cap_usdc must be between 0.01 and 100" },
        { status: 400 }
      );
    }
    updates.daily_spend_cap_usdc = cap;
  }

  if (updates.monthly_spend_cap_usdc !== undefined) {
    const cap = Number(updates.monthly_spend_cap_usdc);
    if (isNaN(cap) || cap < 0.10 || cap > 1000) {
      return NextResponse.json(
        { error: "monthly_spend_cap_usdc must be between 0.10 and 1000" },
        { status: 400 }
      );
    }
    updates.monthly_spend_cap_usdc = cap;
  }

  // Validate data_retention_days
  if (updates.data_retention_days !== undefined) {
    const days = Number(updates.data_retention_days);
    if (![30, 60, 90, 180, 365].includes(days)) {
      return NextResponse.json(
        { error: "data_retention_days must be one of: 30, 60, 90, 180, 365" },
        { status: 400 }
      );
    }
    updates.data_retention_days = days;
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("wallet_address", wallet)
    .select()
    .single();

  if (error) {
    console.error("[users] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: data });
}
