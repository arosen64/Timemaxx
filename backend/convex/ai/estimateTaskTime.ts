import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { GenericActionCtx } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { callAnthropic } from "../lib/anthropic";
import { sanitizeUserInput } from "../lib/sanitize";
import {
  TIME_ESTIMATE_SYSTEM,
  buildTimeEstimatePrompt,
  timeEstimateResponseSchema,
} from "../lib/prompts/estimateTaskTime.prompt";
import { taskToTaskLike, subtaskToTaskLike, TaskLike } from "../lib/taskTypes";
import {
  RelevantChat,
  fetchRelevantContext,
} from "../lib/retrieval";

type Ctx = GenericActionCtx<DataModel>;

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

/**
 * Batch-loads the given course IDs and formats a clean context block for the LLM.
 */
async function buildCourseContext(
  ctx: Ctx,
  courseIds: Id<"userCourses">[]
): Promise<string | null> {
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
 * Batch-loads the given task IDs and formats a context block that includes
 * estimate history and feedback.
 */
async function buildTaskContext(
  ctx: Ctx,
  taskIds: Id<"tasks">[]
): Promise<string | null> {
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
 * Formats relevant chats into a context block.
 * TODO: batch-fetch chats by chatIds via getChatsByIdsInternal once a chats table exists.
 * NOTE: fetchRelevantChats always returns [] until a chats table is added, so this
 * always returns null. The Gemini prompt's "chats" reasoning category will therefore
 * always report no chat context. Consider removing the chats category from the required
 * reasoning trace (reasoningTraceSchema + TIME_ESTIMATE_SYSTEM) until this is populated.
 */
function buildChatContext(_chatIds: string[]): string | null {
  const chats: RelevantChat[] = [];
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
 * Estimates how long a task or subtask will take (in minutes) using Claude Sonnet 4.
 * Pass either taskId or subtaskId — not both.
 * Retrieves relevant courses, prior tasks, and chats via mock embedding
 * retrieval functions, then builds context blocks and calls Anthropic with a
 * structured output schema that includes an estimate and a per-category
 * reasoning trace. Stores the result via the appropriate mutation.
 */
export const estimateTaskTime = internalAction({
  args: {
    taskId: v.optional(v.id("tasks")),
    subtaskId: v.optional(v.id("subtasks")),
  },
  handler: async (ctx, args) => {
    if (!args.taskId && !args.subtaskId) {
      console.error("estimateTaskTime: must pass taskId or subtaskId");
      return;
    }

    type ReasoningTrace = { classes: string; tasks: string; chats: string; profile: string };
    let item: TaskLike;
    let store: (minutes: number, reasoning: ReasoningTrace) => Promise<void>;
    let contextTaskId: Id<"tasks">;

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
      contextTaskId = subtask.parentTaskId;
      store = async (minutes, _reasoning) => {
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
      contextTaskId = args.taskId!;
      store = async (minutes, reasoning) => {
        await ctx.runMutation(internal.mutations.timeEstimate.setTimeEstimate, {
          taskId: args.taskId!,
          timeEstimate: minutes,
          reasoning,
        });
      };
    }

    const [user, relevantContext, allCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId: item.userId }),
      fetchRelevantContext(ctx, contextTaskId, item.userId),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId: item.userId }),
    ]);

    const taskCourse = item.courseId ? allCourses.find((c: Doc<"userCourses">) => c._id === item.courseId) : undefined;

    const [courseContext, taskContext] = await Promise.all([
      buildCourseContext(ctx, relevantContext.classIds),
      buildTaskContext(ctx, relevantContext.taskIds),
    ]);

    const chatContext = buildChatContext(relevantContext.chatIds);
    const profileContext = buildProfileContext(user as Doc<"users"> | null);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      if (process.env.VITEST !== "true") {
        console.error("ANTHROPIC_API_KEY is not set");
      }
      return;
    }

    try {
      const result = await callAnthropic({
        system: TIME_ESTIMATE_SYSTEM,
        prompt: buildTimeEstimatePrompt({
          title: sanitizeUserInput(item.title, 500),
          taskType: item.taskType,
          description: sanitizeUserInput(item.description ?? "", 5_000),
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

      await store(result.estimatedMinutes, result.reasoningTrace);
    } catch (err) {
      console.error("Failed to estimate task time:", err);
      throw err;
    }
  },
});
