"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import {
  extendSlotPool,
  filterPoolForBlock,
  isSlotValid,
  selectAllSlotsWithAI,
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
      .sort((a, b) =>
        a.dueDate - b.dueDate ||
        (b.assignmentWeight ?? 0) - (a.assignmentWeight ?? 0) ||
        a._creationTime - b._creationTime
      )
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

    // Phase 1: collect all (task, block, candidates) — extend pool per task as before
    type BlockEntry = {
      taskId: string;
      block: (typeof allBlocksWithTasks)[0];
      candidates: ReturnType<typeof filterPoolForBlock>;
    };
    const entries: BlockEntry[] = [];
    const tasksWithEntries = new Set<string>();

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

      for (const block of unscheduledBlocks) {
        const candidates = filterPoolForBlock({
          pool,
          dueDateMs: task.dueDate,
          durationMinutes: block.studyBlockLength,
          workHoursGrid,
          occupiedIntervals,
          timezone: args.timezone,
        });

        if (candidates.length === 0) break; // No slots — stop collecting for this task
        entries.push({ taskId: task._id, block, candidates });
        tasksWithEntries.add(task._id);
      }

    }

    // Phase 2: one Gemini call for all collected blocks
    const chosenIndices = entries.length > 0
      ? await selectAllSlotsWithAI(
          entries.map((e) => ({
            taskTitle: tasksToSchedule.find((t) => t._id === e.taskId)!.title,
            dueDate: tasksToSchedule.find((t) => t._id === e.taskId)!.dueDate,
            candidates: e.candidates,
          })),
          productivityTraits,
        )
      : [];

    // Phase 3: place blocks using AI-chosen slots, with conflict fallback
    const scheduledTaskIds = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const { taskId, block, candidates } = entries[i];
      const durationMs = block.studyBlockLength * 60000;

      let chosen = candidates[chosenIndices[i] ?? 0];
      if (!isSlotValid(chosen.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone)) {
        const fallback = candidates.find((c) =>
          isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone)
        );
        if (!fallback) continue; // Can't place — leave block unscheduled
        chosen = fallback;
      }

      await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
        studyBlockId: block._id as any,
        startTime: chosen.startISO,
      });

      const poolIdx = pool.findIndex((s) => s.startMs === chosen.startMs);
      if (poolIdx !== -1) pool.splice(poolIdx, 1);

      occupiedIntervals.push({
        startMs: chosen.startMs,
        endMs: chosen.startMs + durationMs,
        title: block.title,
      });

      scheduledTaskIds.add(taskId);
    }

    const scheduled = scheduledTaskIds.size;
    const skipped = tasksToSchedule.filter((t) => !scheduledTaskIds.has(t._id)).length;

    return { scheduled, skipped };
  },
});
