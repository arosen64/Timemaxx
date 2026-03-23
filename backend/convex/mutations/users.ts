import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";


/**
 * Partially updates the authenticated user's settings (work hours, focus block length, study profile).
 */
export const updateUserSettings = mutation({
  args: {
    major: v.optional(v.string()),
    year: v.optional(v.string()),
    difficultSubjects: v.optional(v.array(v.string())),
    enjoyedSubjects: v.optional(v.array(v.string())),
    courses: v.optional(v.array(v.object({ title: v.string(), studyGoal: v.string() }))),
    workHoursGrid: v.optional(v.array(v.object({
      day: v.string(),
      available: v.array(v.number()),
      blocked: v.array(v.number()),
    }))),
    productivityTraits: v.optional(v.any()),
    focusBlockLength: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated: must be logged in to update settings");

    await ctx.db.patch(userId, args);
  },
});

/**
 * Updates the authenticated user's onboarding information and marks onboarding as complete.
 */
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