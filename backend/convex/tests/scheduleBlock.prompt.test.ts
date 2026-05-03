import { describe, expect, test } from "vitest";
import {
  buildBatchScheduleBlockPrompt,
  type BatchScheduleBlockEntry,
} from "../lib/prompts/scheduleBlock.prompt";

const BASE_SLOT = {
  startMs: new Date("2025-01-06T14:00:00.000Z").getTime(),
  startISO: "2025-01-06T14:00:00.000Z",
  previousEventTitle: null,
  minutesSincePreviousEvent: null,
  nextEventTitle: null,
  minutesUntilNextEvent: null,
};

// ---------------------------------------------------------------------------
// buildBatchScheduleBlockPrompt – cannotSchedule flag
// ---------------------------------------------------------------------------

describe("buildBatchScheduleBlockPrompt – cannotSchedule", () => {
  test("schedulable block renders candidates array with slot data", () => {
    const blocks: BatchScheduleBlockEntry[] = [
      {
        taskTitle: "Problem Set 1",
        dueDate: new Date("2025-01-10T23:59:00.000Z").getTime(),
        candidates: [BASE_SLOT],
      },
    ];
    const prompt = buildBatchScheduleBlockPrompt(blocks, null);
    const parsed = JSON.parse(prompt.match(/<blocks>([\s\S]*?)<\/blocks>/)?.[1] ?? "[]");
    expect(parsed[0].cannotSchedule).toBeUndefined();
    expect(parsed[0].candidates).toHaveLength(1);
    expect(parsed[0].candidates[0].startTime).toBe(BASE_SLOT.startISO);
  });

  test("cannotSchedule: true block renders with empty candidates and cannotSchedule flag", () => {
    const blocks: BatchScheduleBlockEntry[] = [
      {
        taskTitle: "Full Schedule Task",
        dueDate: new Date("2025-01-10T23:59:00.000Z").getTime(),
        candidates: [],
        cannotSchedule: true,
      },
    ];
    const prompt = buildBatchScheduleBlockPrompt(blocks, null);
    const parsed = JSON.parse(prompt.match(/<blocks>([\s\S]*?)<\/blocks>/)?.[1] ?? "[]");
    expect(parsed[0].cannotSchedule).toBe(true);
    expect(parsed[0].candidates).toEqual([]);
  });

  test("mixed batch: one schedulable + one cannotSchedule", () => {
    const blocks: BatchScheduleBlockEntry[] = [
      {
        taskTitle: "Has Slots",
        dueDate: new Date("2025-01-10T23:59:00.000Z").getTime(),
        candidates: [BASE_SLOT],
      },
      {
        taskTitle: "No Slots",
        dueDate: new Date("2025-01-08T23:59:00.000Z").getTime(),
        candidates: [],
        cannotSchedule: true,
      },
    ];
    const prompt = buildBatchScheduleBlockPrompt(blocks, null);
    const parsed = JSON.parse(prompt.match(/<blocks>([\s\S]*?)<\/blocks>/)?.[1] ?? "[]");
    expect(parsed[0].cannotSchedule).toBeUndefined();
    expect(parsed[0].candidates).toHaveLength(1);
    expect(parsed[1].cannotSchedule).toBe(true);
    expect(parsed[1].candidates).toEqual([]);
  });

  test("prompt instruction references overallSkipReason", () => {
    const blocks: BatchScheduleBlockEntry[] = [
      {
        taskTitle: "Task",
        dueDate: new Date("2025-01-10T23:59:00.000Z").getTime(),
        candidates: [BASE_SLOT],
      },
    ];
    const prompt = buildBatchScheduleBlockPrompt(blocks, null);
    expect(prompt).toContain("overallSkipReason");
  });

  test("cannotSchedule: false block renders normally (same as omitting the flag)", () => {
    const withFalse: BatchScheduleBlockEntry[] = [
      {
        taskTitle: "Normal Task",
        dueDate: new Date("2025-01-10T23:59:00.000Z").getTime(),
        candidates: [BASE_SLOT],
        cannotSchedule: false,
      },
    ];
    const withUndefined: BatchScheduleBlockEntry[] = [
      {
        taskTitle: "Normal Task",
        dueDate: new Date("2025-01-10T23:59:00.000Z").getTime(),
        candidates: [BASE_SLOT],
      },
    ];
    const promptFalse = buildBatchScheduleBlockPrompt(withFalse, null);
    const promptUndefined = buildBatchScheduleBlockPrompt(withUndefined, null);
    expect(promptFalse).toBe(promptUndefined);
  });
});
