import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";

export const getStudyBlocksByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const getStudyBlocksBySubtask = query({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.userId !== userId) return [];
    return await ctx.db
      .query("studyBlocks")
      .withIndex("by_subtaskId", (q) => q.eq("subtaskId", args.subtaskId))
      .collect();
  },
});

export const getStudyBlocksForTaskSubtasks = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) return [];
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();

    const blockArrays = await Promise.all(
      subtasks.map((subtask) =>
        ctx.db
          .query("studyBlocks")
          .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtask._id))
          .collect()
          .then((blocks) => blocks.map((block) => ({ ...block, subtaskId: subtask._id }))),
      ),
    );

    return blockArrays.flat();
  },
});

export const getStudyBlockById = query({
  args: {
    studyBlockId: v.id("studyBlocks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.studyBlockId);
  },
});

async function fetchAllStudyBlocksWithTasks(ctx: any, userId: Id<"users">) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  const result: Array<{
    _id: Id<"studyBlocks">;
    taskId: Id<"tasks">;
    subtaskId: Id<"subtasks"> | undefined;
    title: string;
    startTime: string | undefined;
    studyBlockLength: number;
    isConflicted: boolean | undefined;
    googleEventId: string | undefined;
    needsExport: boolean | undefined;
    taskTitle: string;
    taskDueDate: number;
    taskRecommendedStart: number | undefined;
    courseColor: string | undefined;
    courseName: string | undefined;
    isCompleted: boolean;
  }> = [];

  // Collect unique courseIds and batch-fetch them into a Map (avoids N+1)
  const uniqueCourseIds = [...new Set(tasks.map((t: any) => t.courseId).filter(Boolean))];
  const courseMap = new Map<string, any>();
  for (const courseId of uniqueCourseIds) {
    const course = await ctx.db.get(courseId as Id<"userCourses">);
    if (course) courseMap.set(courseId as string, course);
  }

  // Batch-fetch all subtasks for user and group by parentTaskId (avoids N+1 per task)
  const allSubtasks = await ctx.db
    .query("subtasks")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();
  const subtasksByTask = new Map<string, any[]>();
  for (const subtask of allSubtasks) {
    const key = subtask.parentTaskId as string;
    if (!subtasksByTask.has(key)) subtasksByTask.set(key, []);
    subtasksByTask.get(key)!.push(subtask);
  }

  for (const task of tasks) {
    // Skip completed tasks — their blocks are unscheduled and should not appear on the calendar
    if (task.status === "completed") continue;

    const course = task.courseId ? courseMap.get(task.courseId) : null;
    const courseColor: string | undefined = course?.color ?? undefined;
    const courseName: string | undefined = course?.title ?? undefined;

    const blocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q: any) => q.eq("taskId", task._id))
      .collect();
    for (const block of blocks) {
      if (block.isCompleted) continue
      result.push({
        _id: block._id,
        taskId: block.taskId,
        subtaskId: undefined,
        title: block.title,
        startTime: block.startTime,
        studyBlockLength: block.studyBlockLength,
        isConflicted: block.isConflicted,
        googleEventId: block.googleEventId,
        needsExport: block.needsExport,
        taskTitle: task.title,
        taskDueDate: task.dueDate,
        taskRecommendedStart: task.recommendedStart,
        courseColor,
        courseName,
        isCompleted: block.isCompleted,
      });
    }

    // Also include subtask-level blocks, grouped under the parent task
    const subtasks = subtasksByTask.get(task._id as string) ?? [];
    for (const subtask of subtasks) {
      const subtaskBlocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_subtaskId", (q: any) => q.eq("subtaskId", subtask._id))
        .collect();
      for (const block of subtaskBlocks) {
        if (block.isCompleted) continue
        result.push({
          _id: block._id,
          taskId: task._id,
          subtaskId: subtask._id,
          title: block.title,
          startTime: block.startTime,
          studyBlockLength: block.studyBlockLength,
          isConflicted: block.isConflicted,
          googleEventId: block.googleEventId,
          needsExport: block.needsExport,
          taskTitle: task.title,
          taskDueDate: task.dueDate,
          taskRecommendedStart: task.recommendedStart,
          courseColor,
          courseName,
          isCompleted: block.isCompleted,
        });
      }
    }
  }

  return result;
}

export const getUpcomingStudyBlocks = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;

    const allBlocks = await fetchAllStudyBlocksWithTasks(ctx, userId);

    return allBlocks
      .filter((b) => {
        if (!b.startTime) return false;
        const startMs = new Date(b.startTime).getTime();
        return startMs >= now && startMs <= in24h;
      })
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
  },
});

export const getAllStudyBlocksWithTasks = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await fetchAllStudyBlocksWithTasks(ctx, userId);
  },
});

export const getThisWeekStudyBlocks = query({
  args: { weekStartMs: v.number(), weekEndMs: v.number() },
  handler: async (ctx, { weekStartMs, weekEndMs }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { total: 0, completed: 0 };

    const weekStartIso = new Date(weekStartMs).toISOString();
    const weekEndIso = new Date(weekEndMs).toISOString();

    const blocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_userId_startTime", (q) =>
        q.eq("userId", userId).gte("startTime", weekStartIso).lt("startTime", weekEndIso)
      )
      .collect();

    return {
      total: blocks.length,
      completed: blocks.filter((b) => b.isCompleted).length,
    };
  },
});

export const getTodayStudyBlockMinutes = query({
  args: { todayStartMs: v.number(), todayEndMs: v.number() },
  handler: async (ctx, { todayStartMs, todayEndMs }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const todayStartIso = new Date(todayStartMs).toISOString();
    const todayEndIso = new Date(todayEndMs).toISOString();

    const blocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_userId_startTime", (q) =>
        q.eq("userId", userId).gte("startTime", todayStartIso).lt("startTime", todayEndIso)
      )
      .collect();

    return blocks.reduce((sum, b) => sum + b.studyBlockLength, 0);
  },
});

export const getStudyBlockInternal = internalQuery({
  args: { studyBlockId: v.id("studyBlocks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.studyBlockId);
  },
});

export const getAllStudyBlocksWithTasksInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await fetchAllStudyBlocksWithTasks(ctx, args.userId);
  },
});

export const getAllStudyBlocksByUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studyBlocks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getStudyBlocksByTaskInternal = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const taskBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .collect();

    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", taskId))
      .collect();

    const subtaskBlockArrays = await Promise.all(
      subtasks.map((s) =>
        ctx.db
          .query("studyBlocks")
          .withIndex("by_subtaskId", (q) => q.eq("subtaskId", s._id))
          .collect(),
      ),
    );

    return [...taskBlocks, ...subtaskBlockArrays.flat()];
  },
});

export const getFutureStudyBlocksForExport = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const result: Array<{
      _id: Id<"studyBlocks">;
      title: string;
      startTime: string;
      studyBlockLength: number;
      googleEventId: string | undefined;
      courseColor: string | undefined;
      courseName: string | undefined;
    }> = [];

    const uniqueCourseIds = [...new Set(tasks.map((t) => t.courseId).filter(Boolean))];
    const courseMap = new Map<string, { color?: string; title?: string }>();
    for (const courseId of uniqueCourseIds) {
      const course = await ctx.db.get(courseId as Id<"userCourses">);
      if (course) courseMap.set(courseId as string, course);
    }

    for (const task of tasks) {
      if (task.status === "completed") continue;
      const course = task.courseId ? courseMap.get(task.courseId) : undefined;
      const courseColor = course?.color;
      const courseName = course?.title;
      const blocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();

      for (const block of blocks) {
        if (block.isCompleted) continue;
        if (!block.startTime) continue;
        if (new Date(block.startTime).getTime() <= now) continue;
        result.push({
          _id: block._id,
          title: block.title,
          startTime: block.startTime,
          studyBlockLength: block.studyBlockLength,
          googleEventId: block.googleEventId,
          courseColor,
          courseName,
        });
      }
    }

    return result;
  },
});

/**
 * "At Risk" check: fires when the total duration of uncompleted study blocks for
 * this task (including subtask blocks) exceeds the raw clock time remaining until
 * the due date.
 *
 * NOTE: We intentionally ignore work-hours grid availability here (i.e. we do not
 * filter to only count slots the user has marked as available). Factoring in the
 * grid would require per-slot iteration and timezone handling; the simpler wall-clock
 * comparison is a good-enough signal for an at-risk warning.
 */
export const getTaskAtRiskStatus = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) return null;

    const nowMs = Date.now();
    const minutesUntilDue = (task.dueDate - nowMs) / (60 * 1000);

    // Sum uncompleted blocks on the task itself
    const taskBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    let uncompletedMinutes = taskBlocks
      .filter((b) => !b.isCompleted)
      .reduce((sum, b) => sum + b.studyBlockLength, 0);

    // Also include uncompleted blocks belonging to subtasks of this task
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();

    for (const subtask of subtasks) {
      const subtaskBlocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtask._id))
        .collect();
      uncompletedMinutes += subtaskBlocks
        .filter((b) => !b.isCompleted)
        .reduce((sum, b) => sum + b.studyBlockLength, 0);
    }

    if (uncompletedMinutes === 0) return { isWarning: false };

    return {
      isWarning: uncompletedMinutes > minutesUntilDue,
    };
  },
});
