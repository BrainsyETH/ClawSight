// Supabase Edge Function: cleanup-events
//
// Runs the data retention cleanup. Deploy with:
//   supabase functions deploy cleanup-events
//
// Schedule via Supabase Dashboard → Database → Cron Jobs:
//   select
//     cron.schedule(
//       'cleanup-old-events',
//       '0 3 * * *',
//       $$select net.http_post(
//         url := '<SUPABASE_URL>/functions/v1/cleanup-events',
//         headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb
//       )$$
//     );
//
// Or call manually: curl -X POST <SUPABASE_URL>/functions/v1/cleanup-events

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Call the cleanup_old_events() SQL function (defined in migration 001)
    const { error } = await supabase.rpc("cleanup_old_events");

    if (error) {
      console.error("Cleanup failed:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Also clean up stale agent_status rows (offline for > 24h)
    const staleThreshold = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("agent_status")
      .update({ status: "offline", session_id: null })
      .lt("last_heartbeat", staleThreshold)
      .neq("status", "offline");

    return new Response(
      JSON.stringify({
        message: "Cleanup completed",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Cleanup error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
