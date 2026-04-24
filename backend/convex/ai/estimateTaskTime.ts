import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { GenericActionCtx } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { MastraClient } from "@mastra/client-js";
import { sanitizeUserInput } from "../lib/sanitize";
import {
  buildTimeEstimatePrompt,
  estimationAgentOutputSchema,
  EstimationAgentOutput,
} from "../lib/prompts/estimateTaskTime.prompt";
import { taskToTaskLike, subtaskToTaskLike, TaskLike } from "../lib/taskTypes";
import { fetchRelevantContext } from "../lib/retrieval";

const ESTIMATION_STEP_ID = "estimation-agent";

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
      `Code: ${sanitizeUserInput(c.courseCode, 100)}`,
      `Title: ${sanitizeUserInput(c.title, 500)}`,
      `Term: ${sanitizeUserInput(c.term, 100)}`,
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
      `Type: ${sanitizeUserInput(t.taskType, 100)}`,
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
 * Loads `chatChunks` by id and formats transcript excerpts for the LLM.
 * When `preloadedChunks` matches `chunkIds` in length and order (from `fetchRelevantContext`), skips a second DB read.
 */
async function buildChatContext(
  ctx: Ctx,
  userId: Id<"users">,
  chunkIds: Id<"chatChunks">[],
  preloadedChunks?: Doc<"chatChunks">[],
): Promise<string | null> {
  if (chunkIds.length === 0) return null;

  const chunks =
    preloadedChunks !== undefined && preloadedChunks.length === chunkIds.length
      ? preloadedChunks
      : ((await ctx.runQuery(internal.queries.chatChunks.getChatChunksByIdsInternal, {
          userId,
          chunkIds,
        })) as Doc<"chatChunks">[]);
  if (chunks.length === 0) return null;

  const lines = chunks.map((c) => {
    const excerpt = sanitizeUserInput(c.text, 2_500);
    return `- (${new Date(c.startCreatedAt).toISOString()}) ${excerpt}`;
  });
  return `Relevant chat history (excerpts from prior conversations):\n${lines.join("\n")}`;
}

/**
 * Builds a structured JSON profile from all user preferences and academic
 * insights that may influence study time estimation.
 */
function buildProfileContext(user: Doc<"users"> | null): string | null {
  if (!user) return null;

  const profile: Record<string, unknown> = {};

  if (user.major) profile.major = sanitizeUserInput(user.major, 200);
  if (user.year) profile.year = sanitizeUserInput(user.year, 50);
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
 *
 * Retrieves relevant courses, prior tasks, and embedded chat chunks, then
 * builds context blocks and calls Anthropic with a structured output schema
 * that includes an estimate and a per-category reasoning trace.
 * Stores the result via the appropriate mutation.
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

    type ReasoningTrace = EstimationAgentOutput["reasoningTrace"];
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
      store = async (minutes, reasoning) => {
        await ctx.runMutation(internal.mutations.subtasks.setSubtaskTimeEstimate, {
          subtaskId: args.subtaskId!,
          timeEstimate: minutes,
          reasoning,
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

    const [courseContext, taskContext, chatContext] = await Promise.all([
      buildCourseContext(ctx, relevantContext.classIds),
      buildTaskContext(ctx, relevantContext.taskIds),
      buildChatContext(ctx, item.userId, relevantContext.chatChunkIds, relevantContext.chatChunks),
    ]);
    const profileContext = buildProfileContext(user as Doc<"users"> | null);

    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) {
      if (process.env.VITEST !== "true") {
        console.error("MASTRA_URL is not set");
      }
      return;
    }

    try {
      const contextPrompt = buildTimeEstimatePrompt({
        title: sanitizeUserInput(item.title, 500),
        taskType: sanitizeUserInput(item.taskType, 100),
        description: sanitizeUserInput(item.description ?? "", 5_000),
        courseInfo: taskCourse
          ? `${sanitizeUserInput(taskCourse.courseCode, 100)} - ${sanitizeUserInput(taskCourse.title, 500)}`
          : undefined,
        courseContext: courseContext ?? undefined,
        taskContext: taskContext ?? undefined,
        chatContext: chatContext ?? undefined,
        profileContext: profileContext ?? undefined,
      });

      const client = new MastraClient({ baseUrl: mastraUrl });
      const wf = client.getWorkflow("estimation-workflow");
      const run = await wf.startAsync({ inputData: { contextPrompt } });

      // If the workflow itself reports a top-level failure, surface it before
      // inspecting steps (steps may still be in running/pending state with no
      // error field of their own, which previously produced an empty message).
      const runStatus = (run as { status?: string }).status;
      if (runStatus === "failed") {
        const rawErr = (run as { error?: string | Error }).error;
        const runErrMsg = rawErr instanceof Error ? rawErr.message : String(rawErr ?? "unknown");
        console.error("Estimation workflow top-level failure:", runErrMsg, JSON.stringify(run.steps));
        if (
          runErrMsg.includes("quota") ||
          runErrMsg.includes("RESOURCE_EXHAUSTED") ||
          runErrMsg.includes("429")
        ) {
          throw new Error("quota_exceeded");
        }
        throw new Error(`Estimation workflow failed: ${runErrMsg}`);
      }

      for (const [stepId, step] of Object.entries(run.steps ?? {})) {
        if (!("status" in step)) continue;
        if (!("output" in step)) {
          const rawErr = (step as { error?: string | Error }).error;
          const stepStatus = (step as { status?: string }).status ?? "unknown";
          const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr ?? "");
          console.error(`Estimation step "${stepId}" has no output (status: ${stepStatus}):`, errMsg);
          if (
            errMsg.includes("quota") ||
            errMsg.includes("RESOURCE_EXHAUSTED") ||
            errMsg.includes("429")
          ) {
            throw new Error("quota_exceeded");
          }
          throw new Error(`Estimation workflow step "${stepId}" failed (status: ${stepStatus}): ${errMsg}`);
        }
      }

      const stepOutput = run.steps?.[ESTIMATION_STEP_ID];
      if (!stepOutput || !("output" in stepOutput)) {
        const availableKeys = Object.keys(run.steps ?? {}).join(", ") || "(none)";
        throw new Error(
          `No output from estimation workflow — expected step "${ESTIMATION_STEP_ID}", got: ${availableKeys}`
        );
      }
      const parsed = estimationAgentOutputSchema.safeParse(stepOutput.output);
      if (!parsed.success) {
        throw new Error(`Unexpected estimation output: ${parsed.error.message}`);
      }
      const result = parsed.data;

      await store(result.estimatedMinutes, result.reasoningTrace);
    } catch (err) {
      console.error("Failed to estimate task time:", err);
      throw err;
    }
  },
});

