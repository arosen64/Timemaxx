import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  extendSlotPool,
  isSlotValid,
  selectAllSlotsWithAI,
  roundUpTo15Min,
  buildDailyLoadMap,
  buildSlotContext,
  toDateStr,
  SCHEDULE_HORIZON_MS,
  type CandidateSlot,
  type OccupiedInterval,
  type WorkHoursRow,
  type PoolSlot,
} from "../lib/scheduleSlots";
import {
  parseTimeOfDayRanges,
  scoreCandidate,
  getProductivityTraits,
  getSlotTimeInfo,
  type ScoreBreakdown,
} from "../lib/scoreSlots";
import { fetch21DayCalendarEvents } from "../lib/calendarFetch";

const MAX_BLOCKS = 10;
const MAX_CANDIDATES = 20;

/**
 * AI-driven bulk scheduling for all unscheduled blocks belonging to a task
 * and its subtasks.
 *
 * Operates at the block level directly. Blocks are sorted by parent due date
 * ASC → parent assignment weight DESC → block creation time ASC, then
 * scheduled in one shared pool + AI pass.
 *
 * Phase 1 scores every physically valid slot across the full scheduling window
 * and takes the top MAX_CANDIDATES by score. Day preference, time-of-day
 * preference, and daily load spread are all handled through scoring rather than
 * hard gates, so preferred days/times naturally rise to the top.
 *
 * Returns { scheduled, skipped, conflicted } block counts.
 */
export const scheduleAllBlocks = action({
  args: {
    taskId: v.id("tasks"),
    timezone: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    scheduled: number;
    skipped: number;
    conflicted: number;
    skippedReason: string | null;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task || task.userId !== userId) throw new Error("Task not found");

    const user = await ctx.runQuery(internal.queries.users.getUserInternal, { userId });
    if (!user) throw new Error("User not found");

    const focusBlockLength: number = user.focusBlockLength ?? 60;
    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const {
      dayOfWeek: preferredDays,
      timeOfDay: timeOfDayPrefs,
      deadlineBehavior,
    } = getProductivityTraits(user.productivityTraits);
    const timeOfDayRanges = parseTimeOfDayRanges(timeOfDayPrefs);
    const dayOfWeekPrefs: string[] = preferredDays;

    // Fetch raw blocks, tasks, and subtasks
    const allBlocks = (await ctx.runQuery(
      internal.queries.studyBlocks.getAllStudyBlocksByUserInternal,
      { userId }
    )) as Array<{
      _id: Id<"studyBlocks">;
      taskId?: string;
      subtaskId?: string;
      title: string;
      startTime?: string;
      isConflicted?: boolean;
      studyBlockLength: number;
      _creationTime: number;
    }>;

    const [allTasks, allSubtasks, userCourses] = await Promise.all([
      ctx.runQuery(internal.queries.tasks.getAllTasksInternal, { userId }) as Promise<
        Array<{
          _id: string;
          title: string;
          dueDate: number;
          courseId?: string;
          assignmentWeight?: number;
          recommendedStart?: number;
          _creationTime: number;
        }>
      >,
      ctx.runQuery(internal.queries.subtasks.getAllSubtasksInternal, { userId }) as Promise<
        Array<{
          _id: string;
          parentTaskId: string;
          title: string;
          dueDate?: number;
          suggestedCompletionAt?: number;
          _creationTime: number;
        }>
      >,
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId }) as Promise<
        Array<{
          _id: string;
          difficultyRating?: number;
        }>
      >,
    ]);

    const taskMap = new Map(allTasks.map((t) => [t._id, t]));
    const difficultyMap = new Map(userCourses.map((c) => [c._id, c.difficultyRating]));
    // Only subtasks that belong to the target task
    const subtaskMap = new Map(
      allSubtasks.filter((s) => s.parentTaskId === args.taskId).map((s) => [s._id, s])
    );
    const subtaskIds = new Set(subtaskMap.keys());

    type ScoredSlot = CandidateSlot & { score: number; scoreBreakdown: ScoreBreakdown };
    type BlockEntry = {
      block: (typeof allBlocks)[0];
      parentTitle: string;
      parentDueDate: number;
      parentWeight: number;
      recommendedStart: number | undefined;
      candidates: ScoredSlot[];
    };

    const isTaskBlock = (b: { taskId?: string; subtaskId?: string }) =>
      b.taskId === args.taskId || (b.subtaskId !== undefined && subtaskIds.has(b.subtaskId));

    // Only unscheduled blocks belonging to this task or one of its subtasks
    const unscheduled = allBlocks.filter((b) => !b.startTime && isTaskBlock(b));
    // Conflicted blocks are handled by auto-reschedule, not this action
    const conflictedCount = allBlocks.filter(
      (b) => b.startTime && b.isConflicted && isTaskBlock(b)
    ).length;

    type ResolvedBlock = {
      block: (typeof allBlocks)[0];
      parentTitle: string;
      parentDueDate: number;
      parentWeight: number;
      recommendedStart: number | undefined;
      difficultyRating: number | undefined;
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
          difficultyRating: task.courseId ? difficultyMap.get(task.courseId) : undefined,
        });
      } else if (block.subtaskId) {
        const subtask = subtaskMap.get(block.subtaskId);
        if (!subtask) continue;
        const parentTask = taskMap.get(subtask.parentTaskId);
        const parentDueDate =
          subtask.suggestedCompletionAt ?? subtask.dueDate ?? parentTask?.dueDate ?? Date.now();
        resolved.push({
          block,
          parentTitle: subtask.title,
          parentDueDate,
          parentWeight: parentTask?.assignmentWeight ?? 0,
          recommendedStart: parentTask?.recommendedStart,
          difficultyRating: parentTask?.courseId
            ? difficultyMap.get(parentTask.courseId)
            : undefined,
        });
      }
    }

    const sorted = resolved
      .sort(
        (a, b) =>
          a.parentDueDate - b.parentDueDate ||
          b.parentWeight - a.parentWeight ||
          a.block._creationTime - b.block._creationTime
      )
      .slice(0, MAX_BLOCKS);

    if (sorted.length === 0)
      return { scheduled: 0, skipped: 0, conflicted: conflictedCount, skippedReason: null };

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

    // speculativeDailyLoadMap feeds the dailyLoadPenalty in scoreCandidate.
    // It starts from existing intervals and is incremented after each block is
    // assigned, so successive blocks score already-chosen days lower and spread
    // naturally without a hard cap.
    const speculativeDailyLoadMap = buildDailyLoadMap(
      occupiedIntervals,
      args.timezone,
      focusBlockLength
    );

    // Shared slot pool extended incrementally per block
    const pool: PoolSlot[] = [];
    const nowMs = Date.now();
    const horizonMs = nowMs + SCHEDULE_HORIZON_MS;
    let scanCursor = roundUpTo15Min(nowMs);

    // Pre-sort occupiedIntervals by startMs once so buildSlotContext can use
    // binary search instead of a full linear scan for every scored slot.
    // Phase 3 pushes new intervals after Phase 1 completes, so the sorted
    // snapshot is stable for the entire scoring loop.
    const sortedOccupied = [...occupiedIntervals].sort((a, b) => a.startMs - b.startMs);

    // Phase 1: score all physically valid slots globally; take top MAX_CANDIDATES by score
    // slotTimeCache amortizes the Intl.DateTimeFormat calls in scoreCandidate across
    // all blocks scored against the same pool slot.
    const slotTimeCache = new Map<
      number,
      { dayOfWeek: string; minutesFromMidnight: number; dateStr: string }
    >();
    const entries: BlockEntry[] = [];
    const zeroCandidateBlocks: { parentTitle: string; parentDueDate: number; recommendedStart: number | undefined }[] = [];

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
          recommendedStartMs: item.recommendedStart,
        });
      }

      const blockDurationMs = item.block.studyBlockLength * 60000;

      // Score every physically valid slot across the full window.
      // Scoring naturally handles: day preference (+1), time-of-day preference (+2),
      // daily load spread (−1 per existing block, max −3).
      const scoredSlots: ScoredSlot[] = [];
      for (const s of pool) {
        if (s.startMs >= item.parentDueDate) continue;
        if (s.startMs + blockDurationMs > item.parentDueDate) continue;
        if (item.recommendedStart !== undefined && s.startMs < item.recommendedStart) continue;
        if (
          !isSlotValid(s.startMs, blockDurationMs, workHoursGrid, occupiedIntervals, args.timezone)
        )
          continue;

        const endMs = s.startMs + blockDurationMs;
        const context = buildSlotContext(s.startMs, endMs, occupiedIntervals, sortedOccupied);

        if (!slotTimeCache.has(s.startMs)) {
          slotTimeCache.set(s.startMs, {
            ...getSlotTimeInfo(s.startMs, args.timezone),
            dateStr: toDateStr(new Date(s.startMs), args.timezone),
          });
        }
        const cached = slotTimeCache.get(s.startMs)!;

        const { score, scoreBreakdown } = scoreCandidate({
          startMs: s.startMs,
          timezone: args.timezone,
          precomputed: cached,
          timeOfDayRanges,
          dayOfWeekPrefs,
          minutesSincePreviousEvent: context.minutesSincePreviousEvent,
          minutesUntilNextEvent: context.minutesUntilNextEvent,
          dailyLoadCount: speculativeDailyLoadMap.get(cached.dateStr) ?? 0,
          difficultyRating: item.difficultyRating,
          deadlineBehavior,
          dueDateMs: item.parentDueDate,
          nowMs,
        });

        scoredSlots.push({
          startMs: s.startMs,
          startISO: new Date(s.startMs).toISOString(),
          ...context,
          score,
          scoreBreakdown,
        });
      }

      if (scoredSlots.length === 0) {
        zeroCandidateBlocks.push({
          parentTitle: item.parentTitle,
          parentDueDate: item.parentDueDate,
          recommendedStart: item.recommendedStart,
        });
        continue;
      }

      scoredSlots.sort((a, b) => b.score - a.score);
      const candidates = scoredSlots.slice(0, MAX_CANDIDATES);

      // Increment speculative load for the top candidate's day so the next block
      // scores that day lower, spreading blocks across days.
      // Slack: if Gemini picks a lower-scored candidate on a different day,
      // this day gets one phantom load unit. Phase 3 will also increment the
      // actually-placed day, so at most one day is slightly over-counted per
      // block. The bias is toward spreading further rather than bunching, which
      // is the desired behavior.
      const topDateStr = slotTimeCache.get(candidates[0].startMs)!.dateStr;
      speculativeDailyLoadMap.set(topDateStr, (speculativeDailyLoadMap.get(topDateStr) ?? 0) + 1);

      entries.push({
        block: item.block,
        parentTitle: item.parentTitle,
        parentDueDate: item.parentDueDate,
        parentWeight: item.parentWeight,
        recommendedStart: item.recommendedStart,
        candidates,
      });
    }

    // Phase 2: one AI call for schedulable blocks + zero-candidate blocks (for reasons)
    const aiBatch = [
      ...entries.map((e) => ({
        taskTitle: e.parentTitle,
        dueDate: e.parentDueDate,
        recommendedStart: e.recommendedStart,
        candidates: e.candidates,
      })),
      ...zeroCandidateBlocks.map((z) => ({
        taskTitle: z.parentTitle,
        dueDate: z.parentDueDate,
        recommendedStart: z.recommendedStart,
        candidates: [] as typeof entries[0]["candidates"],
        cannotSchedule: true as const,
      })),
    ];

    const { indices: chosenIndices, overallSkipReason: aiSkipReason } =
      aiBatch.length > 0
        ? await selectAllSlotsWithAI(aiBatch, user.productivityTraits)
        : { indices: [], overallSkipReason: null };

    // Phase 3: place blocks using AI-chosen slots, with physical-validity fallback
    let scheduled = 0;
    let phase3Skipped = 0;

    for (let i = 0; i < entries.length; i++) {
      const { block, candidates } = entries[i];
      const durationMs = block.studyBlockLength * 60000;

      const isPhysValid = (c: { startMs: number }) =>
        isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone);

      let chosen = candidates[chosenIndices[i] ?? 0];
      if (!isPhysValid(chosen)) {
        const fallback = candidates.find(isPhysValid);
        if (!fallback) {
          phase3Skipped++;
          continue;
        }
        chosen = fallback;
      }

      await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
        studyBlockId: block._id,
        startTime: chosen.startISO,
      });

      occupiedIntervals.push({
        startMs: chosen.startMs,
        endMs: chosen.startMs + durationMs,
        title: block.title,
      });

      const placedDateStr = toDateStr(new Date(chosen.startMs), args.timezone);
      speculativeDailyLoadMap.set(
        placedDateStr,
        (speculativeDailyLoadMap.get(placedDateStr) ?? 0) + 1
      );

      scheduled++;
    }

    const totalSkipped = zeroCandidateBlocks.length + phase3Skipped;
    const skippedReason =
      totalSkipped > 0
        ? (aiSkipReason ?? "Your schedule is too full to place all blocks.")
        : null;

    return {
      scheduled,
      skipped: totalSkipped,
      conflicted: conflictedCount,
      skippedReason,
    };
  },
});
