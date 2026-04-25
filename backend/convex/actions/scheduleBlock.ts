"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import {
  enumerateSlots,
  selectAllSlotsWithAI,
  buildDailyLoadMap,
  computeMaxBlocksPerDay,
  toDateStr,
  DEFAULT_DUE_FALLBACK_MS,
  type OccupiedInterval,
  type WorkHoursRow,
} from "../lib/scheduleSlots";
import { parseTimeOfDayRanges, scoreCandidate, getProductivityTraits } from "../lib/scoreSlots";
import { fetch21DayCalendarEvents } from "../lib/calendarFetch";


/**
 * AI-driven scheduling for a single study block.
 *
 * Enumerates valid time slots for the given block, calls Gemini Flash to
 * select the best slot, and places the block.
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
    args,
  ): Promise<{ scheduled: number } | { error: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Fetch the block and verify ownership
    const block = await ctx.runQuery(
      internal.queries.studyBlocks.getStudyBlockInternal,
      { studyBlockId: args.studyBlockId },
    );
    if (!block) throw new Error("Study block not found");
    if (!block.taskId && !block.subtaskId) throw new Error("Block is not associated with a task or subtask");
    // Allow rescheduling conflicted blocks that already have a startTime
    if (block.startTime && !block.isConflicted) return { scheduled: 0 };

    let taskTitle: string;
    let dueDate: number;
    let creationTime: number;
    let recommendedStart: number | undefined;
    let courseId: string | undefined;

    if (block.subtaskId) {
      const subtask = await ctx.runQuery(internal.queries.subtasks.getSubtaskInternal, {
        subtaskId: block.subtaskId,
      });
      if (!subtask || subtask.userId !== userId) throw new Error("Unauthorized");
      taskTitle = subtask.title;
      dueDate = subtask.suggestedCompletionAt ?? subtask.dueDate ?? Date.now() + DEFAULT_DUE_FALLBACK_MS;
      creationTime = subtask._creationTime;
      const parentTask = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
        taskId: subtask.parentTaskId,
      });
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
      creationTime = task._creationTime;
      recommendedStart = task.recommendedStart;
      courseId = task.courseId as string | undefined;
    }

    // Fetch user preferences, calendar events, and courses in parallel
    const [user, timedEvents, allUserBlocks, userCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId }),
      fetch21DayCalendarEvents(ctx, args.timezone),
      ctx.runQuery(internal.queries.studyBlocks.getAllStudyBlocksByUserInternal, { userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId }) as Promise<Array<{ _id: string; difficultyRating?: number }>>,
    ]);
    if (!user) throw new Error("User not found");

    const focusBlockLength: number = user.focusBlockLength ?? 60;
    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const { dayOfWeek: preferredDays, timeOfDay: timeOfDayPrefs, deadlineBehavior } = getProductivityTraits(user.productivityTraits);
    const timeOfDayRanges = parseTimeOfDayRanges(timeOfDayPrefs);
    const dayOfWeekPrefs: string[] = preferredDays;
    const difficultyRating = courseId
      ? userCourses.find((c) => c._id === courseId)?.difficultyRating
      : undefined;

    const occupiedIntervals: OccupiedInterval[] = [
      ...timedEvents.map((e) => ({
        startMs: new Date(e.start).getTime(),
        endMs: new Date(e.end).getTime(),
        title: e.summary,
      })),
      ...(allUserBlocks as Array<{ _id: string; startTime?: string; studyBlockLength: number; title: string }>)
        .filter((b) => b.startTime && b._id !== args.studyBlockId)
        .map((b) => ({
          startMs: new Date(b.startTime!).getTime(),
          endMs: new Date(b.startTime!).getTime() + b.studyBlockLength * 60000,
          title: b.title,
        })),
    ];

    const maxBlocksPerDayMap = computeMaxBlocksPerDay(workHoursGrid, focusBlockLength, preferredDays);
    const dailyLoadMap = buildDailyLoadMap(occupiedIntervals, args.timezone, focusBlockLength);

    const nowMs = Date.now();
    const fromMs = Math.max(nowMs, creationTime);

    const candidates = enumerateSlots({
      fromMs,
      dueDateMs: dueDate,
      durationMinutes: block.studyBlockLength,
      workHoursGrid,
      occupiedIntervals,
      timezone: args.timezone,
      dailyLoadMap,
      maxBlocksPerDayMap,
      recommendedStartMs: recommendedStart,
    });

    if (candidates.length === 0) return { error: "no_slot_found" };

    const scoredCandidates = candidates.map((c) => {
      const dateStr = toDateStr(new Date(c.startMs), args.timezone);
      const { score, scoreBreakdown } = scoreCandidate({
        startMs: c.startMs,
        timezone: args.timezone,
        timeOfDayRanges,
        dayOfWeekPrefs,
        minutesSincePreviousEvent: c.minutesSincePreviousEvent,
        minutesUntilNextEvent: c.minutesUntilNextEvent,
        dailyLoadCount: dailyLoadMap.get(dateStr) ?? 0,
        difficultyRating,
        deadlineBehavior,
        dueDateMs: dueDate,
        nowMs,
      });
      return { ...c, score, scoreBreakdown };
    });
    scoredCandidates.sort((a, b) => b.score - a.score);

    const [chosenIndex] = await selectAllSlotsWithAI(
      [{ taskTitle, dueDate, recommendedStart, candidates: scoredCandidates }],
      user.productivityTraits,
    );

    const chosen = scoredCandidates[chosenIndex ?? 0];

    await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
      studyBlockId: args.studyBlockId,
      startTime: chosen.startISO,
    });

    return { scheduled: 1 };
  },
});
