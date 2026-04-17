"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "../_generated/api";
import {
  enumerateSlots,
  selectAllSlotsWithAI,
  DEFAULT_DUE_FALLBACK_MS,
  type OccupiedInterval,
  type WorkHoursRow,
} from "../lib/scheduleSlots";

function toDateStr(d: Date, timezone: string): string {
  return Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
}

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

    if (block.subtaskId) {
      const subtask = await ctx.runQuery(internal.queries.subtasks.getSubtaskInternal, {
        subtaskId: block.subtaskId,
      });
      if (!subtask || subtask.userId !== userId) throw new Error("Unauthorized");
      taskTitle = subtask.title;
      dueDate = subtask.suggestedCompletionAt ?? subtask.dueDate ?? Date.now() + DEFAULT_DUE_FALLBACK_MS;
      creationTime = subtask._creationTime;
    } else {
      const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
        taskId: block.taskId!,
      });
      if (!task || task.userId !== userId) throw new Error("Unauthorized");
      taskTitle = task.title;
      dueDate = task.dueDate;
      creationTime = task._creationTime;
    }

    // Fetch user preferences
    const user = await ctx.runQuery(internal.queries.users.getUserInternal, { userId });
    if (!user) throw new Error("User not found");

    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user.productivityTraits;

    // Fetch calendar events for the 21-day window (best effort)
    const today = new Date();
    const week2Start = new Date(today);
    week2Start.setDate(today.getDate() + 7);
    const week3Start = new Date(today);
    week3Start.setDate(today.getDate() + 14);

    type TimedEvent = { id: string; summary: string; start: string; end: string; calendarId: string };
    let timedEvents: TimedEvent[] = [];
    try {
      const [r1, r2, r3] = await Promise.all([
        ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
          startDate: toDateStr(today, args.timezone),
          timezone: args.timezone,
        }),
        ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
          startDate: toDateStr(week2Start, args.timezone),
          timezone: args.timezone,
        }),
        ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
          startDate: toDateStr(week3Start, args.timezone),
          timezone: args.timezone,
        }),
      ]);
      timedEvents = [...r1.timedEvents, ...r2.timedEvents, ...r3.timedEvents];
    } catch {
      // No calendar connected — schedule against work hours only
    }

    // Build occupied intervals — use by_userId index to cover both task and subtask blocks
    const allUserBlocks = await ctx.runQuery(
      internal.queries.studyBlocks.getAllStudyBlocksByUserInternal,
      { userId },
    );

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

    const nowMs = Date.now();
    const fromMs = Math.max(nowMs, creationTime);

    const candidates = enumerateSlots({
      fromMs,
      dueDateMs: dueDate,
      durationMinutes: block.studyBlockLength,
      workHoursGrid,
      occupiedIntervals,
      timezone: args.timezone,
    });

    if (candidates.length === 0) return { error: "no_slot_found" };

    const [chosenIndex] = await selectAllSlotsWithAI(
      [{ taskTitle, dueDate, candidates }],
      productivityTraits,
    );

    const chosen = candidates[chosenIndex ?? 0];

    await ctx.runMutation(internal.mutations.studyBlocks.placeStudyBlock, {
      studyBlockId: args.studyBlockId,
      startTime: chosen.startISO,
    });

    return { scheduled: 1 };
  },
});
