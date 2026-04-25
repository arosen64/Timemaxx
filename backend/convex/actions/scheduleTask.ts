"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "../_generated/api";
import {
  enumerateSlots,
  selectAllSlotsWithAI,
  isSlotValid,
  buildDailyLoadMap,
  computeMaxBlocksPerDay,
  toDateStr,
  type OccupiedInterval,
  type WorkHoursRow,
} from "../lib/scheduleSlots";
import { parseTimeOfDayRanges, scoreCandidate } from "../lib/scoreSlots";
import { fetch21DayCalendarEvents } from "../lib/calendarFetch";

/**
 * AI-driven scheduling for a single task.
 *
 * Enumerates valid time slots for each unscheduled study block belonging to
 * the task, calls Gemini Flash to select the best slot, and places the block.
 *
 * Returns { scheduled: number } on success, or { error: "no_slot_found" } if
 * no valid slot could be found for any block.
 */
export const scheduleTask = action({
  args: {
    taskId: v.id("tasks"),
    timezone: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ scheduled: number } | { error: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Fetch task
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task || task.userId !== userId) throw new Error("Task not found");

    // Fetch user preferences and courses in parallel
    const [user, userCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId }) as Promise<Array<{ _id: string; difficultyRating?: number }>>,
    ]);
    if (!user) throw new Error("User not found");

    const focusBlockLength: number = user.focusBlockLength ?? 60;
    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user.productivityTraits;
    const preferredDays: string[] = (productivityTraits as any)?.dayOfWeek ?? [];
    const timeOfDayRanges = parseTimeOfDayRanges(
      Array.isArray((productivityTraits as any)?.timeOfDay) ? (productivityTraits as any).timeOfDay : [],
    );
    const dayOfWeekPrefs: string[] = preferredDays;
    const courseId = task.courseId as string | undefined;
    const difficultyRating = courseId ? userCourses.find((c) => c._id === courseId)?.difficultyRating : undefined;

    // Fetch unscheduled blocks for this task
    const studyBlocks = await ctx.runQuery(
      api.queries.studyBlocks.getStudyBlocksByTask,
      { taskId: args.taskId },
    );
    const unscheduled = studyBlocks.filter((b) => !b.startTime);
    if (unscheduled.length === 0) return { scheduled: 0 };

    // Fetch calendar events for the 21-day window (best effort)
    const timedEvents = await fetch21DayCalendarEvents(ctx, args.timezone);

    // Build occupied intervals: calendar events + all already-placed study blocks
    const allBlocks = await ctx.runQuery(
      internal.queries.studyBlocks.getAllStudyBlocksWithTasksInternal,
      { userId },
    );

    const occupiedIntervals: OccupiedInterval[] = [
      ...timedEvents.map((e) => ({
        startMs: new Date(e.start).getTime(),
        endMs: new Date(e.end).getTime(),
        title: e.summary,
      })),
      ...(allBlocks as Array<{ startTime?: string; studyBlockLength: number; title: string; taskId: string }>)
        .filter((b) => b.startTime && b.taskId !== args.taskId)
        .map((b) => ({
          startMs: new Date(b.startTime!).getTime(),
          endMs: new Date(b.startTime!).getTime() + b.studyBlockLength * 60000,
          title: b.title,
        })),
    ];

    const maxBlocksPerDayMap = computeMaxBlocksPerDay(workHoursGrid, focusBlockLength, preferredDays);
    const dailyLoadMap = buildDailyLoadMap(occupiedIntervals, args.timezone, focusBlockLength);

    const nowMs = Date.now();
    const fromMs = Math.max(nowMs, task._creationTime);

    // Enumerate candidates for every unscheduled block upfront
    const blockCandidates = unscheduled.map((block) =>
      enumerateSlots({
        fromMs,
        dueDateMs: task.dueDate,
        durationMinutes: block.studyBlockLength,
        workHoursGrid,
        occupiedIntervals,
        timezone: args.timezone,
        dailyLoadMap,
        maxBlocksPerDayMap,
        recommendedStartMs: task.recommendedStart,
      })
    );

    if (blockCandidates.some((c) => c.length === 0)) {
      return { error: "no_slot_found" };
    }

    // Score and sort each block's candidates by fit before the AI call (#507)
    const scoredBlockCandidates = blockCandidates.map((candidates) =>
      candidates
        .map((c) => {
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
          });
          return { ...c, score, scoreBreakdown };
        })
        .sort((a, b) => b.score - a.score),
    );

    // One Gemini call for all blocks
    const chosenIndices = await selectAllSlotsWithAI(
      unscheduled.map((_block, i) => ({
        taskTitle: task.title,
        dueDate: task.dueDate,
        recommendedStart: task.recommendedStart,
        candidates: scoredBlockCandidates[i],
      })),
      productivityTraits,
    );

    let scheduled = 0;

    for (let i = 0; i < unscheduled.length; i++) {
      const block = unscheduled[i];
      const candidates = scoredBlockCandidates[i];
      const durationMs = block.studyBlockLength * 60000;

      // Use AI-chosen index; fall back to first still-valid candidate if it conflicts
      let chosen = candidates[chosenIndices[i]];
      if (!isSlotValid(chosen.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone)) {
        const fallback = candidates.find((c) =>
          isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone)
        );
        if (!fallback) return { error: "no_slot_found" };
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
      dailyLoadMap.set(placedDateStr, (dailyLoadMap.get(placedDateStr) ?? 0) + 1);

      scheduled++;
    }

    return { scheduled };
  },
});
