import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, parseDate } from "./dates";

describe("dates", () => {
  it("formats date-only values without timezone drift", () => {
    expect(formatDate("2026-10-18")).toBe("18 OUT 2026");
  });

  it("formats date and time consistently", () => {
    expect(formatDateTime("2026-10-18")).toBe("18 OUT 2026 · 12:00");
  });

  it("falls back to a valid date for invalid input", () => {
    expect(Number.isNaN(parseDate("invalid").getTime())).toBe(false);
  });
});
