"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "../_generated/api";
import {
  enumerateSlots,
  selectSlotWithAI,
  type OccupiedInterval,
  type WorkHoursRow,
} from "../lib/scheduleSlots";
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

    // Fetch user preferences
    const user = await ctx.runQuery(internal.queries.users.getUserInternal, {
      userId,
    });
    if (!user) throw new Error("User not found");

    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user.productivityTraits;

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

    const nowMs = Date.now();
    const fromMs = Math.max(nowMs, task._creationTime);
    let scheduled = 0;

    for (const block of unscheduled) {
      const candidates = enumerateSlots({
        fromMs,
        dueDateMs: task.dueDate,
        durationMinutes: block.studyBlockLength,
        workHoursGrid,
        occupiedIntervals,
        timezone: args.timezone,
      });

      if (candidates.length === 0) {
        return { error: "no_slot_found" };
      }

      const chosen = await selectSlotWithAI({
        candidates,
        taskTitle: task.title,
        dueDate: task.dueDate,
        productivityTraits,
      });

      if (!chosen) return { error: "no_slot_found" };

      await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
        studyBlockId: block._id,
        startTime: chosen.startISO,
      });

      // Add placed block to occupied intervals so subsequent blocks don't collide
      occupiedIntervals.push({
        startMs: chosen.startMs,
        endMs: chosen.startMs + block.studyBlockLength * 60000,
        title: block.title,
      });

      scheduled++;
    }

    return { scheduled };
  },
});
