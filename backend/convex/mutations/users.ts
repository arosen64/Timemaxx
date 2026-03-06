import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const completeOnboarding = mutation({
  args: {
    major: v.string(),
    year: v.string(),
    difficultSubjects: v.array(v.string()),
    enjoyedSubjects: v.array(v.string()),
    courses: v.array(v.object({ title: v.string(), studyGoal: v.string() })),
    workHoursGrid: v.array(v.object({
      day: v.string(),
      available: v.array(v.number()),
      blocked: v.array(v.number()),
    })),
    productivityTraits: v.any(),
    focusBlockLength: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated: must be logged in to complete onboarding");

    // Major filled check
    if (args.major.trim().length === 0)
      throw new Error("Major cannot be empty");

    await ctx.db.patch(userId, {
      ...args,
      onboardingComplete: true,
    });
  },
});