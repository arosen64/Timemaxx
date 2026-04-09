import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { callGemini } from "../lib/gemini";
import { sanitizeUserInput } from "../lib/sanitize";
import { parseDeptPrefix, termSortKey } from "../lib/classTagUtils";
import {
  TIME_ESTIMATE_SYSTEM,
  buildTimeEstimatePrompt,
  timeEstimateResponseSchema,
} from "../lib/prompts/estimateTaskTime.prompt";
import { taskToTaskLike, subtaskToTaskLike, TaskLike } from "../lib/taskTypes";

/**
 * From a pre-fetched list of all user courses, returns a context string of
 * completed courses in the same department as the task's course.
 * Returns null if the task has no course, or no matching dept courses with grades.
 */
function buildDepartmentCourseContext(
  allCourses: Doc<"userCourses">[],
  taskCourse: Doc<"userCourses"> | undefined
): string | null {
  if (!taskCourse) return null;

  const deptPrefix = parseDeptPrefix(taskCourse.courseCode);
  if (!deptPrefix) return null;

  const deptCourses = allCourses
    .filter((c) => c.courseCode.startsWith(`${deptPrefix}.`) && c.grade !== undefined)
    .sort((a, b) => termSortKey(b.term) - termSortKey(a.term));
  if (deptCourses.length === 0) return null;

  const lines = deptCourses.map((c) => `- ${c.courseCode}: ${sanitizeUserInput(c.title, 500)} (grade: ${c.grade})`);
  return `Prior courses in the same department (completed with grades, most to least recent):\n${lines.join("\n")}`;
}

/**
 * Builds a student profile context string for the time estimation prompt
 * from basic onboarding fields stored on the user's profile.
 * Returns null if no relevant fields are set.
 */
function buildUserContext(user: Doc<"users"> | null): string | null {
  const lines = [
    user?.major && `Major: ${sanitizeUserInput(user.major, 200)}`,
    user?.year && `Year: ${user.year}`,
    user?.difficultSubjects?.length &&
      `Difficult subjects: ${user.difficultSubjects.map((s) => sanitizeUserInput(s, 200)).join(", ")}`,
    user?.enjoyedSubjects?.length &&
      `Enjoyed subjects: ${user.enjoyedSubjects.map((s) => sanitizeUserInput(s, 200)).join(", ")}`,
  ].filter(Boolean) as string[];
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * Builds a past estimate feedback context string for the time estimation prompt.
 * Returns null if the user has no prior feedback entries.
 */
function buildFeedbackContext(
  priorEstimateFeedback: Array<{
    title: string;
    taskType: string;
    estimatedMinutes: number;
    rating: "up" | "down";
    correctedEstimateMinutes?: number;
  }>
): string | null {
  if (priorEstimateFeedback.length === 0) return null;
  const lines = priorEstimateFeedback.map((entry) => {
    const corrected =
      entry.correctedEstimateMinutes !== undefined
        ? `, corrected to ${entry.correctedEstimateMinutes} minutes`
        : "";
    return `- ${entry.taskType}: "${sanitizeUserInput(entry.title, 500)}" -> estimated ${entry.estimatedMinutes} minutes, feedback ${entry.rating}${corrected}`;
  });
  return `Past estimate feedback from this same student (learn from this):\n${lines.join("\n")}`;
}

/**
 * Builds a transcript profile context string for the time estimation prompt
 * from the AI-generated academic insights stored on the user's profile.
 * Returns null if the user has no transcript summary.
 */
function buildTranscriptProfile(user: Doc<"users"> | null): string | null {
  const summary = user?.transcriptSummary;
  if (!summary || summary.length === 0) return null;

  const lines = summary.map((insight) => `- ${sanitizeUserInput(insight.label, 200)}: ${sanitizeUserInput(insight.text, 1_000)}`);
  return `Academic profile from transcript analysis:\n${lines.join("\n")}`;
}

/**
 * Builds a course context string for the time estimation prompt.
 * If prior same-department courses with grades are available, uses those.
 * Otherwise, falls back to the user's current term course list.
 * In either case, the study goal for the task's specific course is always included.
 */
function buildCourseContext(
  allCourses: Doc<"userCourses">[],
  taskCourse: Doc<"userCourses"> | undefined
): string | null {
  const studyGoalLine =
    taskCourse?.studyGoal
      ? `Study goal for "${sanitizeUserInput(taskCourse.title, 500)}": ${sanitizeUserInput(taskCourse.studyGoal, 1_000)}`
      : null;

  const deptContext = buildDepartmentCourseContext(allCourses, taskCourse);

  let mainContext: string | null = null;
  if (deptContext) {
    mainContext = deptContext;
  } else if (taskCourse) {
    const currentTermCourses = allCourses.filter((c) => c.term === taskCourse.term);
    if (currentTermCourses.length > 0) {
      const lines = currentTermCourses.map(
        (c) => `- ${c.courseCode}: ${sanitizeUserInput(c.title, 500)} (goal: ${c.studyGoal ? sanitizeUserInput(c.studyGoal, 1_000) : "none"})`
      );
      mainContext = `Current term courses:\n${lines.join("\n")}`;
    }
  }

  const parts = [mainContext, studyGoalLine].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Estimates how long a task or subtask will take (in minutes) using OpenAI.
 * Pass either taskId or subtaskId — not both.
 * Builds context from the user's profile, current-term enrolled courses,
 * prior same-department grades, and past estimate feedback, then stores
 * the result via the appropriate mutation.
 */
export const estimateTaskTime = internalAction({
  args: {
    taskId: v.optional(v.id("tasks")),
    subtaskId: v.optional(v.id("subtasks")),
  },
  handler: async (ctx, args) => {
    let item: TaskLike
    let store: (minutes: number) => Promise<void>

    if (args.subtaskId) {
      const subtask = await ctx.runQuery(internal.queries.subtasks.getSubtaskInternal, {
        subtaskId: args.subtaskId,
      });
      if (!subtask) return;
      const parentTask = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
        taskId: subtask.parentTaskId,
      });
      if (!parentTask) return;
      item = subtaskToTaskLike(subtask, parentTask);
      store = async (minutes) => {
        await ctx.runMutation(internal.mutations.subtasks.setSubtaskTimeEstimate, {
          subtaskId: args.subtaskId!,
          timeEstimate: minutes,
        });
      };
    } else {
      const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
        taskId: args.taskId!,
      });
      if (!task) return;
      item = taskToTaskLike(task);
      store = async (minutes) => {
        await ctx.runMutation(internal.mutations.timeEstimate.setTimeEstimate, {
          taskId: args.taskId!,
          timeEstimate: minutes,
        });
      };
    }

    const [user, priorEstimateFeedback, allCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId: item.userId }),
      ctx.runQuery(internal.queries.tasks.getEstimateFeedbackContextInternal, { userId: item.userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId: item.userId }),
    ]);

    const taskCourse = item.courseId ? allCourses.find((c) => c._id === item.courseId) : undefined;

    // Build context strings
    const userContext = buildUserContext(user);
    const feedbackContext = buildFeedbackContext(priorEstimateFeedback);
    const courseContext = buildCourseContext(allCourses, taskCourse);
    const transcriptProfile = buildTranscriptProfile(user);

    // Call Gemini with structured output
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      if (process.env.VITEST !== "true") {
        console.error("GEMINI_API_KEY is not set");
      }
      return;
    }

    try {
      const result = await callGemini({
        system: TIME_ESTIMATE_SYSTEM,
        prompt: buildTimeEstimatePrompt({
          title: sanitizeUserInput(item.title, 500),
          taskType: item.taskType,
          description: sanitizeUserInput(item.description ?? "", 5_000),
          courseInfo: taskCourse
            ? `${taskCourse.courseCode} - ${sanitizeUserInput(taskCourse.title, 500)}`
            : undefined,
          userContext: userContext ?? undefined,
          transcriptProfile: transcriptProfile ?? undefined,
          courseContext: courseContext ?? undefined,
          feedbackContext: feedbackContext ?? undefined,
        }),
        schema: timeEstimateResponseSchema,
        schemaName: "TimeEstimate",
      });

      await store(result.estimatedMinutes);
    } catch (err) {
      console.error("Failed to estimate task time:", err);
      throw err;
    }
  },
});
