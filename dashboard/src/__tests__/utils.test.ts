/**
 * Tests for @/lib/utils
 *
 * NOTE: vitest is not yet installed in this project.
 * To run these tests:
 *   npm install -D vitest
 *   Add "test": "vitest" to package.json scripts
 *   Add a vitest.config.ts that resolves the @/ alias
 *   Then: npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  truncateAddress,
  formatUSDC,
  timeAgo,
  formatDuration,
  getStatusColor,
  getSyncStatusColor,
  getEventTypeIcon,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// truncateAddress
// ---------------------------------------------------------------------------
describe("truncateAddress", () => {
  it("truncates a standard 42-char Ethereum address", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    expect(truncateAddress(addr)).toBe("0x1234...5678");
  });

  it("truncates any long string the same way", () => {
    const long = "abcdefghijklmnopqrstuvwxyz";
    expect(truncateAddress(long)).toBe("abcdef...wxyz");
  });

  it("handles a short string without crashing", () => {
    // For a 6-char string the overlap means the two slices overlap,
    // but the function should still return something rather than throw.
    const short = "abc";
    expect(typeof truncateAddress(short)).toBe("string");
  });

  it("returns a string shorter than the original for long inputs", () => {
    const addr = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";
    const result = truncateAddress(addr);
    expect(result.length).toBeLessThan(addr.length);
    expect(result).toContain("...");
  });
});

// ---------------------------------------------------------------------------
// formatUSDC
// ---------------------------------------------------------------------------
describe("formatUSDC", () => {
  it("formats an integer to 2 decimal places", () => {
    expect(formatUSDC(100)).toBe("$100.00");
  });

  it("formats a number with many decimals to 2 places", () => {
    expect(formatUSDC(12.3456)).toBe("$12.35");
  });

  it("formats zero", () => {
    expect(formatUSDC(0)).toBe("$0.00");
  });

  it("formats a small fraction", () => {
    expect(formatUSDC(0.1)).toBe("$0.10");
  });

  it("formats negative numbers", () => {
    expect(formatUSDC(-5.5)).toBe("$-5.50");
  });
});

// ---------------------------------------------------------------------------
// timeAgo
// ---------------------------------------------------------------------------
describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns seconds ago for very recent dates", () => {
    const now = new Date("2025-06-01T12:00:30Z");
    vi.setSystemTime(now);
    const result = timeAgo("2025-06-01T12:00:00Z");
    expect(result).toBe("30s ago");
  });

  it("returns minutes ago", () => {
    const now = new Date("2025-06-01T12:05:00Z");
    vi.setSystemTime(now);
    const result = timeAgo("2025-06-01T12:00:00Z");
    expect(result).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const now = new Date("2025-06-01T15:00:00Z");
    vi.setSystemTime(now);
    const result = timeAgo("2025-06-01T12:00:00Z");
    expect(result).toBe("3h ago");
  });

  it("returns days ago", () => {
    const now = new Date("2025-06-03T12:00:00Z");
    vi.setSystemTime(now);
    const result = timeAgo("2025-06-01T12:00:00Z");
    expect(result).toBe("2d ago");
  });

  it("returns 0s ago for the current moment", () => {
    const now = new Date("2025-06-01T12:00:00Z");
    vi.setSystemTime(now);
    const result = timeAgo("2025-06-01T12:00:00Z");
    expect(result).toBe("0s ago");
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe("formatDuration", () => {
  it("formats milliseconds under a minute as seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it("formats milliseconds as minutes and seconds", () => {
    expect(formatDuration(90_000)).toBe("1m 30s");
  });

  it("formats milliseconds as hours and minutes", () => {
    expect(formatDuration(3_660_000)).toBe("1h 1m");
  });

  it("formats zero milliseconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats exactly one hour", () => {
    expect(formatDuration(3_600_000)).toBe("1h 0m");
  });

  it("formats exactly one minute", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
  });
});

// ---------------------------------------------------------------------------
// getStatusColor
// ---------------------------------------------------------------------------
describe("getStatusColor", () => {
  it("returns green for online", () => {
    expect(getStatusColor("online")).toBe("bg-green-500");
  });

  it("returns yellow with pulse for thinking", () => {
    expect(getStatusColor("thinking")).toBe("bg-yellow-500 animate-pulse");
  });

  it("returns gray for idle", () => {
    expect(getStatusColor("idle")).toBe("bg-gray-400");
  });

  it("returns red for offline", () => {
    expect(getStatusColor("offline")).toBe("bg-red-500");
  });

  it("returns gray fallback for unknown status", () => {
    expect(getStatusColor("unknown")).toBe("bg-gray-400");
  });
});

// ---------------------------------------------------------------------------
// getSyncStatusColor
// ---------------------------------------------------------------------------
describe("getSyncStatusColor", () => {
  it("returns gray for pending", () => {
    expect(getSyncStatusColor("pending")).toBe("text-gray-400");
  });

  it("returns yellow for syncing", () => {
    expect(getSyncStatusColor("syncing")).toBe("text-yellow-500");
  });

  it("returns green for applied", () => {
    expect(getSyncStatusColor("applied")).toBe("text-green-500");
  });

  it("returns red for failed", () => {
    expect(getSyncStatusColor("failed")).toBe("text-red-500");
  });

  it("returns gray fallback for unknown status", () => {
    expect(getSyncStatusColor("whatever")).toBe("text-gray-400");
  });
});

// ---------------------------------------------------------------------------
// getEventTypeIcon
// ---------------------------------------------------------------------------
describe("getEventTypeIcon", () => {
  it("returns Wrench for tool_call", () => {
    expect(getEventTypeIcon("tool_call")).toBe("Wrench");
  });

  it("returns MessageSquare for message_sent", () => {
    expect(getEventTypeIcon("message_sent")).toBe("MessageSquare");
  });

  it("returns Coins for payment", () => {
    expect(getEventTypeIcon("payment")).toBe("Coins");
  });

  it("returns AlertTriangle for error", () => {
    expect(getEventTypeIcon("error")).toBe("AlertTriangle");
  });

  it("returns Circle as fallback for unknown type", () => {
    expect(getEventTypeIcon("unknown_type")).toBe("Circle");
  });
});
