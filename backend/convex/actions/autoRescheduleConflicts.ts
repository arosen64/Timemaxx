"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "../_generated/api";
import { computeFreeBlocks, type FreeBlock } from "./getCalendarAvailability";
import type { Id } from "../_generated/dataModel";

type StudyBlockWithTask = {
  _id: Id<"studyBlocks">;
  taskId: Id<"tasks">;
  title: string;
  startTime: string | undefined;
  studyBlockLength: number;
  isConflicted: boolean | undefined;
  taskTitle: string;
  taskDueDate: number;
};

/**
 * Reschedules all conflicted study blocks across the full 21-day window.
 * Fetches fresh calendar events, computes availability, and greedily places
 * conflicted blocks into free slots following scheduling constraints:
 *   - Prefers green (isPreferred) slots over white
 *   - Enforces 15-min gap between any two study blocks
 *   - Enforces no same-task blocks back-to-back (60+ min gap required)
 *   - Never places blocks in unavailable slots
 *   - Blocks that cannot be placed have startTime cleared
 * Returns the count of blocks that could not be placed.
 */
export const autoRescheduleConflicts = action({
  args: {
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{ unplacedCount: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Fetch fresh calendar events for the full 21-day window (3 weekly fetches)
    const today = new Date();
    const todayStr = toDateStr(today);

    const week2Start = new Date(today);
    week2Start.setDate(week2Start.getDate() + 7);
    const week3Start = new Date(today);
    week3Start.setDate(week3Start.getDate() + 14);

    let timedEvents: Array<{
      id: string;
      summary: string;
      start: string;
      end: string;
      calendarId: string;
    }> = [];

    try {
      const [r1, r2, r3] = await Promise.all([
        ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
          startDate: todayStr,
          timezone: args.timezone,
        }),
        ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
          startDate: toDateStr(week2Start),
          timezone: args.timezone,
        }),
        ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
          startDate: toDateStr(week3Start),
          timezone: args.timezone,
        }),
      ]);
      timedEvents = [...r1.timedEvents, ...r2.timedEvents, ...r3.timedEvents];
    } catch {
      // Fall back to no events — availability computed from work hours only
    }

    // Get user's workHoursGrid
    const scheduleData = await ctx.runQuery(api.queries.calendar.getScheduleData);
    const workHoursGrid = (scheduleData?.workHoursGrid ?? []) as Array<{
      day: string;
      available: number[];
      blocked: number[];
    }>;

    // Compute free blocks for the full 21-day window
    const freeBlocks = computeFreeBlocks(timedEvents, workHoursGrid, todayStr, args.timezone);

    // Get all study blocks for the user
    const allBlocks = (await ctx.runQuery(
      api.queries.studyBlocks.getAllStudyBlocksWithTasks,
    )) as StudyBlockWithTask[];

    const conflictedBlocks = allBlocks.filter((b) => b.isConflicted && b.startTime);
    const scheduledNonConflicted = allBlocks.filter((b) => b.startTime && !b.isConflicted);

    if (conflictedBlocks.length === 0) return { unplacedCount: 0 };

    // Sort conflicted blocks by task due date (earliest first)
    conflictedBlocks.sort((a, b) => a.taskDueDate - b.taskDueDate);

    // Build the set of already-placed ranges (non-conflicted scheduled blocks)
    const placedRanges: Array<{ startMs: number; endMs: number; taskId: string }> = [];
    for (const b of scheduledNonConflicted) {
      const startMs = new Date(b.startTime!).getTime();
      const endMs = startMs + b.studyBlockLength * 60 * 1000;
      placedRanges.push({ startMs, endMs, taskId: b.taskId });
    }

    // Sort free blocks: preferred first, then by start time
    const sortedFreeBlocks: Array<FreeBlock & { startMs: number; endMs: number }> = [
      ...freeBlocks.filter((fb) => fb.isPreferred),
      ...freeBlocks.filter((fb) => !fb.isPreferred),
    ].map((fb) => ({
      ...fb,
      startMs: new Date(fb.startISO).getTime(),
      endMs: new Date(fb.endISO).getTime(),
    }));

    let unplacedCount = 0;

    for (const block of conflictedBlocks) {
      const blockDurationMs = block.studyBlockLength * 60 * 1000;
      const taskDueDateMs = block.taskDueDate;
      let placed = false;

      for (const freeSlot of sortedFreeBlocks) {
        if (freeSlot.endMs - freeSlot.startMs < blockDurationMs) continue;

        // Find the earliest valid start within this free slot
        let candidateStart = freeSlot.startMs;

        // Apply gap constraints from all placed blocks.
        // Re-scan after each push so a later block in the list can't create a
        // new overlap that was missed in the single-pass order.
        let adjusted = true;
        while (adjusted) {
          adjusted = false;
          for (const range of placedRanges) {
            if (range.endMs <= candidateStart) continue;
            if (range.startMs >= candidateStart + blockDurationMs) continue;

            // Overlap or too-close: push candidateStart forward
            const sameTask = range.taskId === block.taskId;
            const requiredGapMs = sameTask ? 60 * 60 * 1000 : 15 * 60 * 1000;
            if (range.endMs + requiredGapMs > candidateStart) {
              candidateStart = Math.max(candidateStart, range.endMs + requiredGapMs);
              adjusted = true;
            }
          }
        }

        // Check if candidate fits within the free slot
        if (candidateStart + blockDurationMs > freeSlot.endMs) continue;

        // Check due date constraint
        if (candidateStart >= taskDueDateMs) continue;

        // Place the block
        const newStartISO = new Date(candidateStart).toISOString();
        placedRanges.push({
          startMs: candidateStart,
          endMs: candidateStart + blockDurationMs,
          taskId: block.taskId,
        });

        // Trim the free slot (advance its start past the placed block + gap)
        freeSlot.startMs = candidateStart + blockDurationMs + 15 * 60 * 1000;
        freeSlot.startISO = new Date(freeSlot.startMs).toISOString();

        await ctx.runMutation(internal.mutations.studyBlocks.setStudyBlockTime, {
          studyBlockId: block._id,
          startTime: newStartISO,
        });
        await ctx.runMutation(internal.mutations.studyBlocks.setConflictStatus, {
          studyBlockId: block._id,
          isConflicted: false,
        });

        placed = true;
        break;
      }

      if (!placed) {
        unplacedCount++;
        // 4.5: Clear startTime and isConflicted for unplaced blocks
        await ctx.runMutation(internal.mutations.studyBlocks.setStudyBlockTime, {
          studyBlockId: block._id,
          startTime: null,
        });
        await ctx.runMutation(internal.mutations.studyBlocks.setConflictStatus, {
          studyBlockId: block._id,
          isConflicted: false,
        });
      }
    }

    return { unplacedCount };
  },
});

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
