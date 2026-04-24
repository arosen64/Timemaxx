import { describe, expect, test } from "vitest";
import { computeFreeBlocks } from "../actions/getCalendarAvailability";

// All tests use a fixed start date of 2026-03-28 (a Saturday).
// In America/New_York (EDT, UTC-4), UTC midnight on March 28 corresponds to
// March 27 20:00 local time, so computeFreeBlocks maps the first day-offset to
// the local date "2026-03-27" (Friday). This is the scenario that triggered the
// off-by-24h bug in localToUTCISO for UTC- timezones.

const START_DATE = "2026-03-28";

// Minimal grid with no blocking.
function makeGrid(
  dayName: string,
): Array<{ day: string; blocked: number[] }> {
  return [{ day: dayName, blocked: [] }];
}

describe("computeFreeBlocks – localToUTCISO correctness", () => {
  test("UTC-4 (America/New_York): midnight slot startISO is on the correct date, not 24 hours earlier", () => {
    // With the bug, localToUTCISO produced an offsetMins of -1200 (≈ -20h)
    // instead of +240 (+4h), placing the block 24h in the past.
    const result = computeFreeBlocks(
      [],
      makeGrid("Friday"),
      START_DATE,
      "America/New_York",
    );

    const fridayBlocks = result.filter((b) => b.startISO.startsWith("2026-03-27"));
    expect(fridayBlocks.length).toBeGreaterThan(0);
    // Midnight Friday March 27 in EDT (UTC-4) = 04:00 UTC on March 27.
    // Before fix: "2026-03-26T04:00:00.000Z" (24h too early).
    expect(fridayBlocks[0].startISO).toBe("2026-03-27T04:00:00.000Z");
  });

  test("UTC-4 (America/New_York): endISO is also on the correct date", () => {
    const result = computeFreeBlocks(
      [],
      makeGrid("Friday"),
      START_DATE,
      "America/New_York",
    );
    const fridayBlocks = result.filter((b) => b.startISO.startsWith("2026-03-27"));
    expect(fridayBlocks.length).toBeGreaterThan(0);
    expect(fridayBlocks[0].endISO).not.toMatch(/^2026-03-26/);
  });

  test("UTC+9 (Asia/Tokyo): midnight slot startISO is correct (regression guard – no clamping needed)", () => {
    // For UTC+9, offsetMins = -540, well within ±720. The fix must not alter it.
    // UTC midnight March 28 = March 28 09:00 JST → localDate "2026-03-28" (Saturday).
    // Midnight Saturday JST = 2026-03-27T15:00:00.000Z.
    const result = computeFreeBlocks(
      [],
      makeGrid("Saturday"),
      START_DATE,
      "Asia/Tokyo",
    );
    const saturdayBlocks = result.filter((b) => b.startISO.startsWith("2026-03-27"));
    expect(saturdayBlocks.length).toBeGreaterThan(0);
    expect(saturdayBlocks[0].startISO).toBe("2026-03-27T15:00:00.000Z");
  });

  test("UTC: midnight slot startISO matches local midnight exactly", () => {
    // UTC has zero offset; the algorithm should be a no-op.
    // UTC midnight March 28 maps to localDate "2026-03-28" (Saturday).
    const result = computeFreeBlocks(
      [],
      makeGrid("Saturday"),
      START_DATE,
      "UTC",
    );
    const saturdayBlocks = result.filter((b) => b.startISO.startsWith("2026-03-28"));
    expect(saturdayBlocks.length).toBeGreaterThan(0);
    expect(saturdayBlocks[0].startISO).toBe("2026-03-28T00:00:00.000Z");
  });

  test("no free block startISO falls on 2026-03-26 (the off-by-24h regression date)", () => {
    // With the bug, the UTC-4 Friday midnight slot produced "2026-03-26T04:00:00.000Z"
    // instead of the correct "2026-03-27T04:00:00.000Z". Verify no block is dated
    // two days before the start date.
    const result = computeFreeBlocks(
      [],
      makeGrid("Friday"),
      START_DATE,
      "America/New_York",
    );
    for (const block of result) {
      expect(block.startISO).not.toMatch(/^2026-03-26/);
    }
  });

  test("slots also get correct ISO strings for UTC-4", () => {
    const result = computeFreeBlocks(
      [],
      makeGrid("Friday"),
      START_DATE,
      "America/New_York",
    );
    // The first block on Friday should start at 2026-03-27T04:00:00.000Z (midnight EDT).
    const fridayBlocks = result.filter((b) =>
      b.startISO.startsWith("2026-03-27"),
    );
    expect(fridayBlocks.length).toBeGreaterThan(0);
    expect(fridayBlocks[0].startISO).toBe("2026-03-27T04:00:00.000Z");
  });
});
