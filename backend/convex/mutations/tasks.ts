import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

/**
 * Creates a new task for the authenticated user with timeEstimate left unset.
 * Time estimation is handled separately (e.g. via a Gemini action) after creation.
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    taskType: v.union(
      v.literal("Problem Set"),
      v.literal("Essay"),
      v.literal("Coding"),
      v.literal("Exam Prep"),
    ),
    dueDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }

    const taskId = await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      dueDate: args.dueDate,
      timeEstimate: undefined, // populated asynchronously by estimateTaskTime action
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.actions.estimateTaskTime.estimateTaskTime, { taskId });

    return taskId;
  },
});
