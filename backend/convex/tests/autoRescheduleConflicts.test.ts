import { describe, expect, test } from "vitest";
import { filterPastFreeBlocks } from "../actions/autoRescheduleConflicts";

type TestBlock = { startMs: number; endMs: number; startISO: string; isPreferred: boolean };

function makeBlock(startMs: number, endMs: number): TestBlock {
  return {
    startMs,
    endMs,
    startISO: new Date(startMs).toISOString(),
    isPreferred: false,
  };
}

describe("filterPastFreeBlocks", () => {
  const now = 1_000_000_000; // stable reference time for tests

  test("removes blocks that end before nowMs", () => {
    const blocks = [
      makeBlock(now - 7200_000, now - 3600_000), // fully in the past
      makeBlock(now + 3600_000, now + 7200_000),  // fully in the future
    ];
    const result = filterPastFreeBlocks(blocks, now);
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(now + 3600_000);
  });

  test("removes blocks that end exactly at nowMs", () => {
    const blocks = [makeBlock(now - 3600_000, now)];
    const result = filterPastFreeBlocks(blocks, now);
    expect(result).toHaveLength(0);
  });

  test("trims startMs to nowMs for blocks that straddle now", () => {
    const blocks = [makeBlock(now - 3600_000, now + 3600_000)];
    const result = filterPastFreeBlocks(blocks, now);
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(now);
    expect(result[0].startISO).toBe(new Date(now).toISOString());
    expect(result[0].endMs).toBe(now + 3600_000); // endMs unchanged
  });

  test("does not modify blocks entirely in the future", () => {
    const blocks = [makeBlock(now + 1000, now + 5000)];
    const result = filterPastFreeBlocks(blocks, now);
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(now + 1000);
  });

  test("returns empty array when all blocks are fully in the past", () => {
    const blocks = [
      makeBlock(now - 7200_000, now - 3600_000),
      makeBlock(now - 3600_000, now - 1),
    ];
    const result = filterPastFreeBlocks(blocks, now);
    expect(result).toHaveLength(0);
  });

  test("handles an empty input", () => {
    expect(filterPastFreeBlocks([], now)).toHaveLength(0);
  });

  test("preserves non-time fields on trimmed blocks", () => {
    const blocks = [{ ...makeBlock(now - 1000, now + 5000), isPreferred: true }];
    const result = filterPastFreeBlocks(blocks, now);
    expect(result[0].isPreferred).toBe(true);
  });
});
