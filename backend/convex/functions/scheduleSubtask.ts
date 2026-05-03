import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "../_generated/api";
import {
  enumerateSlots,
  selectAllSlotsWithAI,
  isSlotValid,
  DEFAULT_DUE_FALLBACK_MS,
  type OccupiedInterval,
  type WorkHoursRow,
} from "../lib/scheduleSlots";
import { fetch21DayCalendarEvents } from "../lib/calendarFetch";

export const scheduleSubtask = action({
  args: {
    subtaskId: v.id("subtasks"),
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{ scheduled: number } | { error: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const subtask = await ctx.runQuery(internal.queries.subtasks.getSubtaskInternal, {
      subtaskId: args.subtaskId,
    });
    if (!subtask || subtask.userId !== userId) throw new Error("Subtask not found");

    const user = await ctx.runQuery(internal.queries.users.getUserInternal, { userId });
    if (!user) throw new Error("User not found");

    const workHoursGrid = (user.workHoursGrid ?? []) as WorkHoursRow[];
    const productivityTraits: unknown = user.productivityTraits;

    const studyBlocks = await ctx.runQuery(api.queries.studyBlocks.getStudyBlocksBySubtask, {
      subtaskId: args.subtaskId,
    });
    const unscheduled = studyBlocks.filter((b) => !b.startTime);
    if (unscheduled.length === 0) return { scheduled: 0 };

    const timedEvents = await fetch21DayCalendarEvents(ctx, args.timezone);

    // All user blocks by userId index — covers both task-level and subtask-level blocks
    const allUserBlocks = await ctx.runQuery(
      internal.queries.studyBlocks.getAllStudyBlocksByUserInternal,
      { userId }
    );

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
        .filter((b) => b.startTime)
        .map((b) => ({
          startMs: new Date(b.startTime!).getTime(),
          endMs: new Date(b.startTime!).getTime() + b.studyBlockLength * 60000,
          title: b.title,
        })),
    ];

    const nowMs = Date.now();
    const fromMs = Math.max(nowMs, subtask._creationTime);
    const dueDateMs =
      subtask.suggestedCompletionAt ?? subtask.dueDate ?? nowMs + DEFAULT_DUE_FALLBACK_MS;

    const placeable = unscheduled
      .map((block) => ({
        block,
        candidates: enumerateSlots({
          fromMs,
          dueDateMs,
          durationMinutes: block.studyBlockLength,
          workHoursGrid,
          occupiedIntervals,
          timezone: args.timezone,
        }),
      }))
      .filter(({ candidates }) => candidates.length > 0);

    if (placeable.length === 0) return { error: "no_slot_found" };

    const { indices: chosenIndices } = await selectAllSlotsWithAI(
      placeable.map(({ candidates }) => ({
        taskTitle: subtask.title,
        dueDate: dueDateMs,
        candidates,
      })),
      productivityTraits
    );

    let scheduled = 0;

    for (let i = 0; i < placeable.length; i++) {
      const { block, candidates } = placeable[i];
      const durationMs = block.studyBlockLength * 60000;

      let chosen = candidates[chosenIndices[i] ?? 0];
      if (
        !isSlotValid(chosen.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone)
      ) {
        const fallback = candidates.find((c) =>
          isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, args.timezone)
        );
        if (!fallback) continue;
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

      scheduled++;
    }

    return { scheduled };
  },
});
