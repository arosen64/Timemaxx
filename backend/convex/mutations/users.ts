import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import { cascadeDeleteTask } from "./tasks";

/**
 * Partially updates the authenticated user's settings (work hours, focus block length, study profile).
 */
export const updateUserSettings = mutation({
  args: {
    major: v.optional(v.string()),
    year: v.optional(v.string()),
    courses: v.optional(v.array(v.object({ title: v.string(), studyGoal: v.string() }))),
    transcriptSummary: v.optional(v.array(v.object({ label: v.string(), text: v.string() }))),
    workHoursGrid: v.optional(v.array(v.object({
      day: v.string(),
      blocked: v.array(v.number()),
    }))),
    productivityTraits: v.optional(v.any()),
    focusBlockLength: v.optional(v.number()),
    gcalColorMappingEnabled: v.optional(v.boolean()),
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

    const prevUser = args.gcalColorMappingEnabled !== undefined
      ? await ctx.db.get(userId)
      : null;

    await ctx.db.patch(userId, args);

    // When gcalColorMappingEnabled is toggled, re-export all previously exported blocks
    // so their GCal colors reflect the new setting immediately.
    // Skip if the user has no connected calendar — there is nothing to re-export.
    if (
      prevUser !== null &&
      args.gcalColorMappingEnabled !== undefined &&
      args.gcalColorMappingEnabled !== prevUser.gcalColorMappingEnabled
    ) {
      const connection = await ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();

      if (connection) {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.exportStudyBlocksToCalendar.internalExportStudyBlocksToCalendar,
          { userId },
        );
      }
    }
  },
});

/**
 * Updates the authenticated user's onboarding information and marks onboarding as complete.
 */
export const completeOnboarding = mutation({
  args: {
    major: v.string(),
    year: v.string(),
    workHoursGrid: v.array(v.object({
      day: v.string(),
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

/**
 * Deletes the authenticated user's account along with all their data:
 * tasks (+ subtasks + study blocks via cascade), syllabi, userCourses,
 * chatMessages, chatSessions, chatChunks, calendarConnections,
 * calendarOAuthStates, orphaned studyBlocks, authAccounts, authSessions,
 * and the user record itself.
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
    for (const task of tasks) {
      await cascadeDeleteTask(ctx, task._id);
    }

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

    const chatMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(chatMessages.map((m) => ctx.db.delete(m._id)));

    const chatSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(chatSessions.map((s) => ctx.db.delete(s._id)));

    const chatChunks = await ctx.db
      .query("chatChunks")
      .withIndex("by_userId_sessionId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(chatChunks.map((c) => ctx.db.delete(c._id)));

    const calendarConnections = await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(calendarConnections.map((c) => ctx.db.delete(c._id)));

    // calendarOAuthStates has no by_userId index; full scan is safe (small, short-lived table)
    const oauthStates = await ctx.db
      .query("calendarOAuthStates")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    await Promise.all(oauthStates.map((s) => ctx.db.delete(s._id)));

    // Clean up any studyBlocks with userId but no linked task/subtask (missed by task cascade)
    const orphanedBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(orphanedBlocks.map((b) => ctx.db.delete(b._id)));

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