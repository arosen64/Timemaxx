import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { GenericActionCtx } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { callGemini } from "../lib/gemini";
import { sanitizeUserInput } from "../lib/sanitize";
import {
  TIME_ESTIMATE_SYSTEM,
  buildTimeEstimatePrompt,
  timeEstimateResponseSchema,
} from "../lib/prompts/estimateTaskTime.prompt";
import {
  RelevantChat,
  fetchRelevantChats,
  fetchRelevantClasses,
  fetchRelevantTasks,
} from "../lib/retrieval";

type Ctx = GenericActionCtx<DataModel>;

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

/**
 * Fetches relevant courses via the retrieval layer, then batch-loads them and
 * formats a clean context block for the LLM.
 */
async function buildCourseContext(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<string | null> {
  const courseIds = await fetchRelevantClasses(ctx, taskId, userId);
  if (courseIds.length === 0) return null;

  const courses = await ctx.runQuery(
    internal.queries.userCourses.getUserCoursesByIdsInternal,
    { courseIds }
  );
  if (courses.length === 0) return null;

  const lines = (courses as Doc<"userCourses">[]).map((c) => {
    const parts: string[] = [
      `Code: ${c.courseCode}`,
      `Title: ${sanitizeUserInput(c.title, 500)}`,
      `Term: ${c.term}`,
    ];
    if (c.grade !== undefined) parts.push(`Grade: ${c.grade}`);
    if (c.credits !== undefined) parts.push(`Credits: ${c.credits}`);
    if (c.difficultyRating !== undefined) parts.push(`Difficulty: ${c.difficultyRating}/5`);
    if (c.studyGoal) parts.push(`Study Goal: ${sanitizeUserInput(c.studyGoal, 1_000)}`);
    return `- ${parts.join(" | ")}`;
  });

  return `Enrolled courses (most relevant to this task):\n${lines.join("\n")}`;
}

/**
 * Fetches relevant prior tasks via the retrieval layer, then batch-loads them
 * and formats a context block that includes estimate history and feedback.
 */
async function buildTaskContext(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<string | null> {
  const taskIds = await fetchRelevantTasks(ctx, taskId, userId);
  if (taskIds.length === 0) return null;

  const tasks = await ctx.runQuery(
    internal.queries.tasks.getTasksByIdsInternal,
    { taskIds }
  );
  if (tasks.length === 0) return null;

  const lines = (tasks as Doc<"tasks">[]).map((t) => {
    const parts: string[] = [
      `Type: ${t.taskType}`,
      `Title: "${sanitizeUserInput(t.title, 500)}"`,
      `Description: "${sanitizeUserInput(t.description, 1000)}"`,
    ];
    if (t.timeEstimate !== undefined) {
      parts.push(`Estimated: ${t.timeEstimate} min`);
    }
    if (t.estimateFeedbackRating !== undefined) {
      const feedback = `Feedback: ${t.estimateFeedbackRating}`;
      const correction =
        t.correctedEstimateMinutes !== undefined
          ? ` (corrected to ${t.correctedEstimateMinutes} min)`
          : "";
      parts.push(`${feedback}${correction}`);
    }
    return `- ${parts.join(" | ")}`;
  });

  return `Prior tasks from this student (learn from feedback to calibrate the estimate):\n${lines.join("\n")}`;
}

/**
 * Formats a list of relevant chats into a context block.
 *
 * Currently accepts pre-fetched chat objects. In the future this will accept
 * chatIds and batch-fetch them via getChatsByIdsInternal once a chats table exists.
 */
function buildChatContext(chats: RelevantChat[]): string | null {
  if (chats.length === 0) return null;

  const lines = chats.map((chat) => `[${chat.role}]: ${chat.content}`);
  return `Relevant chat history:\n${lines.join("\n")}`;
}

/**
 * Builds a structured JSON profile from all user preferences and academic
 * insights that may influence study time estimation.
 */
function buildProfileContext(user: Doc<"users"> | null): string | null {
  if (!user) return null;

  const profile: Record<string, unknown> = {};

  if (user.major) profile.major = sanitizeUserInput(user.major, 200);
  if (user.year) profile.year = user.year;
  if (user.difficultSubjects?.length) {
    profile.difficultSubjects = user.difficultSubjects.map((s) =>
      sanitizeUserInput(s, 200)
    );
  }
  if (user.enjoyedSubjects?.length) {
    profile.enjoyedSubjects = user.enjoyedSubjects.map((s) =>
      sanitizeUserInput(s, 200)
    );
  }
  if (user.focusBlockLength !== undefined) {
    profile.focusBlockLengthMinutes = user.focusBlockLength;
  }
  if (user.productivityTraits) {
    profile.productivityTraits = user.productivityTraits;
  }
  if (user.transcriptSummary?.length) {
    profile.academicInsights = user.transcriptSummary.map((insight) => ({
      label: sanitizeUserInput(insight.label, 200),
      text: sanitizeUserInput(insight.text, 1_000),
    }));
  }

  if (Object.keys(profile).length === 0) return null;

  return JSON.stringify(profile, null, 2);
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Estimates how long a task will take (in minutes) using Gemini.
 *
 * Retrieves relevant courses, prior tasks, and chats via mock embedding
 * retrieval functions, then builds context blocks and calls Gemini with a
 * structured output schema that includes an estimate and a per-category
 * reasoning trace.
 */
export const estimateTaskTime = internalAction({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) return;

    const [user, taskCourses, chats] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, {
        userId: task.userId,
      }),
      task.courseId
        ? ctx.runQuery(
            internal.queries.userCourses.getUserCoursesByIdsInternal,
            { courseIds: [task.courseId] }
          )
        : Promise.resolve([]),
      fetchRelevantChats(ctx, args.taskId, task.userId),
    ]);

    const taskCourse = (taskCourses as Doc<"userCourses">[])[0] as
      | Doc<"userCourses">
      | undefined;

    const [courseContext, taskContext] = await Promise.all([
      buildCourseContext(ctx, args.taskId, task.userId),
      buildTaskContext(ctx, args.taskId, task.userId),
    ]);

    const chatContext = buildChatContext(chats);
    const profileContext = buildProfileContext(user as Doc<"users"> | null);

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
          title: sanitizeUserInput(task.title, 500),
          taskType: task.taskType,
          description: sanitizeUserInput(task.description ?? "", 5_000),
          courseInfo: taskCourse
            ? `${taskCourse.courseCode} - ${sanitizeUserInput(taskCourse.title, 500)}`
            : undefined,
          courseContext: courseContext ?? undefined,
          taskContext: taskContext ?? undefined,
          chatContext: chatContext ?? undefined,
          profileContext: profileContext ?? undefined,
        }),
        schema: timeEstimateResponseSchema,
        schemaName: "TimeEstimate",
      });

      await ctx.runMutation(internal.mutations.timeEstimate.setTimeEstimate, {
        taskId: args.taskId,
        timeEstimate: result.estimatedMinutes,
      });
    } catch (err) {
      console.error("Failed to estimate task time:", err);
      throw err;
    }
  },
});
