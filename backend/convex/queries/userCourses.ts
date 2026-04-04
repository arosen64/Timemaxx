import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "../_generated/dataModel";
import { parseDeptPrefix } from "../lib/classTagUtils";

/**
 * Returns all courses for the authenticated user.
 */
export const getUserCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("userCourses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Returns syllabus and task metadata for each of the authenticated user's courses.
 */
export const getCourseMetadata = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const courses = await ctx.db
      .query("userCourses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const syllabi = await ctx.db
      .query("syllabi")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const confirmedSyllabusIds = new Set(
      syllabi
        .filter((s) => s.status === "confirmed" && s.courseId !== undefined)
        .map((s) => s.courseId as Id<"userCourses">)
    );

    const taskCountByCourse = new Map<string, number>();
    for (const task of tasks) {
      if (task.courseId) {
        taskCountByCourse.set(
          task.courseId,
          (taskCountByCourse.get(task.courseId) ?? 0) + 1
        );
      }
    }

    return courses.map((course) => ({
      courseId: course._id,
      hasSyllabus: confirmedSyllabusIds.has(course._id),
      taskCount: taskCountByCourse.get(course._id) ?? 0,
    }));
  },
});

/**
 * Returns all courses for the authenticated user filtered by term.
 */
export const getUserCoursesByTerm = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("userCourses")
      .withIndex("by_user_term", (q) => q.eq("userId", userId).eq("term", args.term))
      .collect();
  },
});

/**
 * Returns all of the authenticated user's courses that share the same
 * school+department prefix as the given course code.
 * E.g. courseCode "EN.601.433" → all user courses with "EN.601.*" course codes.
 */
export const getUserCoursesByDepartment = query({
  args: { courseCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const deptPrefix = parseDeptPrefix(args.courseCode);
    if (!deptPrefix) return [];

    const courses = await ctx.db
      .query("userCourses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return courses.filter(
      (c) => c.courseCode.startsWith(`${deptPrefix}.`) && c.grade !== undefined
    );
  },
});
