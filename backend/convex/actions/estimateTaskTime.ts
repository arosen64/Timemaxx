"use node"; // Required: @google/genai uses Node.js APIs not available in the default Convex runtime

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { Type } from "@google/genai";
import { callGeminiJSON } from "../lib/gemini";
import { parseDeptPrefix, termSortKey } from "../lib/classTagUtils";

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

  const lines = deptCourses.map((c) => `- ${c.courseCode}: ${c.title} (grade: ${c.grade})`);
  return `Prior courses in the same department (completed with grades, most to least recent):\n${lines.join("\n")}`;
}

/**
 * Builds a transcript profile context string for the time estimation prompt
 * from the AI-generated academic insights stored on the user's profile.
 * Returns null if the user has no transcript summary.
 */
function buildTranscriptProfile(
  user: Doc<"users"> | null
): string | null {
  const summary = user?.transcriptSummary;
  if (!summary || summary.length === 0) return null;

  const lines = summary.map((insight) => `- ${insight.label}: ${insight.text}`);
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
      ? `Study goal for "${taskCourse.title}": ${taskCourse.studyGoal}`
      : null;

  const deptContext = buildDepartmentCourseContext(allCourses, taskCourse);

  let mainContext: string | null = null;
  if (deptContext) {
    mainContext = deptContext;
  } else if (taskCourse) {
    const currentTermCourses = allCourses.filter((c) => c.term === taskCourse.term);
    if (currentTermCourses.length > 0) {
      const lines = currentTermCourses.map(
        (c) => `- ${c.courseCode}: ${c.title} (goal: ${c.studyGoal ?? "none"})`
      );
      mainContext = `Current term courses:\n${lines.join("\n")}`;
    }
  }

  const parts = [mainContext, studyGoalLine].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Estimates how long a task will take (in minutes) using Gemini.
 * Builds context from the user's profile, current-term enrolled courses,
 * prior same-department grades, and past estimate feedback, then stores
 * the result via setTimeEstimate.
 */
export const estimateTaskTime = internalAction({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    // Fetch task and user profile
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) return;

    const [user, priorEstimateFeedback, allCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId: task.userId }),
      ctx.runQuery(internal.queries.tasks.getEstimateFeedbackContextInternal, { userId: task.userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId: task.userId }),
    ]);

    const taskCourse = task.courseId ? allCourses.find((c) => c._id === task.courseId) : undefined;

    // Build prompt
    const userContext = [
      user?.major && `Major: ${user.major}`,
      user?.year && `Year: ${user.year}`,
      user?.difficultSubjects?.length && `Difficult subjects: ${user.difficultSubjects.join(", ")}`,
      user?.enjoyedSubjects?.length && `Enjoyed subjects: ${user.enjoyedSubjects.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const feedbackContext =
      priorEstimateFeedback.length > 0
        ? [
            "Past estimate feedback from this same student (learn from this):",
            ...priorEstimateFeedback.map((entry) => {
              const corrected =
                entry.correctedEstimateMinutes !== undefined
                  ? `, corrected to ${entry.correctedEstimateMinutes} minutes`
                  : "";
              return `- ${entry.taskType}: "${entry.title}" -> estimated ${entry.estimatedMinutes} minutes, feedback ${entry.rating}${corrected}`;
            }),
          ].join("\n")
        : "";

    const courseContext = buildCourseContext(allCourses, taskCourse);
    const transcriptProfile = buildTranscriptProfile(user);

    const prompt = `You are a study time estimator. Given the task details and student profile below, estimate how many minutes it will take the student to complete the task.

Task title: ${task.title}
Task type: ${task.taskType}
Task description: ${task.description}
${taskCourse ? `Task course: ${taskCourse.courseCode} - ${taskCourse.title}` : ""}

${userContext ? `Student profile:\n${userContext}` : ""}

${transcriptProfile ? `\n${transcriptProfile}` : ""}

${courseContext ? `\n${courseContext}` : ""}

${feedbackContext ? `\n${feedbackContext}` : ""}

Respond with the estimated number of minutes as a single integer.`;

    // Call Gemini with structured output
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      if (process.env.VITEST !== "true") {
        console.error("GEMINI_API_KEY is not set");
      }
      return;
    }

    try {
      const json = await callGeminiJSON<{ estimatedMinutes: number }>(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedMinutes: { type: Type.INTEGER },
          },
          required: ["estimatedMinutes"],
        },
      });
      const estimatedMinutes = json.estimatedMinutes;

      if (typeof estimatedMinutes === "number") {
        await ctx.runMutation(internal.mutations.timeEstimate.setTimeEstimate, {
          taskId: args.taskId,
          timeEstimate: estimatedMinutes,
        });
      }
    } catch (err) {
      console.error("Failed to estimate task time:", err);
      throw err;
    }
  },
});
