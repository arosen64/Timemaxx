"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  enumerateSlots,
  selectSlotWithAI,
  selectAllSlotsWithAI,
  type OccupiedInterval,
  type WorkHoursRow,
} from "../lib/scheduleSlots";
import { fetch21DayCalendarEvents } from "../lib/calendarFetch";

type StudyBlockWithTask = {
  _id: Id<"studyBlocks">;
  taskId: Id<"tasks">;
  title: string;
  startTime: string | undefined;
  studyBlockLength: number;
  isConflicted: boolean | undefined;
  taskTitle: string;
  taskDueDate: number;
  taskRecommendedStart: number | undefined;
};

/**
 * Reschedules all conflicted study blocks across the full 21-day window using
 * AI-powered slot selection (Gemini Flash).
 *
 * For each conflicted block (sorted by task due date, earliest first):
 *  - Enumerates valid candidate slots respecting work hours and occupied intervals
 *  - Calls Gemini to select the best slot based on surrounding context and user preferences
 *  - Places the block; blocks that can't be placed have their startTime cleared
 *
 * Returns the count of blocks that could not be placed.
 * External interface is unchanged from the previous implementation.
 */
export const autoRescheduleConflicts = action({
  args: {
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{ unplacedCount: number; skippedReason: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Fetch fresh calendar events for the full 21-day window (3 weekly fetches)
    const timedEvents = await fetch21DayCalendarEvents(ctx, args.timezone);

    // Get user preferences
    const user = await ctx.runQuery(internal.queries.users.getUserInternal, { userId });
    const workHoursGrid = (user?.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user?.productivityTraits;

    // Get all study blocks for the user
    const allBlocks = (await ctx.runQuery(
      api.queries.studyBlocks.getAllStudyBlocksWithTasks
    )) as StudyBlockWithTask[];

    const conflictedBlocks = allBlocks.filter((b) => b.isConflicted && b.startTime);
    const scheduledNonConflicted = allBlocks.filter((b) => b.startTime && !b.isConflicted);

    if (conflictedBlocks.length === 0) return { unplacedCount: 0, skippedReason: null };

    // Sort conflicted blocks by task due date (earliest first)
    conflictedBlocks.sort((a, b) => a.taskDueDate - b.taskDueDate);

    // Build initial occupied intervals from calendar events + already-placed non-conflicted blocks
    const occupiedIntervals: OccupiedInterval[] = [
      ...timedEvents.map((e) => ({
        startMs: new Date(e.start).getTime(),
        endMs: new Date(e.end).getTime(),
        title: e.summary,
      })),
      ...scheduledNonConflicted.map((b) => ({
        startMs: new Date(b.startTime!).getTime(),
        endMs: new Date(b.startTime!).getTime() + b.studyBlockLength * 60000,
        title: b.taskTitle,
      })),
    ];

    const nowMs = Date.now();
    let unplacedCount = 0;
    const zeroCandidateBlocks: { taskTitle: string; taskDueDate: number }[] = [];

    for (const block of conflictedBlocks) {
      const candidates = enumerateSlots({
        fromMs: nowMs,
        dueDateMs: block.taskDueDate,
        durationMinutes: block.studyBlockLength,
        workHoursGrid,
        occupiedIntervals,
        timezone: args.timezone,
        recommendedStartMs: block.taskRecommendedStart,
      });

      if (candidates.length === 0) {
        unplacedCount++;
        zeroCandidateBlocks.push({ taskTitle: block.taskTitle, taskDueDate: block.taskDueDate });
        await ctx.runMutation(internal.mutations.studyBlocks.setStudyBlockTime, {
          studyBlockId: block._id,
          startTime: null,
        });
        await ctx.runMutation(internal.mutations.studyBlocks.setConflictStatus, {
          studyBlockId: block._id,
          isConflicted: false,
        });
        continue;
      }

      const chosen = await selectSlotWithAI({
        candidates,
        taskTitle: block.taskTitle,
        dueDate: block.taskDueDate,
        productivityTraits,
      });

      if (!chosen) {
        unplacedCount++;
        zeroCandidateBlocks.push({ taskTitle: block.taskTitle, taskDueDate: block.taskDueDate });
        await ctx.runMutation(internal.mutations.studyBlocks.setStudyBlockTime, {
          studyBlockId: block._id,
          startTime: null,
        });
        await ctx.runMutation(internal.mutations.studyBlocks.setConflictStatus, {
          studyBlockId: block._id,
          isConflicted: false,
        });
        continue;
      }

      await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
        studyBlockId: block._id,
        startTime: chosen.startISO,
      });

      // Add placed block to occupied intervals so subsequent blocks don't collide
      occupiedIntervals.push({
        startMs: chosen.startMs,
        endMs: chosen.startMs + block.studyBlockLength * 60000,
        title: block.taskTitle,
      });
    }

    // Get AI-generated overall reason for blocks that couldn't be placed
    let skippedReason: string | null = null;
    if (zeroCandidateBlocks.length > 0) {
      const { overallSkipReason } = await selectAllSlotsWithAI(
        zeroCandidateBlocks.map((z) => ({
          taskTitle: z.taskTitle,
          dueDate: z.taskDueDate,
          candidates: [],
          cannotSchedule: true as const,
        })),
        productivityTraits
      );
      skippedReason = overallSkipReason ?? "No open time slots before your deadline.";
    }

    return { unplacedCount, skippedReason };
  },
});

/**
 * Filters and trims a list of free blocks so that no block starts or ends in
 * the past relative to `nowMs`.
 *
 * - Blocks whose `endMs` <= `nowMs` are discarded entirely.
 * - Blocks whose `startMs` < `nowMs` have their start clamped to `nowMs`.
 *
 * Exported for unit testing.
 */
export function filterPastFreeBlocks<
  T extends { startMs: number; endMs: number; startISO: string },
>(blocks: T[], nowMs: number): T[] {
  return blocks
    .filter((b) => b.endMs > nowMs)
    .map((b) => {
      if (b.startMs < nowMs) {
        return { ...b, startMs: nowMs, startISO: new Date(nowMs).toISOString() };
      }
      return b;
    });
}
