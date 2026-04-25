import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { taskTypeValidator } from "../lib/taskValidators";
import { internal } from "../_generated/api";
import { rebuildStudyBlocksForSubtask } from "./timeEstimate";
import { computeRecommendedStart } from "../lib/scheduleSlots";
import { Id } from "../_generated/dataModel";

const reasoningTraceArgs = v.object({
  classes: v.string(),
  tasks: v.string(),
  chats: v.string(),
  profile: v.string(),
});

// Batch variant: validates all subtasks before any inserts to avoid partial writes on failure.
export const createSubtasksBatch = mutation({
  args: {
    parentTaskId: v.id("tasks"),
    subtasks: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        taskType: taskTypeValidator,
        color: v.string(),
        order: v.number(),
        suggestedCompletionAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const parent = await ctx.db.get(args.parentTaskId);
    if (!parent || parent.userId !== userId) {
      throw new Error("Parent task not found");
    }

    for (const s of args.subtasks) {
      if (s.title.trim().length === 0) throw new Error("Title cannot be empty");
      if (s.description.trim().length === 0) throw new Error("Description cannot be empty");
    }

    const now = Date.now();
    const subtaskIds: Id<"subtasks">[] = [];

    for (const s of args.subtasks) {
      const subtaskId = await ctx.db.insert("subtasks", {
        parentTaskId: args.parentTaskId,
        userId,
        title: s.title,
        description: s.description,
        taskType: s.taskType,
        color: s.color,
        order: s.order,
        suggestedCompletionAt: s.suggestedCompletionAt,
        courseId: parent.courseId,
        classTag: parent.classTag,
        dueDate: parent.dueDate,
        createdAt: now,
      });
      subtaskIds.push(subtaskId);
    }

    await ctx.db.patch(args.parentTaskId, { reasoning: undefined });

    if (process.env.ANTHROPIC_API_KEY) {
      for (const subtaskId of subtaskIds) {
        await ctx.scheduler.runAfter(0, internal.ai.estimateTaskTime.estimateTaskTime, {
          subtaskId,
        });
      }
    }

    return subtaskIds;
  },
});

/**
 * Creates a new subtask linked to a parent task.
 * Validates that the parentTaskId references a row in the `tasks` table
 * (not another subtask — infinite nesting is not allowed).
 */
export const createSubtask = mutation({
  args: {
    parentTaskId: v.id("tasks"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    color: v.string(),
    order: v.number(),
    suggestedCompletionAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const parent = await ctx.db.get(args.parentTaskId);
    if (!parent || parent.userId !== userId) {
      throw new Error("Parent task not found");
    }

    if (args.title.trim().length === 0) throw new Error("Title cannot be empty");
    if (args.description.trim().length === 0) throw new Error("Description cannot be empty");

    const subtaskId = await ctx.db.insert("subtasks", {
      parentTaskId: args.parentTaskId,
      userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      color: args.color,
      order: args.order,
      suggestedCompletionAt: args.suggestedCompletionAt,
      // Inherit course, class tag, and due date from parent
      courseId: parent.courseId,
      classTag: parent.classTag,
      dueDate: parent.dueDate,
      createdAt: Date.now(),
    });

    // Parent time is rolled up from subtasks; drop any prior whole-task AI reasoning
    // so we never show stale explanations alongside a summed estimate.
    await ctx.db.patch(args.parentTaskId, { reasoning: undefined });

    if (process.env.ANTHROPIC_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.ai.estimateTaskTime.estimateTaskTime, {
        subtaskId,
      });
    }
    await ctx.scheduler.runAfter(0, internal.ai.embeddings.generateSubtaskEmbedding, {
      subtaskId,
      title: args.title,
      description: args.description,
    });

    return subtaskId;
  },
});

/**
 * Updates editable fields on an existing subtask.
 */
export const updateSubtask = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    suggestedCompletionAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.userId !== userId) throw new Error("Subtask not found");

    if (args.title.trim().length === 0) throw new Error("Title cannot be empty");
    if (args.description.trim().length === 0) throw new Error("Description cannot be empty");

    await ctx.db.patch(args.subtaskId, {
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      suggestedCompletionAt: args.suggestedCompletionAt,
      timeEstimate: undefined,
      reasoning: undefined,
    });

    if (process.env.ANTHROPIC_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.ai.estimateTaskTime.estimateTaskTime, {
        subtaskId: args.subtaskId,
      });
    }
    await ctx.scheduler.runAfter(0, internal.ai.embeddings.generateSubtaskEmbedding, {
      subtaskId: args.subtaskId,
      title: args.title,
      description: args.description,
    });
  },
});

/**
 * Sets the time estimate on a subtask. Called by estimateSubtaskTime action.
 */
export const setSubtaskTimeEstimate = internalMutation({
  args: {
    subtaskId: v.id("subtasks"),
    timeEstimate: v.number(),
    reasoning: reasoningTraceArgs,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subtaskId, {
      timeEstimate: args.timeEstimate,
      reasoning: args.reasoning,
    });

    // Roll up: sum all sibling estimates and patch parent task
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) return;

    const siblings = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", subtask.parentTaskId))
      .collect();

    const total = siblings.reduce((sum, s) => sum + (s.timeEstimate ?? 0), 0);
    const parent = await ctx.db.get(subtask.parentTaskId);
    await ctx.db.patch(subtask.parentTaskId, {
      timeEstimate: total,
      recommendedStart: parent
        ? computeRecommendedStart(Date.now(), parent.dueDate, total)
        : undefined,
    });

    // Delete any stale task-level blocks on the parent so they don't co-exist
    // with subtask-owned blocks. Done unconditionally so a 0-estimate subtask
    // still clears stale blocks.
    const staleTaskBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", subtask.parentTaskId))
      .collect();
    for (const block of staleTaskBlocks) {
      await ctx.db.delete(block._id);
    }

    // Build blocks for this subtask immediately — each subtask owns its own blocks.
    if (args.timeEstimate > 0) {
      await rebuildStudyBlocksForSubtask(ctx, args.subtaskId, args.timeEstimate);
    }
  },
});

export const patchSubtaskEmbedding = internalMutation({
  args: {
    subtaskId: v.id("subtasks"),
    embedding: v.array(v.float64()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subtaskId, { embedding: args.embedding });
    return null;
  },
});

export const updateSubtaskStatus = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    status: v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.userId !== userId) throw new Error("Subtask not found");

    await ctx.db.patch(args.subtaskId, { status: args.status });

    // Bubble up: derive parent status from all sibling statuses after this update
    const siblings = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", subtask.parentTaskId))
      .collect();

    const allDone = siblings.every((s) =>
      s._id === args.subtaskId ? args.status === "completed" : s.status === "completed"
    );
    const anyActive = siblings.some((s) =>
      s._id === args.subtaskId
        ? args.status === "in_progress" || args.status === "completed"
        : s.status === "in_progress" || s.status === "completed"
    );

    const newParentStatus = allDone
      ? "completed"
      : anyActive
        ? "in_progress"
        : "not_started";

    const parent = await ctx.db.get(subtask.parentTaskId);
    if (parent && parent.status !== newParentStatus) {
      await ctx.db.patch(subtask.parentTaskId, { status: newParentStatus });
    }
  },
});

/**
 * Deletes a subtask and all its associated study blocks.
 */
export const deleteSubtask = mutation({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.userId !== userId) throw new Error("Subtask not found");

    const studyBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_subtaskId", (q) => q.eq("subtaskId", args.subtaskId))
      .collect();

    for (const block of studyBlocks) {
      await ctx.db.delete(block._id);
    }

    await ctx.db.delete(args.subtaskId);

    // Recalculate parent task estimate from remaining siblings.
    const remaining = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", subtask.parentTaskId))
      .collect();

    const newTotal = remaining.reduce((sum, s) => sum + (s.timeEstimate ?? 0), 0);
    await ctx.db.patch(subtask.parentTaskId, {
      timeEstimate: newTotal > 0 ? newTotal : undefined,
    });
  },
});
