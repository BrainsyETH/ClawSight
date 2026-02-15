import { NextResponse } from "next/server";

/**
 * GET /v1/api/health
 * Free, no auth. Plugin uses this to verify connectivity.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "v1",
    timestamp: new Date().toISOString(),
  });
}
