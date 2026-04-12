"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import {
  extendSlotPool,
  filterPoolForBlock,
  selectSlotWithAI,
  roundUpTo15Min,
  SCHEDULE_HORIZON_MS,
  type OccupiedInterval,
  type WorkHoursRow,
  type PoolSlot,
} from "../lib/scheduleSlots";
import { fetch21DayCalendarEvents } from "../lib/calendarFetch";

const MAX_TASKS = 20;

/**
 * AI-driven bulk scheduling for all unscheduled tasks.
 *
 * Maintains a shared incremental slot pool to avoid re-scanning the 21-day
 * window per task. Tasks are processed in dueDate ascending order (earliest
 * due first), capped at 20. Tasks that cannot be placed are skipped.
 *
 * Returns { scheduled, skipped } counts.
 */
export const scheduleAllTasks = action({
  args: {
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{ scheduled: number; skipped: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Fetch user preferences
    const user = await ctx.runQuery(internal.queries.users.getUserInternal, { userId });
    if (!user) throw new Error("User not found");

    const focusBlockLength: number = user.focusBlockLength ?? 60;
    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user.productivityTraits;

    // Fetch all tasks for user
    const allTasks = await ctx.runQuery(
      internal.queries.tasks.getAllTasksInternal,
      { userId },
    );

    // Fetch all study blocks for user and group by taskId
    const allBlocksWithTasks = await ctx.runQuery(
      internal.queries.studyBlocks.getAllStudyBlocksWithTasksInternal,
      { userId },
    ) as Array<{
      _id: string;
      taskId: string;
      title: string;
      startTime?: string;
      studyBlockLength: number;
    }>;

    const blocksByTask = new Map<string, typeof allBlocksWithTasks>();
    for (const block of allBlocksWithTasks) {
      if (!blocksByTask.has(block.taskId)) blocksByTask.set(block.taskId, []);
      blocksByTask.get(block.taskId)!.push(block);
    }

    // Find tasks with at least one unscheduled block
    const tasksToSchedule = allTasks
      .filter((t) => {
        const blocks = blocksByTask.get(t._id) ?? [];
        return blocks.some((b) => !b.startTime);
      })
      .sort((a, b) => a.dueDate - b.dueDate || a._creationTime - b._creationTime)
      .slice(0, MAX_TASKS);

    if (tasksToSchedule.length === 0) return { scheduled: 0, skipped: 0 };

    // Fetch calendar events once for the full 21-day window
    const timedEvents = await fetch21DayCalendarEvents(ctx, args.timezone);

    // Build initial occupied intervals from calendar events + already-scheduled blocks
    const occupiedIntervals: OccupiedInterval[] = [
      ...timedEvents.map((e) => ({
        startMs: new Date(e.start).getTime(),
        endMs: new Date(e.end).getTime(),
        title: e.summary,
      })),
      ...allBlocksWithTasks
        .filter((b) => b.startTime)
        .map((b) => ({
          startMs: new Date(b.startTime!).getTime(),
          endMs: new Date(b.startTime!).getTime() + b.studyBlockLength * 60000,
          title: b.title,
        })),
    ];

    // Shared slot pool — extended incrementally as tasks are processed
    const pool: PoolSlot[] = [];
    const nowMs = Date.now();
    const horizonMs = nowMs + SCHEDULE_HORIZON_MS;
    let scanCursor = roundUpTo15Min(nowMs);

    let scheduled = 0;
    let skipped = 0;

    for (const task of tasksToSchedule) {
      const unscheduledBlocks = (blocksByTask.get(task._id) ?? []).filter(
        (b) => !b.startTime,
      );
      if (unscheduledBlocks.length === 0) continue;

      // Extend the pool forward to min(task.dueDate, 21-day horizon)
      const poolTarget = Math.min(task.dueDate, horizonMs);
      if (scanCursor < poolTarget) {
        scanCursor = extendSlotPool({
          pool,
          scanCursor,
          targetMs: poolTarget,
          focusBlockLengthMinutes: focusBlockLength,
          workHoursGrid,
          occupiedIntervals,
          timezone: args.timezone,
        });
      }

      let taskScheduled = false;
      for (const block of unscheduledBlocks) {
        const candidates = filterPoolForBlock({
          pool,
          dueDateMs: task.dueDate,
          durationMinutes: block.studyBlockLength,
          workHoursGrid,
          occupiedIntervals,
          timezone: args.timezone,
        });

        if (candidates.length === 0) break; // No slots for this block — skip task

        const chosen = await selectSlotWithAI({
          candidates,
          taskTitle: task.title,
          dueDate: task.dueDate,
          productivityTraits,
        });

        if (!chosen) break;

        await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
          studyBlockId: block._id as any,
          startTime: chosen.startISO,
        });

        // Remove placed slot from pool and add to occupied intervals
        const poolIdx = pool.findIndex((s) => s.startMs === chosen.startMs);
        if (poolIdx !== -1) pool.splice(poolIdx, 1);

        occupiedIntervals.push({
          startMs: chosen.startMs,
          endMs: chosen.startMs + block.studyBlockLength * 60000,
          title: block.title,
        });

        taskScheduled = true;
      }

      if (taskScheduled) {
        scheduled++;
      } else {
        skipped++;
      }
    }

    return { scheduled, skipped };
  },
});
