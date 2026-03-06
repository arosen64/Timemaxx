import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Creates a new task for the authenticated user with timeEstimate left unset.
 * Time estimation is handled separately (e.g. via a Gemini action) after creation.
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    taskType: v.string(),
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
      timeEstimate: undefined, // populated later by the AI estimation action
      createdAt: Date.now(),
    });

    return taskId;
  },
});
