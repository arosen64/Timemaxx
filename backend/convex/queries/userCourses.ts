import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "../_generated/dataModel";
import { DatabaseReader } from "../_generated/server";

async function fetchCoursesByUserId(db: DatabaseReader, userId: Id<"users">) {
  return await db
    .query("userCourses")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

/**
 * Returns all courses for the authenticated user.
 */
export const getUserCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await fetchCoursesByUserId(ctx.db, userId);
  },
});

/**
 * Returns all courses for a given user. For use by internal actions.
 */
export const getUserCoursesInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await fetchCoursesByUserId(ctx.db, args.userId);
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

    const results = await Promise.all(
      courses.map(async (course) => {
        const [syllabus, tasks] = await Promise.all([
          ctx.db
            .query("syllabi")
            .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
            .filter((q) => q.eq(q.field("status"), "confirmed"))
            .first(),
          ctx.db
            .query("tasks")
            .withIndex("by_userId_courseId", (q) =>
              q.eq("userId", userId).eq("courseId", course._id)
            )
            .collect(),
        ]);

        return {
          courseId: course._id,
          hasSyllabus: syllabus !== null,
          taskCount: tasks.length,
        };
      })
    );

    return results;
  },
});

/**
 * Internal query for batch-fetching courses by IDs (used by context builders).
 */
export const getUserCoursesByIdsInternal = internalQuery({
  args: { courseIds: v.array(v.id("userCourses")) },
  handler: async (ctx, args) => {
    const results = await Promise.all(args.courseIds.map((id) => ctx.db.get(id)));
    return results.filter((c): c is NonNullable<typeof c> => c !== null);
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
