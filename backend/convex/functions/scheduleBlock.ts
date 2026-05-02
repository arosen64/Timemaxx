import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import {
  extendSlotPool,
  isSlotValid,
  selectAllSlotsWithAI,
  roundUpTo15Min,
  buildDailyLoadMap,
  buildSlotContext,
  toDateStr,
  SCHEDULE_HORIZON_MS,
  DEFAULT_DUE_FALLBACK_MS,
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

const MAX_CANDIDATES = 20;

/**
 * AI-driven scheduling for a single study block.
 *
 * Mirrors the batch scheduling logic in scheduleAllBlocks for one block:
 * builds a slot pool, scores all physically valid slots across the full
 * window, slices the top MAX_CANDIDATES by score, and asks Gemini to pick.
 *
 * Returns { scheduled: 1 } on success, or { error: "no_slot_found" } if
 * no valid slot could be found.
 */
export const scheduleBlock = action({
  args: {
    studyBlockId: v.id("studyBlocks"),
    timezone: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ scheduled: number } | { error: string; skippedReason: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Fetch the block and verify ownership
    const block = await ctx.runQuery(internal.queries.studyBlocks.getStudyBlockInternal, {
      studyBlockId: args.studyBlockId,
    });
    if (!block) throw new Error("Study block not found");
    if (!block.taskId && !block.subtaskId)
      throw new Error("Block is not associated with a task or subtask");
    // Allow rescheduling conflicted blocks that already have a startTime
    if (block.startTime && !block.isConflicted) return { scheduled: 0 };

    let taskTitle: string;
    let dueDate: number;
    let recommendedStart: number | undefined;
    let courseId: string | undefined;

    if (block.subtaskId) {
      const subtask = await ctx.runQuery(internal.queries.subtasks.getSubtaskInternal, {
        subtaskId: block.subtaskId,
      });
      if (!subtask || subtask.userId !== userId) throw new Error("Unauthorized");
      taskTitle = subtask.title;
      const parentTask = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
        taskId: subtask.parentTaskId,
      });
      dueDate =
        subtask.suggestedCompletionAt ??
        subtask.dueDate ??
        parentTask?.dueDate ??
        Date.now() + DEFAULT_DUE_FALLBACK_MS;
      recommendedStart = parentTask?.recommendedStart;
      courseId = parentTask?.courseId as string | undefined;
    } else {
      // block.taskId is non-null here: the guard above ensures at least one of taskId/subtaskId is set
      const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
        taskId: block.taskId!,
      });
      if (!task || task.userId !== userId) throw new Error("Unauthorized");
      taskTitle = task.title;
      dueDate = task.dueDate;
      recommendedStart = task.recommendedStart;
      courseId = task.courseId as string | undefined;
    }

    // Fetch user preferences, calendar events, and courses in parallel
    const [user, timedEvents, allUserBlocks, userCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId }),
      fetch21DayCalendarEvents(ctx, args.timezone),
      ctx.runQuery(internal.queries.studyBlocks.getAllStudyBlocksByUserInternal, { userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId }) as Promise<
        Array<{ _id: string; difficultyRating?: number }>
      >,
    ]);
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
    const difficultyRating = courseId
      ? userCourses.find((c) => c._id === courseId)?.difficultyRating
      : undefined;

    // Build occupied intervals from calendar events + already-scheduled blocks
    // (excluding the block being scheduled itself, in case it's a conflicted reschedule)
    const occupiedIntervals: OccupiedInterval[] = [
      ...timedEvents.map((e) => ({
        startMs: new Date(e.start).getTime(),
        endMs: new Date(e.end).getTime(),
        title: e.summary,
      })),
      ...(
        allUserBlocks as Array<{
          _id: string;
          startTime?: string;
          studyBlockLength: number;
          title: string;
        }>
      )
        .filter((b) => b.startTime && b._id !== args.studyBlockId)
        .map((b) => ({
          startMs: new Date(b.startTime!).getTime(),
          endMs: new Date(b.startTime!).getTime() + b.studyBlockLength * 60000,
          title: b.title,
        })),
    ];

    // dailyLoadMap feeds the dailyLoadPenalty in scoreCandidate (soft signal, no hard cap).
    const dailyLoadMap = buildDailyLoadMap(occupiedIntervals, args.timezone, focusBlockLength);

    const nowMs = Date.now();
    const horizonMs = nowMs + SCHEDULE_HORIZON_MS;
    const poolTarget = Math.min(dueDate, horizonMs);

    // Build slot pool up to dueDate (or horizon, whichever is sooner)
    const pool: PoolSlot[] = [];
    const scanCursor = roundUpTo15Min(nowMs);
    if (scanCursor < poolTarget) {
      extendSlotPool({
        pool,
        scanCursor,
        targetMs: poolTarget,
        focusBlockLengthMinutes: focusBlockLength,
        workHoursGrid,
        occupiedIntervals,
        timezone: args.timezone,
        recommendedStartMs: recommendedStart,
      });
    }

    // Pre-sort occupiedIntervals by startMs once so buildSlotContext can use binary search
    const sortedOccupied = [...occupiedIntervals].sort((a, b) => a.startMs - b.startMs);

    type ScoredSlot = CandidateSlot & { score: number; scoreBreakdown: ScoreBreakdown };
    const slotTimeCache = new Map<
      number,
      { dayOfWeek: string; minutesFromMidnight: number; dateStr: string }
    >();
    const blockDurationMs = block.studyBlockLength * 60000;

    // Score every physically valid slot across the full window.
    const scoredSlots: ScoredSlot[] = [];
    for (const s of pool) {
      if (s.startMs >= dueDate) continue;
      if (s.startMs + blockDurationMs > dueDate) continue;
      if (recommendedStart !== undefined && s.startMs < recommendedStart) continue;
      if (!isSlotValid(s.startMs, blockDurationMs, workHoursGrid, occupiedIntervals, args.timezone))
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
        dailyLoadCount: dailyLoadMap.get(cached.dateStr) ?? 0,
        difficultyRating,
        deadlineBehavior,
        dueDateMs: dueDate,
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

    if (scoredSlots.length === 0)
      return { error: "no_slot_found", skippedReason: "No open time slots before your deadline." };

    scoredSlots.sort((a, b) => b.score - a.score);
    const candidates = scoredSlots.slice(0, MAX_CANDIDATES);

    const { indices: chosenIndices } = await selectAllSlotsWithAI(
      [{ taskTitle, dueDate, recommendedStart, candidates }],
      user.productivityTraits
    );

    // Physical-validity fallback (mirrors scheduleAllBlocks Phase 3)
    const isPhysValid = (c: { startMs: number }) =>
      isSlotValid(c.startMs, blockDurationMs, workHoursGrid, occupiedIntervals, args.timezone);

    let chosen = candidates[chosenIndices[0] ?? 0];
    if (!isPhysValid(chosen)) {
      const fallback = candidates.find(isPhysValid);
      if (!fallback)
        return { error: "no_slot_found", skippedReason: "Your schedule is too full to fit this block." };
      chosen = fallback;
    }

    await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
      studyBlockId: args.studyBlockId,
      startTime: chosen.startISO,
    });

    return { scheduled: 1 };
  },
});
