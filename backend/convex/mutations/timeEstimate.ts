import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const setTimeEstimate = internalMutation({
  args: {
    taskId: v.id("tasks"),
    timeEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { timeEstimate: args.timeEstimate });
  },
});
