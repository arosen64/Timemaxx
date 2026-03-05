import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createUser = mutation({
  args: {
    googleId: v.string(),
    email: v.string(),
    preferredWorkHours: v.array(
      v.object({
        startHour: v.number(),
        endHour: v.number(),
      })
    ),
    focusBlockLength: v.number(),
    onboardingComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", args);
  },
});

export const updateOnboarding = mutation({
  args: {
    userId: v.id("users"),
    onboardingComplete: v.boolean(),
  },
  handler: async (ctx, { userId, onboardingComplete }) => {
    await ctx.db.patch(userId, { onboardingComplete });
  },
});