import { NextRequest, NextResponse } from "next/server";

/**
 * POST /v1/api/agent/provision
 *
 * Provisions a cloud-hosted OpenClaw agent for the authenticated user.
 *
 * In production this will:
 *   1. Spin up an isolated Fly Machine (or Railway service)
 *   2. Inject user-specific env vars (wallet address, skill configs)
 *   3. Register the agent in the agent_registry table
 *   4. Return the agent's public gateway URL
 *
 * For now this is a stub that simulates a ~8 second provisioning delay
 * and returns a placeholder gateway URL.
 *
 * Returns { agent_id, gateway_url, region }
 */
export async function POST(_request: NextRequest) {
  // TODO: requireAuth() — authenticate the user
  // TODO: Check if user already has a provisioned agent
  // TODO: Determine nearest region from request headers
  // TODO: Call Fly Machines API / Railway API to spin up container
  // TODO: Wait for health check to pass
  // TODO: Persist to agent_registry table in Supabase

  // --- Stub: simulate provisioning delay ---
  await new Promise((resolve) => setTimeout(resolve, 8000));

  const agentId = `agent_${crypto.randomUUID().slice(0, 8)}`;
  const region = "us-east-1";
  const gatewayUrl = `https://${agentId}.openclaw.run`;

  return NextResponse.json({
    agent_id: agentId,
    gateway_url: gatewayUrl,
    region,
  });
}
