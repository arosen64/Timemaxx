import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { taskTypeValidator } from "../lib/taskValidators";

/**
 * Internal mutation called by the uploadSyllabus action to create a syllabi
 * row with status "pending" before the Gemini extraction begins.
 */
export const createSyllabus = internalMutation({
  args: {
    userId: v.id("users"),
    fileName: v.string(),
    className: v.string(),
    courseId: v.optional(v.id("userCourses")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("syllabi", {
      userId: args.userId,
      fileName: args.fileName,
      courseName: args.className,
      courseId: args.courseId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal mutation called by the uploadSyllabus action to update the
 * processing status of a syllabus row ("confirmed" on success, "failed" on error).
 */
export const setSyllabusStatus = internalMutation({
  args: {
    syllabusId: v.id("syllabi"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.syllabusId, { status: args.status });
  },
});

/**
 * Saves user-confirmed tasks extracted from a syllabus to the tasks table.
 *
 * Called after the user reviews the output of uploadSyllabus and approves
 * the extracted task list. Each task is linked back to the source syllabus
 * via extractedFrom so the origin can always be traced.
 *
 * Returns the IDs of all inserted tasks.
 */
export const confirmSyllabusTasks = mutation({
  args: {
    syllabusId: v.id("syllabi"),
    tasks: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        dueDate: v.number(),
        taskType: taskTypeValidator,
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const syllabus = await ctx.db.get(args.syllabusId);
    if (!syllabus || syllabus.userId !== userId) {
      throw new Error("Syllabus not found");
    }

    const now = Date.now();
    const taskIds = await Promise.all(
      args.tasks.map((task) =>
        ctx.db.insert("tasks", {
          userId,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          taskType: task.taskType,
          extractedFrom: args.syllabusId,
          createdAt: now,
        })
      )
    );

    return taskIds;
  },
});
