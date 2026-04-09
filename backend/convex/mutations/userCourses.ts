import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { buildClassTag, legacyNaiveClassTag } from "../lib/classTagUtils";
import { randomCourseColor } from "../lib/courseColors";
import { cascadeDeleteTask } from "./tasks";

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
 * - Rejects if the user already has a record with this courseCode.
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

    const courseCode = args.courseCode + termToSuffix(args.term);

    // Reject if the user already has this courseCode
    const existing = await ctx.db
      .query("userCourses")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseCode", courseCode)
      )
      .first();

    if (existing) {
      throw new Error("COURSE_ALREADY_EXISTS");
    }

    // Insert the userCourse record
    return await ctx.db.insert("userCourses", {
      userId,
      courseCode,
      title: args.title,
      credits: args.credits,
      term: args.term,
      grade: args.grade,
      studyGoal: args.studyGoal,
      difficultyRating: args.difficultyRating ?? 3,
      color: randomCourseColor(),
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
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const record = await ctx.db.get(args.userCourseId);
    if (!record) throw new Error("Course record not found");
    if (record.userId !== userId) throw new Error("Not authorized");

    const patch: Record<string, unknown> = {};
    if (args.grade !== undefined) patch.grade = args.grade;
    if (args.studyGoal !== undefined) patch.studyGoal = args.studyGoal;
    if (args.difficultyRating !== undefined) patch.difficultyRating = args.difficultyRating;
    if (args.color !== undefined) patch.color = args.color;
    await ctx.db.patch(args.userCourseId, patch);
  },
});

/**
 * Deletes a userCourse record. Only the owning user may delete their own record.
 * Also removes tasks linked to this course (and their study blocks): by `courseId`
 * (e.g. syllabus imports) or by `classTag` matching the canonical deduped tag or the
 * older naive `${courseCode}: ${title}` string, and clears syllabus rows for this course.
 */
export const deleteUserCourse = mutation({
  args: { userCourseId: v.id("userCourses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const record = await ctx.db.get(args.userCourseId);
    if (!record) throw new Error("Course record not found");
    if (record.userId !== userId) throw new Error("Not authorized");

    // Dashboard tasks store `classTag` built with buildClassTag (deduped). Older rows used
    // `${courseCode}: ${title}` and duplicated the catalog when title already had OfferingName.
    const canonicalClassTag = buildClassTag(record.courseCode, record.title);
    const legacyNaiveTag = legacyNaiveClassTag(record.courseCode, record.title);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const task of tasks) {
      const matchesByCourseId = task.courseId === args.userCourseId;
      const tag = task.classTag?.trim();
      const matchesByClassTag =
        tag === canonicalClassTag || tag === legacyNaiveTag;
      if (!matchesByCourseId && !matchesByClassTag) continue;

      await cascadeDeleteTask(ctx, task._id);
    }

    const syllabi = await ctx.db
      .query("syllabi")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const syllabus of syllabi) {
      if (syllabus.courseId === args.userCourseId) {
        await ctx.db.patch(syllabus._id, { courseId: undefined });
      }
    }

    await ctx.db.delete(args.userCourseId);
  },
});
