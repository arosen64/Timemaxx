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

    if (args.focusBlockLength !== undefined && args.focusBlockLength <= 0)
      throw new Error("focusBlockLength must be a positive number");

    // onboardingComplete is intentionally excluded from updatable fields here —
    // it is only set (to true) via completeOnboarding and should not be toggled
    // from the settings page.

    // TODO: tighten validation for schema-level fields:
    //   - year should be restricted to known values (Freshman, Sophomore, Junior, Senior, Graduate)
    //   - major should reject purely numeric strings
    //   - productivityTraits uses v.any() and has no shape enforcement
    // Track this as a follow-up issue for backend input validation.

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

    workHoursGrid: v.array(v.object({
      day: v.string(),
      available: v.array(v.number()),
      blocked: v.array(v.number()),
    })),
    productivityTraits: v.any(),
    focusBlockLength: v.number(),
    transcriptSummary: v.optional(
      v.array(v.object({ label: v.string(), text: v.string() }))
    ),
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

/**
 * Deletes the authenticated user's account along with all their tasks and syllabi.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated: must be logged in to delete account");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(tasks.map((task) => ctx.db.delete(task._id)));

    const syllabi = await ctx.db
      .query("syllabi")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(syllabi.map((syllabus) => ctx.db.delete(syllabus._id)));

    const userCourses = await ctx.db
      .query("userCourses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(userCourses.map((uc) => ctx.db.delete(uc._id)));

    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(authAccounts.map((account) => ctx.db.delete(account._id)));

    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(authSessions.map((session) => ctx.db.delete(session._id)));

    await ctx.db.delete(userId);
  },
});