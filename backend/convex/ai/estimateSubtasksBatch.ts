import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { GenericActionCtx } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { MastraClient } from "@mastra/client-js";
import { z } from "zod";
import { sanitizeUserInput } from "../lib/sanitize";
import {
  buildTimeEstimatePrompt,
  estimationAgentOutputSchema,
} from "../lib/prompts/estimateTaskTime.prompt";
import { subtaskToTaskLike } from "../lib/taskTypes";
import { fetchRelevantContext } from "../lib/retrieval";
import {
  buildCourseContext,
  buildTaskContext,
  buildChatContext,
  buildProfileContext,
} from "./estimateTaskTime";

type Ctx = GenericActionCtx<DataModel>;

const batchResultArraySchema = z.array(
  z.object({ subtaskId: z.string() }).merge(estimationAgentOutputSchema)
);

/**
 * Estimates time for a batch of subtasks via a single round-trip to Mastra.
 * All subtaskIds must share the same parent task (the only caller is createSubtasksBatch).
 * User context, courses, and retrieval are fetched once and shared across all prompts.
 */
export const estimateSubtasksBatch = internalAction({
  args: {
    subtaskIds: v.array(v.id("subtasks")),
  },
  handler: async (ctx: Ctx, args) => {
    if (args.subtaskIds.length === 0) return;

    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) {
      if (process.env.VITEST !== "true") {
        console.error("MASTRA_URL is not set");
      }
      return;
    }

    const subtasks = (
      await Promise.all(
        args.subtaskIds.map((id) =>
          ctx.runQuery(internal.queries.subtasks.getSubtaskInternal, { subtaskId: id })
        )
      )
    ).filter((s): s is Doc<"subtasks"> => s !== null);

    if (subtasks.length === 0) return;

    // All subtasks share the same parent task and user — fetch shared context once.
    const parentTaskId = subtasks[0].parentTaskId;
    const userId = subtasks[0].userId;

    const [parentTask, user, relevantContext, allCourses] = await Promise.all([
      ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId: parentTaskId }),
      ctx.runQuery(internal.queries.users.getUserInternal, { userId }),
      fetchRelevantContext(ctx, parentTaskId, userId),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId }),
    ]);

    if (!parentTask) return;

    const taskCourse = parentTask.courseId
      ? (allCourses as Doc<"userCourses">[]).find((c) => c._id === parentTask.courseId)
      : undefined;

    const [courseContext, taskContext, chatContext] = await Promise.all([
      buildCourseContext(ctx, relevantContext.classIds),
      buildTaskContext(ctx, relevantContext.taskIds),
      buildChatContext(ctx, userId, relevantContext.chatChunkIds, relevantContext.chatChunks),
    ]);
    const profileContext = buildProfileContext(user as Doc<"users"> | null);

    const items = subtasks.map((subtask) => {
      const item = subtaskToTaskLike(subtask, parentTask as Doc<"tasks">);
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
      return { subtaskId: subtask._id as string, contextPrompt };
    });

    try {
      const client = new MastraClient({ baseUrl: mastraUrl });
      const wf = client.getWorkflow("batch-estimation-workflow");
      const run = await wf.startAsync({ inputData: items });

      const runStatus = (run as { status?: string }).status;
      if (runStatus === "failed") {
        const rawErr = (run as { error?: string | Error }).error;
        const msg = rawErr instanceof Error ? rawErr.message : String(rawErr ?? "unknown");
        console.error("Batch estimation workflow failed:", msg, JSON.stringify(run.steps));
        if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
          throw new Error("quota_exceeded");
        }
        throw new Error(`Batch estimation workflow failed: ${msg}`);
      }

      for (const [stepId, step] of Object.entries(run.steps ?? {})) {
        if (!("status" in step)) continue;
        if (!("output" in step)) {
          const rawErr = (step as { error?: string | Error }).error;
          const stepStatus = (step as { status?: string }).status ?? "unknown";
          const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr ?? "");
          console.error(
            `Batch estimation step "${stepId}" has no output (status: ${stepStatus}):`,
            errMsg
          );
          if (
            errMsg.includes("quota") ||
            errMsg.includes("RESOURCE_EXHAUSTED") ||
            errMsg.includes("429")
          ) {
            throw new Error("quota_exceeded");
          }
          throw new Error(
            `Batch estimation step "${stepId}" failed (status: ${stepStatus}): ${errMsg}`
          );
        }
      }

      const runResult = (run as { result?: unknown }).result;
      const parsed = batchResultArraySchema.safeParse(runResult);
      if (!parsed.success) {
        throw new Error(`Unexpected batch estimation output: ${parsed.error.message}`);
      }

      await Promise.all(
        parsed.data.map((result) =>
          ctx.runMutation(internal.mutations.subtasks.setSubtaskTimeEstimate, {
            subtaskId: result.subtaskId as Id<"subtasks">,
            timeEstimate: result.estimatedMinutes,
            reasoning: result.reasoningTrace,
          })
        )
      );
    } catch (err) {
      console.error("Failed to batch-estimate subtask times:", err);
      throw err;
    }
  },
});
