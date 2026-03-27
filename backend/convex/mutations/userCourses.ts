import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function termToSuffix(term: string): string {
  const parts = term.trim().split(" ");
  if (parts.length < 2) return "";
  const season = parts[0].toLowerCase();
  const yy = parts[parts.length - 1].slice(-2);
  const code =
    season === "spring" ? "SP" :
    season === "summer" ? "SU" :
    season === "fall" ? "FA" :
    season === "intersession" ? "IN" : "";
  return code ? `.${code}${yy}` : "";
}

/**
 * Adds a course to the authenticated user's course list.
 * - Upserts the course into the courses table (keyed by courseCode).
 * - Rejects if the user already has this courseCode with a grade recorded
 *   (i.e. a previously completed course cannot be re-added).
 */
export const addUserCourse = mutation({
  args: {
    courseCode: v.string(),
    title: v.string(),
    credits: v.optional(v.number()),
    term: v.string(),
    grade: v.optional(v.string()),
    studyGoal: v.optional(v.string()),
    difficultyRating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check for existing completed record (has a grade) with same courseCode
    const existing = await ctx.db
      .query("userCourses")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseCode", args.courseCode)
      )
      .collect();

    const completedRecord = existing.find((r) => r.grade !== undefined && r.grade !== "");
    if (completedRecord) {
      throw new Error("COURSE_ALREADY_COMPLETED");
    }

    // Insert the userCourse record
    return await ctx.db.insert("userCourses", {
      userId,
      courseCode: args.courseCode + termToSuffix(args.term),
      title: args.title,
      credits: args.credits,
      term: args.term,
      grade: args.grade,
      studyGoal: args.studyGoal,
      difficultyRating: args.difficultyRating,
    });
  },
});

/**
 * Updates the grade or studyGoal on an existing userCourse record.
 */
export const updateUserCourse = mutation({
  args: {
    userCourseId: v.id("userCourses"),
    grade: v.optional(v.string()),
    studyGoal: v.optional(v.string()),
    difficultyRating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const record = await ctx.db.get(args.userCourseId);
    if (!record) throw new Error("Course record not found");
    if (record.userId !== userId) throw new Error("Not authorized");

    await ctx.db.patch(args.userCourseId, {
      grade: args.grade,
      studyGoal: args.studyGoal,
      difficultyRating: args.difficultyRating,
    });
  },
});

/**
 * Deletes a userCourse record. Only the owning user may delete their own record.
 */
export const deleteUserCourse = mutation({
  args: { userCourseId: v.id("userCourses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const record = await ctx.db.get(args.userCourseId);
    if (!record) throw new Error("Course record not found");
    if (record.userId !== userId) throw new Error("Not authorized");

    await ctx.db.delete(args.userCourseId);
  },
});
