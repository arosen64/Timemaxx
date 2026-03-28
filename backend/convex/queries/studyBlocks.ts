import { query } from "../_generated/server";
import { v } from "convex/values";

export const getStudyBlocksByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const getStudyBlockById = query({
  args: {
    studyBlockId: v.id("studyBlocks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.studyBlockId);
  },
});
