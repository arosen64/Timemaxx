import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { type GenerateSubtasksResult } from "../actions/generateSubtasks";

export const requestGenerateSubtasks = action({
  args: {
    taskId: v.id("tasks"),
    fileContent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateSubtasksResult> => {
    const task = await ctx.runQuery(api.queries.tasks.getTask, {
      taskId: args.taskId,
    });
    if (!task) throw new Error("Task not found or access denied");

    return await ctx.runAction(internal.actions.generateSubtasks.generateSubtasks, {
      taskId: args.taskId,
      fileContent: args.fileContent,
    });
  },
});
