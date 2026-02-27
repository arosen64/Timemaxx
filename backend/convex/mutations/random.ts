import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const insertRandom = mutation({
  args: { value: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("randoms", {
      value: args.value,
      createdAt: Date.now(),
    });
  },
});
