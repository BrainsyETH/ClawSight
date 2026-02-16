import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client with service-role privileges.
 * Use ONLY on the server for user management (e.g. creating auth users).
 */
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
