"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import {
  extendSlotPool,
  filterPoolForBlock,
  isSlotValid,
  isDailyCapReached,
  selectAllSlotsWithAI,
  roundUpTo15Min,
  buildDailyLoadMap,
  computeMaxBlocksPerDay,
  toDateStr,
  SCHEDULE_HORIZON_MS,
  type OccupiedInterval,
  type WorkHoursRow,
  type PoolSlot,
} from "../lib/scheduleSlots";
import { fetch21DayCalendarEvents } from "../lib/calendarFetch";

const MAX_BLOCKS = 20;

/**
 * AI-driven bulk scheduling for all unscheduled blocks belonging to a task
 * and its subtasks.
 *
 * Operates at the block level directly. Blocks are sorted by parent due date
 * ASC → parent assignment weight DESC → block creation time ASC, then
 * scheduled in one shared pool + AI pass.
 *
 * Returns { scheduled, skipped } block counts.
 */
export const scheduleAllBlocks = action({
  args: {
    taskId: v.id("tasks"),
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{ scheduled: number; skipped: number; conflicted: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const user = await ctx.runQuery(internal.queries.users.getUserInternal, { userId });
    if (!user) throw new Error("User not found");

    const focusBlockLength: number = user.focusBlockLength ?? 60;
    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user.productivityTraits;
    const preferredDays: string[] = (productivityTraits as any)?.dayOfWeek ?? [];

    // Fetch raw blocks, tasks, and subtasks
    const allBlocks = await ctx.runQuery(
      internal.queries.studyBlocks.getAllStudyBlocksByUserInternal,
      { userId },
    ) as Array<{
      _id: string;
      taskId?: string;
      subtaskId?: string;
      title: string;
      startTime?: string;
      isConflicted?: boolean;
      studyBlockLength: number;
      _creationTime: number;
    }>;

    const allTasks = await ctx.runQuery(
      internal.queries.tasks.getAllTasksInternal,
      { userId },
    ) as Array<{
      _id: string;
      title: string;
      dueDate: number;
      assignmentWeight?: number;
      recommendedStart?: number;
      _creationTime: number;
    }>;

    const allSubtasks = await ctx.runQuery(
      internal.queries.subtasks.getAllSubtasksInternal,
      { userId },
    ) as Array<{
      _id: string;
      parentTaskId: string;
      title: string;
      dueDate?: number;
      suggestedCompletionAt?: number;
      _creationTime: number;
    }>;

    const taskMap = new Map(allTasks.map((t) => [t._id, t]));
    // Only subtasks that belong to the target task
    const subtaskMap = new Map(
      allSubtasks
        .filter((s) => s.parentTaskId === args.taskId)
        .map((s) => [s._id, s]),
    );
    const subtaskIds = new Set(subtaskMap.keys());

    // Resolve parent context for each unscheduled block and build sortable entries
    type BlockEntry = {
      block: (typeof allBlocks)[0];
      parentTitle: string;
      parentDueDate: number;
      parentWeight: number;
      recommendedStart: number | undefined;
      candidates: ReturnType<typeof filterPoolForBlock>;
    };

    const isTaskBlock = (b: { taskId?: string; subtaskId?: string }) =>
      b.taskId === args.taskId || (b.subtaskId !== undefined && subtaskIds.has(b.subtaskId));

    // Only unscheduled blocks belonging to this task or one of its subtasks
    const unscheduled = allBlocks.filter((b) => !b.startTime && isTaskBlock(b));
    // Conflicted blocks exist for this task but are handled by auto-reschedule, not this action
    const conflictedCount = allBlocks.filter((b) => b.startTime && b.isConflicted && isTaskBlock(b)).length;

    type ResolvedBlock = {
      block: (typeof allBlocks)[0];
      parentTitle: string;
      parentDueDate: number;
      parentWeight: number;
      recommendedStart: number | undefined;
    };

    const resolved: ResolvedBlock[] = [];

    for (const block of unscheduled) {
      if (block.taskId) {
        const task = taskMap.get(block.taskId);
        if (!task) continue;
        resolved.push({
          block,
          parentTitle: task.title,
          parentDueDate: task.dueDate,
          parentWeight: task.assignmentWeight ?? 0,
          recommendedStart: task.recommendedStart,
        });
      } else if (block.subtaskId) {
        const subtask = subtaskMap.get(block.subtaskId);
        if (!subtask) continue;
        const parentTask = taskMap.get(subtask.parentTaskId);
        const parentDueDate =
          subtask.suggestedCompletionAt ??
          subtask.dueDate ??
          parentTask?.dueDate ??
          Date.now();
        resolved.push({
          block,
          parentTitle: subtask.title,
          parentDueDate,
          parentWeight: parentTask?.assignmentWeight ?? 0,
          recommendedStart: parentTask?.recommendedStart,
        });
      }
    }

    const sorted = resolved
      .sort(
        (a, b) =>
          a.parentDueDate - b.parentDueDate ||
          b.parentWeight - a.parentWeight ||
          a.block._creationTime - b.block._creationTime,
      )
      .slice(0, MAX_BLOCKS);

    if (sorted.length === 0) return { scheduled: 0, skipped: 0, conflicted: conflictedCount };

    // Fetch calendar events once for the full 21-day window
    const timedEvents = await fetch21DayCalendarEvents(ctx, args.timezone);

    // Build occupied intervals from calendar events + already-scheduled blocks
    const occupiedIntervals: OccupiedInterval[] = [
      ...timedEvents.map((e) => ({
        startMs: new Date(e.start).getTime(),
        endMs: new Date(e.end).getTime(),
        title: e.summary,
      })),
      ...allBlocks
        .filter((b) => b.startTime)
        .map((b) => ({
          startMs: new Date(b.startTime!).getTime(),
          endMs: new Date(b.startTime!).getTime() + b.studyBlockLength * 60000,
          title: b.title,
        })),
    ];

    const maxBlocksPerDayMap = computeMaxBlocksPerDay(workHoursGrid, focusBlockLength, preferredDays);
    // speculativeDailyLoadMap is mutated during phase 1 to spread blocks across days.
    // actualDailyLoadMap tracks only real placements and is used for cap enforcement in phase 3.
    const speculativeDailyLoadMap = buildDailyLoadMap(occupiedIntervals, args.timezone, focusBlockLength);
    const actualDailyLoadMap = buildDailyLoadMap(occupiedIntervals, args.timezone, focusBlockLength);

    // Shared slot pool extended incrementally per block
    const pool: PoolSlot[] = [];
    const nowMs = Date.now();
    const horizonMs = nowMs + SCHEDULE_HORIZON_MS;
    let scanCursor = roundUpTo15Min(nowMs);

    // Phase 1: collect (block, candidates) pairs
    const entries: BlockEntry[] = [];

    for (const item of sorted) {
      const poolTarget = Math.min(item.parentDueDate, horizonMs);
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

      const candidates = filterPoolForBlock({
        pool,
        dueDateMs: item.parentDueDate,
        durationMinutes: item.block.studyBlockLength,
        workHoursGrid,
        occupiedIntervals,
        timezone: args.timezone,
        dailyLoadMap: speculativeDailyLoadMap,
        maxBlocksPerDayMap,
        recommendedStartMs: item.recommendedStart,
      });

      if (candidates.length === 0) continue;

      // Speculatively reserve the first candidate's day so subsequent blocks
      // in this run see an updated load and spread across days.
      const reservedDate = toDateStr(new Date(candidates[0].startMs), args.timezone);
      speculativeDailyLoadMap.set(reservedDate, (speculativeDailyLoadMap.get(reservedDate) ?? 0) + 1);

      entries.push({
        block: item.block,
        parentTitle: item.parentTitle,
        parentDueDate: item.parentDueDate,
        parentWeight: item.parentWeight,
        recommendedStart: item.recommendedStart,
        candidates,
      });
    }

    // Phase 2: one Gemini call for all collected blocks
    const chosenIndices =
      entries.length > 0
        ? await selectAllSlotsWithAI(
            entries.map((e) => ({
              taskTitle: e.parentTitle,
              dueDate: e.parentDueDate,
              recommendedStart: e.recommendedStart,
              candidates: e.candidates,
            })),
            productivityTraits,
          )
        : [];

    // Phase 3: place blocks using AI-chosen slots, with conflict fallback
    let scheduled = 0;
    const skipped = sorted.length - entries.length;

    for (let i = 0; i < entries.length; i++) {
      const { block, candidates } = entries[i];
      const durationMs = block.studyBlockLength * 60000;

      let chosen = candidates[chosenIndices[i] ?? 0];
      const isChosenValid = (c: { startMs: number }) =>
        isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone) &&
        !isDailyCapReached(c.startMs, args.timezone, actualDailyLoadMap, maxBlocksPerDayMap);
      if (!isChosenValid(chosen)) {
        const fallback = candidates.find(isChosenValid);
        if (!fallback) continue;
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

      const placedDateStr = toDateStr(new Date(chosen.startMs), args.timezone);
      actualDailyLoadMap.set(placedDateStr, (actualDailyLoadMap.get(placedDateStr) ?? 0) + 1);

      scheduled++;
    }

    return { scheduled, skipped: skipped + (entries.length - scheduled), conflicted: conflictedCount };
  },
});
