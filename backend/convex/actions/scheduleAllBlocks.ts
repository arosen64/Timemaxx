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
  handler: async (ctx, args): Promise<{ scheduled: number; skipped: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const user = await ctx.runQuery(internal.queries.users.getUserInternal, { userId });
    if (!user) throw new Error("User not found");

    const focusBlockLength: number = user.focusBlockLength ?? 60;
    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user.productivityTraits;

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

    // Only blocks belonging to this task or one of its subtasks
    const unscheduled = allBlocks.filter(
      (b) => !b.startTime && (b.taskId === args.taskId || (b.subtaskId && subtaskIds.has(b.subtaskId))),
    );

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

    if (sorted.length === 0) return { scheduled: 0, skipped: 0 };

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
        recommendedStartMs: item.recommendedStart,
      });

      if (candidates.length === 0) continue;

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
      if (
        !isSlotValid(chosen.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone)
      ) {
        const fallback = candidates.find((c) =>
          isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone),
        );
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

      scheduled++;
    }

    return { scheduled, skipped: skipped + (entries.length - scheduled) };
  },
});
