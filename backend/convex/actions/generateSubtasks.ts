"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { z } from "zod";
import { MastraClient } from "@mastra/client-js";
import { sanitizeUserInput } from "../lib/sanitize";
import { computeSubtaskCascade } from "../lib/scheduleSlots";

export type GeneratedSubtask = {
  title: string;
  description: string;
  taskType: string;
  // suggestedCompletionAt is a linear placeholder for the preview.
  // After the user confirms and subtasks are estimated, the confirm action
  // recomputes it proportionally from actual timeEstimate values.
  suggestedCompletionAt: string; // ISO 8601
};

export type GenerateSubtasksResult = { subtasks: GeneratedSubtask[] } | { error: string };

const SUBTASK_STEP_ID = "subtask-generation-step";

const subtaskOutputSchema = z.object({
  subtasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      taskType: z.string(),
    })
  ),
});

export const generateSubtasks = internalAction({
  args: {
    taskId: v.id("tasks"),
    fileContent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateSubtasksResult> => {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) return { error: "Task not found." };

    const hasDescription = task.description.trim().length > 0;
    const hasFileContent = (args.fileContent ?? "").trim().length > 0;

    if (!hasDescription && !hasFileContent) {
      return {
        error:
          "Please provide a description or upload an assignment file before generating subtasks.",
      };
    }

    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) {
      if (process.env.VITEST !== "true") {
        console.error("MASTRA_URL is not set");
      }
      return { error: "Subtask generation is unavailable. Please try again later." };
    }

    const dueDate = new Date(task.dueDate).toISOString();

    // User-provided fields are wrapped in XML delimiters so the model can
    // unambiguously identify section boundaries. sanitizeUserInput strips XML
    // tags from user input, so these delimiters cannot be closed prematurely
    // by content — preventing field-label injection across sections.
    const sections: string[] = [];

    sections.push(`<assignment_details>
Title: ${sanitizeUserInput(task.title, 500)}
Type: ${sanitizeUserInput(task.taskType, 100)}
Due date: ${dueDate}
</assignment_details>`);

    if (task.description.trim()) {
      sections.push(`<assignment_description>
${sanitizeUserInput(task.description, 5_000)}
</assignment_description>`);
    }

    if (hasFileContent) {
      sections.push(`<uploaded_file_content>
${sanitizeUserInput(args.fileContent!, 10_000)}
</uploaded_file_content>`);
    }

    const contextPrompt = `Break this assignment into concrete, actionable subtasks.\n\n${sections.join("\n\n")}`;

    try {
      const client = new MastraClient({ baseUrl: mastraUrl });
      const wf = client.getWorkflow("subtask-generation-workflow");
      const run = await wf.startAsync({ inputData: { contextPrompt } });

      const runStatus = (run as { status?: string }).status;
      if (runStatus === "failed") {
        const rawErr = (run as { error?: string | Error }).error;
        const runErrMsg = rawErr instanceof Error ? rawErr.message : String(rawErr ?? "unknown");
        console.error("Subtask generation workflow top-level failure:", runErrMsg);
        return { error: "Failed to generate subtasks. Please try again." };
      }

      for (const [stepId, step] of Object.entries(run.steps ?? {})) {
        if (!("status" in step)) continue;
        if (!("output" in step)) {
          const rawErr = (step as { error?: string | Error }).error;
          const stepStatus = (step as { status?: string }).status ?? "unknown";
          const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr ?? "");
          console.error(
            `Subtask generation step "${stepId}" has no output (status: ${stepStatus}):`,
            errMsg
          );
          return { error: "Failed to generate subtasks. Please try again." };
        }
      }

      const stepOutput = run.steps?.[SUBTASK_STEP_ID];
      if (!stepOutput || !("output" in stepOutput)) {
        const availableKeys = Object.keys(run.steps ?? {}).join(", ") || "(none)";
        console.error(
          `No output from subtask generation workflow — expected step "${SUBTASK_STEP_ID}", got: ${availableKeys}`
        );
        return { error: "Failed to generate subtasks. Please try again." };
      }

      const parsed = subtaskOutputSchema.safeParse(stepOutput.output);
      if (!parsed.success) {
        console.error("Subtask agent output failed schema validation:", parsed.error);
        return { error: "Failed to generate subtasks. Please try again." };
      }

      const rawSubtasks = parsed.data.subtasks;
      if (rawSubtasks.length === 0) {
        return { error: "No subtasks were generated. Please try again." };
      }

      const nowMs = Date.now();
      const dueDateMs = task.dueDate;
      const n = rawSubtasks.length;
      const dateAt = computeSubtaskCascade(nowMs, dueDateMs, n);

      const subtasks: GeneratedSubtask[] = rawSubtasks.map((s, i) => ({
        ...s,
        suggestedCompletionAt: new Date(dateAt(i)).toISOString(),
      }));

      return { subtasks };
    } catch (err) {
      console.error("Failed to generate subtasks:", err);
      return { error: err instanceof Error ? err.message : "Failed to generate subtasks" };
    }
  },
});
