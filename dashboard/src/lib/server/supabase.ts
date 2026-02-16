import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for API routes and server components.
 * Reads the auth session from httpOnly cookies.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

/**
 * Extract wallet address from the authenticated session.
 *
 * The custom SIWE JWT embeds wallet_address at the top level of the
 * token payload (for RLS policies) AND in user_metadata / app_metadata.
 * We read from the session JWT directly so we don't require a round-trip
 * to Supabase's auth server.
 */
export async function getAuthenticatedWallet(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  // Decode the JWT payload without verification (Supabase already verified it)
  const [, payloadB64] = session.access_token.split(".");
  if (!payloadB64) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString()
    );
    return (
      payload.wallet_address ??
      payload.user_metadata?.wallet_address ??
      payload.app_metadata?.wallet_address ??
      null
    );
  } catch {
    return null;
  }
}
