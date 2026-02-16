import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit } from "@/lib/server/auth";

const FLY_API_URL = "https://api.machines.dev/v1";
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_ORG = process.env.FLY_ORG || "personal";
const OPENCLAW_IMAGE = process.env.OPENCLAW_DOCKER_IMAGE || "ghcr.io/openclaw/openclaw:latest";

// Region selection based on Fly.io region codes

function selectRegion(request: NextRequest): string {
  // Try Fly-Region header (set by Fly's edge), then CF, then default
  const flyRegion = request.headers.get("fly-region");
  if (flyRegion) return flyRegion;

  const cfCountry = request.headers.get("cf-ipcountry");
  if (cfCountry) {
    const euCountries = ["DE", "FR", "NL", "GB", "IE", "ES", "IT", "SE", "PL", "BE", "AT", "CH"];
    const apCountries = ["JP", "KR", "SG", "AU", "IN", "TW", "HK"];
    if (euCountries.includes(cfCountry)) return "ams";
    if (apCountries.includes(cfCountry)) return "nrt";
    if (cfCountry === "US") return "iad";
  }

  return "iad"; // default to US East
}

/**
 * POST /v1/api/agent/provision
 *
 * Provisions a cloud-hosted OpenClaw agent for the authenticated user.
 *   1. Checks if user already has a provisioned agent
 *   2. Creates a Fly.io app + machine with OpenClaw image
 *   3. Waits for health check
 *   4. Persists to agent_registry table
 *   5. Saves gateway_url to user profile
 *
 * Returns { agent_id, gateway_url, region }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { wallet, supabase } = auth;

  if (!checkRateLimit(wallet, "agent-provision", 3, 300_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      { status: 429 }
    );
  }

  // Check if user already has a provisioned agent
  const { data: existing } = await supabase
    .from("agent_registry")
    .select("*")
    .eq("wallet_address", wallet)
    .single();

  if (existing && existing.status === "running") {
    return NextResponse.json({
      agent_id: existing.fly_machine_id,
      gateway_url: existing.gateway_url,
      region: existing.region,
      already_provisioned: true,
    });
  }

  // If no Fly API token, return a clear error — don't fake it
  if (!FLY_API_TOKEN) {
    console.error("[provision] FLY_API_TOKEN not configured");
    return NextResponse.json(
      {
        error:
          "Cloud agent provisioning is not available yet. " +
          "You can skip this step and set up your agent later in Settings.",
        code: "FLY_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const region = selectRegion(request);
  const appName = `openclaw-${wallet.slice(2, 10).toLowerCase()}-${crypto.randomUUID().slice(0, 6)}`;

  try {
    // Step 1: Create Fly app
    const appRes = await fetch(`${FLY_API_URL}/apps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_name: appName,
        org_slug: FLY_ORG,
      }),
    });

    if (!appRes.ok) {
      const err = await appRes.text();
      console.error("[provision] Failed to create Fly app:", err);
      throw new Error("Failed to create cloud app");
    }

    // Step 2: Create machine with OpenClaw image
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clawsight.app";
    const machineRes = await fetch(
      `${FLY_API_URL}/apps/${appName}/machines`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FLY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "openclaw-agent",
          region,
          config: {
            image: OPENCLAW_IMAGE,
            env: {
              WALLET_ADDRESS: wallet,
              CLAWSIGHT_URL: dashboardUrl,
              CLAWSIGHT_API_URL: `${dashboardUrl}/v1/api`,
              NODE_ENV: "production",
            },
            services: [
              {
                ports: [
                  { port: 443, handlers: ["tls", "http"] },
                  { port: 80, handlers: ["http"] },
                ],
                protocol: "tcp",
                internal_port: 3080,
              },
            ],
            guest: {
              cpu_kind: "shared",
              cpus: 1,
              memory_mb: 512,
            },
            checks: {
              health: {
                type: "http",
                port: 3080,
                path: "/health",
                interval: "15s",
                timeout: "5s",
              },
            },
            auto_destroy: true,
          },
        }),
      }
    );

    if (!machineRes.ok) {
      const err = await machineRes.text();
      console.error("[provision] Failed to create machine:", err);
      throw new Error("Failed to start agent container");
    }

    const machine = await machineRes.json();
    const machineId = machine.id;
    const gatewayUrl = `https://${appName}.fly.dev`;

    // Step 3: Wait for machine to be started (poll up to 30s)
    let healthy = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const statusRes = await fetch(
          `${FLY_API_URL}/apps/${appName}/machines/${machineId}`,
          {
            headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
          }
        );
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.state === "started") {
            healthy = true;
            break;
          }
        }
      } catch {
        // Keep polling
      }
    }

    if (!healthy) {
      console.error("[provision] Machine did not start within 30s");
      // Don't fail — it may still be booting. Record as 'starting'.
    }

    // Step 4: Persist to agent_registry
    const registryRow = {
      wallet_address: wallet,
      fly_app_name: appName,
      fly_machine_id: machineId,
      region,
      gateway_url: gatewayUrl,
      status: healthy ? "running" : "starting",
    };

    if (existing) {
      await supabase
        .from("agent_registry")
        .update(registryRow)
        .eq("wallet_address", wallet);
    } else {
      await supabase.from("agent_registry").insert(registryRow);
    }

    // Step 5: Save gateway_url to user profile
    await supabase
      .from("users")
      .update({ openclaw_gateway_url: gatewayUrl })
      .eq("wallet_address", wallet);

    return NextResponse.json({
      agent_id: machineId,
      gateway_url: gatewayUrl,
      region,
    });
  } catch (err) {
    console.error("[provision] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Provisioning failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

// provisionStub removed — provisioning now fails explicitly when
// FLY_API_TOKEN is not configured instead of faking success.
