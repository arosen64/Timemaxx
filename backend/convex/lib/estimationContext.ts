import { Doc } from "../_generated/dataModel";
import { TaskLike } from "./taskTypes";
import { callOpenAIJSON } from "./openai";
import { parseDeptPrefix, termSortKey } from "./classTagUtils";

// ─── Context builders ─────────────────────────────────────────────────────────

/**
 * From a pre-fetched list of all user courses, returns a context string of
 * completed courses in the same department as the task's course.
 */
export function buildDepartmentCourseContext(
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
 * Builds a student profile context string from basic onboarding fields.
 */
export function buildUserContext(user: Doc<"users"> | null): string | null {
  const lines = [
    user?.major && `Major: ${user.major}`,
    user?.year && `Year: ${user.year}`,
    user?.difficultSubjects?.length && `Difficult subjects: ${user.difficultSubjects.join(", ")}`,
    user?.enjoyedSubjects?.length && `Enjoyed subjects: ${user.enjoyedSubjects.join(", ")}`,
  ].filter(Boolean) as string[];
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * Builds a past estimate feedback context string.
 */
export function buildFeedbackContext(
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
    return `- ${entry.taskType}: "${entry.title}" -> estimated ${entry.estimatedMinutes} minutes, feedback ${entry.rating}${corrected}`;
  });
  return `Past estimate feedback from this same student (learn from this):\n${lines.join("\n")}`;
}

/**
 * Builds a transcript profile context string from AI-generated academic insights.
 */
export function buildTranscriptProfile(user: Doc<"users"> | null): string | null {
  const summary = user?.transcriptSummary;
  if (!summary || summary.length === 0) return null;
  const lines = summary.map((insight) => `- ${insight.label}: ${insight.text}`);
  return `Academic profile from transcript analysis:\n${lines.join("\n")}`;
}

/**
 * Builds a course context string. Uses department history if available,
 * otherwise falls back to current-term courses. Always includes the study goal.
 */
export function buildCourseContext(
  allCourses: Doc<"userCourses">[],
  taskCourse: Doc<"userCourses"> | undefined
): string | null {
  const studyGoalLine = taskCourse?.studyGoal
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

// ─── Shared estimation function ───────────────────────────────────────────────

/**
 * EXPERIMENTAL — not wired up anywhere yet.
 * Builds an estimation prompt for a TaskLike item, calls OpenAI (GPT-4o mini),
 * and invokes the store callback with the result. This is being explored as an
 * alternative to the Gemini-based estimateTaskTime action; do not call it from
 * production paths until the migration is decided.
 */
export async function estimateAndStore(
  item: TaskLike,
  user: Doc<"users"> | null,
  priorEstimateFeedback: Array<{
    title: string;
    taskType: string;
    estimatedMinutes: number;
    rating: "up" | "down";
    correctedEstimateMinutes?: number;
  }>,
  allCourses: Doc<"userCourses">[],
  store: (minutes: number) => Promise<void>
): Promise<void> {
  const taskCourse = item.courseId
    ? allCourses.find((c) => c._id === item.courseId)
    : undefined;

  const userContext = buildUserContext(user);
  const feedbackContext = buildFeedbackContext(priorEstimateFeedback);
  const courseContext = buildCourseContext(allCourses, taskCourse);
  const transcriptProfile = buildTranscriptProfile(user);

  const prompt = `You are a study time estimator. Given the task details and student profile below, estimate how many minutes it will take the student to complete the task.

Task title: ${item.title}
Task type: ${item.taskType}
Task description: ${item.description}
${taskCourse ? `Task course: ${taskCourse.courseCode} - ${taskCourse.title}` : ""}

${userContext ? `Student profile:\n${userContext}` : ""}

${transcriptProfile ? `\n${transcriptProfile}` : ""}

${courseContext ? `\n${courseContext}` : ""}

${feedbackContext ? `\n${feedbackContext}` : ""}

Respond with JSON in this exact format: {"estimatedMinutes": <integer>}`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.VITEST !== "true") {
      console.error("OPENAI_API_KEY is not set");
    }
    return;
  }

  const json = await callOpenAIJSON<{ estimatedMinutes: number }>(prompt);
  if (typeof json.estimatedMinutes === "number") {
    await store(json.estimatedMinutes);
  }
}
