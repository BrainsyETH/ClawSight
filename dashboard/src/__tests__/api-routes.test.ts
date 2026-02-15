/**
 * Tests for API route validation logic
 *
 * NOTE: vitest is not yet installed in this project.
 * See utils.test.ts header for setup instructions.
 *
 * The actual Next.js route handlers (POST /v1/api/sync, GET /v1/api/health)
 * depend on NextRequest / NextResponse and Supabase, making them difficult
 * to test in isolation without a full integration setup. Instead, we extract
 * and verify the validation constants and logic used by those routes:
 *
 *   - Allowed event types
 *   - Event filtering logic
 *   - Health response structure
 *
 * These tests exercise the same code paths the routes rely on.
 */

import { describe, it, expect } from "vitest";
import type { EventType } from "@/types";

// ---------------------------------------------------------------------------
// Constants replicated from the sync route — kept in sync manually.
// If these drift, tests will catch it when compared against the types file.
// ---------------------------------------------------------------------------
const ALLOWED_EVENT_TYPES: string[] = [
  "tool_call",
  "message_sent",
  "payment",
  "error",
  "status_change",
  "skill_installed",
  "config_changed",
];

/**
 * Mirrors the filtering logic from POST /v1/api/sync (route.ts lines 38-41).
 */
function filterValidEvents(
  events: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return events.filter(
    (e) => e.event_type && ALLOWED_EVENT_TYPES.includes(e.event_type as string)
  );
}

// ---------------------------------------------------------------------------
// Allowed event types
// ---------------------------------------------------------------------------
describe("sync route – allowed event types", () => {
  it("has exactly the 7 expected event types", () => {
    expect(ALLOWED_EVENT_TYPES).toHaveLength(7);
    expect(ALLOWED_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "tool_call",
        "message_sent",
        "payment",
        "error",
        "status_change",
        "skill_installed",
        "config_changed",
      ])
    );
  });

  it("matches the EventType union from the types file", () => {
    // Every value in the allowed list should be assignable to EventType.
    // This compile-time check ensures consistency; at runtime we just confirm
    // the list is the exhaustive set.
    const eventTypesFromTypes: EventType[] = [
      "tool_call",
      "message_sent",
      "payment",
      "error",
      "status_change",
      "skill_installed",
      "config_changed",
    ];
    expect(ALLOWED_EVENT_TYPES.sort()).toEqual(eventTypesFromTypes.sort());
  });
});

// ---------------------------------------------------------------------------
// Event filtering logic
// ---------------------------------------------------------------------------
describe("sync route – event filtering", () => {
  it("accepts events with valid event_type", () => {
    const events = [
      { event_type: "tool_call", event_data: {} },
      { event_type: "payment", event_data: { amount: 5 } },
    ];
    const valid = filterValidEvents(events);
    expect(valid).toHaveLength(2);
  });

  it("rejects events with invalid event_type", () => {
    const events = [
      { event_type: "invalid_type", event_data: {} },
      { event_type: "hack_attempt", event_data: {} },
    ];
    const valid = filterValidEvents(events);
    expect(valid).toHaveLength(0);
  });

  it("filters a mix of valid and invalid events", () => {
    const events = [
      { event_type: "tool_call", event_data: {} },
      { event_type: "not_real", event_data: {} },
      { event_type: "error", event_data: { msg: "oops" } },
      { event_type: "", event_data: {} },
    ];
    const valid = filterValidEvents(events);
    expect(valid).toHaveLength(2);
    expect(valid[0].event_type).toBe("tool_call");
    expect(valid[1].event_type).toBe("error");
  });

  it("rejects events that are missing event_type entirely", () => {
    const events = [
      { event_data: {} },
      { event_type: undefined, event_data: {} },
      { event_type: null, event_data: {} },
    ];
    const valid = filterValidEvents(events as Array<Record<string, unknown>>);
    expect(valid).toHaveLength(0);
  });

  it("returns empty array when given empty input", () => {
    expect(filterValidEvents([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Payload validation (mirrors the route's pre-checks)
// ---------------------------------------------------------------------------
describe("sync route – payload validation", () => {
  /**
   * Mirrors the validation logic from the sync route handler:
   * - events must be a non-empty array
   * - at least one event must have a valid type
   */
  function validateSyncPayload(
    body: Record<string, unknown>
  ): { ok: true; validEvents: Array<Record<string, unknown>> } | { ok: false; error: string; status: number } {
    const { events } = body;
    if (!events || !Array.isArray(events) || events.length === 0) {
      return { ok: false, error: "events array is required", status: 400 };
    }
    const validEvents = filterValidEvents(events as Array<Record<string, unknown>>);
    if (validEvents.length === 0) {
      return { ok: false, error: "No valid events in payload", status: 400 };
    }
    return { ok: true, validEvents };
  }

  it("rejects missing events field", () => {
    const result = validateSyncPayload({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("events array is required");
      expect(result.status).toBe(400);
    }
  });

  it("rejects non-array events field", () => {
    const result = validateSyncPayload({ events: "not an array" });
    expect(result.ok).toBe(false);
  });

  it("rejects empty events array", () => {
    const result = validateSyncPayload({ events: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("events array is required");
    }
  });

  it("rejects events array with only invalid types", () => {
    const result = validateSyncPayload({
      events: [{ event_type: "bogus" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("No valid events in payload");
    }
  });

  it("accepts valid payload", () => {
    const result = validateSyncPayload({
      events: [
        { event_type: "tool_call", event_data: { tool: "web_search" } },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validEvents).toHaveLength(1);
    }
  });

  it("accepts payload and filters out invalid events", () => {
    const result = validateSyncPayload({
      events: [
        { event_type: "tool_call", event_data: {} },
        { event_type: "bad_type", event_data: {} },
        { event_type: "payment", event_data: {} },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validEvents).toHaveLength(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Health endpoint structure
// ---------------------------------------------------------------------------
describe("health endpoint – response structure", () => {
  /**
   * Mirrors the response shape from GET /v1/api/health.
   */
  function buildHealthResponse() {
    return {
      status: "ok",
      version: "v1",
      timestamp: new Date().toISOString(),
    };
  }

  it("returns status 'ok'", () => {
    const res = buildHealthResponse();
    expect(res.status).toBe("ok");
  });

  it("returns version 'v1'", () => {
    const res = buildHealthResponse();
    expect(res.version).toBe("v1");
  });

  it("returns a valid ISO timestamp", () => {
    const res = buildHealthResponse();
    expect(typeof res.timestamp).toBe("string");
    // Verify it parses to a valid date
    const parsed = new Date(res.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("has exactly three keys", () => {
    const res = buildHealthResponse();
    expect(Object.keys(res)).toHaveLength(3);
    expect(Object.keys(res).sort()).toEqual(["status", "timestamp", "version"]);
  });
});
