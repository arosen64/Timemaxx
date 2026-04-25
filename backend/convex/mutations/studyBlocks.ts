import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

type WorkHoursRow = { day: string; blocked: number[] }
type TimedEventArg = { id: string; summary: string; start: string; end: string; calendarId: string }

const MIN_STUDY_BLOCK_MINUTES = 15;
const MIN_STUDY_BLOCK_ERROR = `Study block length must be at least ${MIN_STUDY_BLOCK_MINUTES} minutes`;


function getLocalTimeInfo(isoString: string, timezone: string): { dayName: string; minutesFromMidnight: number } {
  const dt = new Date(isoString)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt)
  const dayName = parts.find((p) => p.type === "weekday")?.value ?? ""
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10)
  return { dayName, minutesFromMidnight: (hour === 24 ? 0 : hour) * 60 + minute }
}

function isBlockConflicted(
  block: { startTime: string; studyBlockLength: number; googleEventId?: string },
  task: { dueDate: number },
  timedEvents: TimedEventArg[],
  workHoursGrid: WorkHoursRow[],
  timezone: string,
): boolean {
  const startMs = new Date(block.startTime).getTime()
  const endMs = startMs + block.studyBlockLength * 60 * 1000

  // 1. Due date violation — only flag if the task is not already overdue
  const nowMs = Date.now()
  if (task.dueDate > nowMs && (startMs >= task.dueDate || endMs > task.dueDate)) return true

  // 2. Calendar event overlap — skip the block's own exported GCal event
  for (const event of timedEvents) {
    if (block.googleEventId && event.id === block.googleEventId) continue
    const eventStart = new Date(event.start).getTime()
    const eventEnd = new Date(event.end).getTime()
    if (startMs < eventEnd && eventStart < endMs) return true
  }

  // 3. Unavailable slot overlap — use Intl to get local day/time since Convex runs in UTC
  const { dayName, minutesFromMidnight: startMins } = getLocalTimeInfo(block.startTime, timezone)
  const row = workHoursGrid.find((r) => r.day === dayName)
  if (row) {
    const endMins = startMins + block.studyBlockLength
    for (const slotIdx of row.blocked) {
      const slotStartMins = slotIdx * 30
      const slotEndMins = slotStartMins + 30
      if (startMins < slotEndMins && slotStartMins < endMins) return true
    }
  }

  return false
}

const timedEventValidator = v.object({
  id: v.string(),
  summary: v.string(),
  start: v.string(),
  end: v.string(),
  calendarId: v.string(),
})

const workHoursRowValidator = v.object({
  day: v.string(),
  blocked: v.array(v.number()),
})

const studyBlockArgs = {
  taskId: v.id("tasks"),
  title: v.string(),
  studyBlockLength: v.number(),
};

export const createStudyBlock = mutation({
  args: {
    ...studyBlockArgs,
    startTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Unauthorized");

    if (args.studyBlockLength < MIN_STUDY_BLOCK_MINUTES) throw new Error(MIN_STUDY_BLOCK_ERROR);

    return await ctx.db.insert("studyBlocks", {
      taskId: args.taskId,
      userId,
      title: args.title,
      startTime: args.startTime,
      studyBlockLength: args.studyBlockLength,
      isCompleted: false,
    });
  },
});

export const createTaskBlocks = mutation({
  args: {
    taskId: v.id("tasks"),
    blocks: v.array(
      v.object({
        title: v.string(),
        studyBlockLength: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Unauthorized");

    const invalidBlock = args.blocks.find((b) => b.studyBlockLength < MIN_STUDY_BLOCK_MINUTES);
    if (invalidBlock) throw new Error(MIN_STUDY_BLOCK_ERROR);

    const existing = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existing) return;

    for (const block of args.blocks) {
      await ctx.db.insert("studyBlocks", {
        taskId: args.taskId,
        userId,
        title: block.title,
        startTime: undefined,
        studyBlockLength: block.studyBlockLength,
        isCompleted: false,
      });
    }
  },
});

export const deleteStudyBlock = mutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const block = await ctx.db.get(args.studyBlockId);
    if (!block) throw new Error("Study block not found");

    const ownerId = block.taskId
      ? (await ctx.db.get(block.taskId))?.userId
      : block.subtaskId
        ? (await ctx.db.get(block.subtaskId))?.userId
        : undefined;
    if (ownerId !== userId) throw new Error("Unauthorized");

    await ctx.db.delete(args.studyBlockId);
  },
});

export const deleteStudyBlocksForTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Task not found");

    const blocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const block of blocks) {
      await ctx.db.delete(block._id);
    }
  },
});

export const editStudyBlockTime = mutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
    startTime: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const block = await ctx.db.get(args.studyBlockId);
    if (!block) throw new Error("Study block not found");

    const ownerId = block.taskId
      ? (await ctx.db.get(block.taskId))?.userId
      : block.subtaskId
        ? (await ctx.db.get(block.subtaskId))?.userId
        : undefined;
    if (ownerId !== userId) throw new Error("Unauthorized");

    await ctx.db.patch(args.studyBlockId, {
      startTime: args.startTime ?? undefined,
      isConflicted: false,
      needsExport: args.startTime !== null,
    });
  },
});

export const setGoogleEventId = internalMutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.studyBlockId, { googleEventId: args.googleEventId, needsExport: false });
  },
});

export const clearNeedsExport = internalMutation({
  args: { studyBlockId: v.id("studyBlocks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.studyBlockId, { needsExport: false });
  },
});

/**
 * Marks all future study blocks for a user as needing re-export and clears their
 * stale Google Calendar event IDs. Called after a user reconnects Google Calendar
 * so that blocks previously exported to the old calendar get re-created in the new one.
 */
export const flagFutureBlocksForReexport = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const blocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const block of blocks) {
      if (!block.startTime) continue;
      if (new Date(block.startTime).getTime() <= now) continue;
      if (!block.googleEventId && block.needsExport !== false) continue;
      await ctx.db.patch(block._id, { needsExport: true, googleEventId: undefined });
    }
  },
});

export const setConflictStatus = internalMutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
    isConflicted: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.studyBlockId, { isConflicted: args.isConflicted });
  },
});

export const setStudyBlockTime = internalMutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
    startTime: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.studyBlockId, {
      startTime: args.startTime ?? undefined,
    });
  },
});

/**
 * Places a study block at a chosen start time and clears any conflict status.
 * Called from AI scheduling actions.
 */
export const placeStudyBlock = internalMutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
    startTime: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.studyBlockId, {
      startTime: args.startTime,
      isConflicted: false,
    });
  },
});

export const detectConflicts = internalMutation({
  args: {
    userId: v.id("users"),
    timedEvents: v.array(timedEventValidator),
    workHoursGrid: v.array(workHoursRowValidator),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId as Id<"users">))
      .collect();

    for (const task of tasks) {
      const blocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();

      for (const block of blocks) {
        if (!block.startTime) {
          if (block.isConflicted) {
            await ctx.db.patch(block._id, { isConflicted: false });
          }
          continue;
        }

        const endMs = new Date(block.startTime).getTime() + block.studyBlockLength * 60 * 1000;
        if (endMs <= nowMs) {
          if (block.isConflicted) {
            await ctx.db.patch(block._id, { isConflicted: false });
          }
          continue;
        }

        const conflicted = isBlockConflicted(
          { startTime: block.startTime, studyBlockLength: block.studyBlockLength, googleEventId: block.googleEventId },
          { dueDate: task.dueDate },
          args.timedEvents,
          args.workHoursGrid,
          args.timezone,
        );

        if ((block.isConflicted ?? false) !== conflicted) {
          await ctx.db.patch(block._id, { isConflicted: conflicted });
        }
      }
    }

    // Also check subtask-linked blocks — fetch all user blocks once to avoid N+1
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId as Id<"users">))
      .collect();

    const allUserBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId as Id<"users">))
      .collect();

    const blocksBySubtask = new Map<string, typeof allUserBlocks>();
    for (const block of allUserBlocks) {
      if (!block.subtaskId) continue;
      const key = block.subtaskId as string;
      if (!blocksBySubtask.has(key)) blocksBySubtask.set(key, []);
      blocksBySubtask.get(key)!.push(block);
    }

    for (const subtask of subtasks) {
      const blocks = blocksBySubtask.get(subtask._id as string) ?? [];

      const dueDate = subtask.suggestedCompletionAt ?? subtask.dueDate;
      if (!dueDate) continue;

      for (const block of blocks) {
        if (!block.startTime) {
          if (block.isConflicted) {
            await ctx.db.patch(block._id, { isConflicted: false });
          }
          continue;
        }

        const endMs = new Date(block.startTime).getTime() + block.studyBlockLength * 60 * 1000;
        if (endMs <= nowMs) {
          if (block.isConflicted) {
            await ctx.db.patch(block._id, { isConflicted: false });
          }
          continue;
        }

        const conflicted = isBlockConflicted(
          { startTime: block.startTime, studyBlockLength: block.studyBlockLength, googleEventId: block.googleEventId },
          { dueDate },
          args.timedEvents,
          args.workHoursGrid,
          args.timezone,
        );

        if ((block.isConflicted ?? false) !== conflicted) {
          await ctx.db.patch(block._id, { isConflicted: conflicted });
        }
      }
    }
  },
});

export const splitStudyBlock = mutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
    splitAtMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const block = await ctx.db.get(args.studyBlockId);
    if (!block) throw new Error("Study block not found");

    const ownerId = block.taskId
      ? (await ctx.db.get(block.taskId))?.userId
      : block.subtaskId
        ? (await ctx.db.get(block.subtaskId))?.userId
        : undefined;
    if (ownerId !== userId) throw new Error("Unauthorized");

    const splitAt = Math.floor(args.splitAtMinutes);
    const remaining = block.studyBlockLength - splitAt;

    if (splitAt < 15 || remaining < 15) {
      throw new Error("Each resulting block must be at least 15 minutes");
    }

    let startTimeB: string | undefined;
    if (block.startTime) {
      const offsetMs = splitAt * 60 * 1000;
      startTimeB = new Date(new Date(block.startTime).getTime() + offsetMs).toISOString();
    }

    await ctx.db.delete(args.studyBlockId);

    const needsExport = block.googleEventId ? true : undefined;

    const blockAId = await ctx.db.insert("studyBlocks", {
      taskId: block.taskId,
      subtaskId: block.subtaskId,
      userId,
      title: block.title,
      startTime: block.startTime,
      studyBlockLength: splitAt,
      needsExport,
      isCompleted: false,
    });

    const blockBId = await ctx.db.insert("studyBlocks", {
      taskId: block.taskId,
      subtaskId: block.subtaskId,
      userId,
      title: block.title,
      startTime: startTimeB,
      studyBlockLength: remaining,
      needsExport,
      isCompleted: false,
    });

    return { blockAId, blockBId };
  },
});

export const toggleStudyBlockComplete = mutation({
  args: { studyBlockId: v.id("studyBlocks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const block = await ctx.db.get(args.studyBlockId);
    if (!block) throw new Error("Study block not found");
    if (block.userId !== userId) throw new Error("Unauthorized");

    const nowCompleted = !block.isCompleted;
    await ctx.db.patch(args.studyBlockId, { isCompleted: nowCompleted });

    if (block.subtaskId) {
      const allSubtaskBlocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_subtaskId", (q) => q.eq("subtaskId", block.subtaskId!))
        .collect();

      const completedCount = allSubtaskBlocks.filter((b) =>
        b._id === args.studyBlockId ? nowCompleted : b.isCompleted
      ).length;

      const subtask = await ctx.db.get(block.subtaskId);
      if (subtask && subtask.userId === userId) {
        let newStatus: "not_started" | "in_progress" | "completed";
        if (completedCount === allSubtaskBlocks.length) {
          newStatus = "completed";
        } else if (completedCount > 0) {
          newStatus = "in_progress";
        } else {
          newStatus = "not_started";
        }
        await ctx.db.patch(block.subtaskId, { status: newStatus });
      }
    }
  },
});

export const runDetectConflicts = mutation({
  args: {
    timedEvents: v.array(timedEventValidator),
    workHoursGrid: v.optional(v.array(workHoursRowValidator)),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    await ctx.runMutation(internal.mutations.studyBlocks.detectConflicts, {
      userId,
      timedEvents: args.timedEvents,
      workHoursGrid: args.workHoursGrid ?? [],
      timezone: args.timezone ?? "UTC",
    });
  },
});
