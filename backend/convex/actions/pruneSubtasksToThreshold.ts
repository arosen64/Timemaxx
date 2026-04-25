"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { z } from "zod";
import { callGemini } from "../lib/gemini";

export const pruneSubtasksToThreshold = internalAction({
  args: {
    taskId: v.id("tasks"),
    targetMinutes: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) return null;

    const subtasks = await ctx.runQuery(
      internal.queries.subtasks.getSubtasksForTaskInternal,
      { parentTaskId: args.taskId }
    );
    if (subtasks.length <= 1) return null;

    const actualSum = subtasks.reduce((s, st) => s + (st.timeEstimate ?? 0), 0);
    if (actualSum <= args.targetMinutes * 1.1) return null;

    const lowerBound = Math.round(args.targetMinutes * 0.9);
    const upperBound = Math.round(args.targetMinutes * 1.1);
    const overBy = actualSum - args.targetMinutes;

    const subtaskList = subtasks
      .map(
        (st, i) =>
          `${i + 1}. "${st.title}" — ${st.timeEstimate ?? 0} min\n   ${st.description}`
      )
      .join("\n");

    const prompt = `You are helping a student trim their study plan to fit a time budget.

Task: "${task.title}"
Description: ${task.description}

Subtasks (current estimates):
${subtaskList}

Current total: ${actualSum} min
Target: ${args.targetMinutes} min (acceptable range: ${lowerBound}–${upperBound} min)
Over budget by: ${overBy} min

Remove the minimum number of least-important subtasks so the remaining total falls within the acceptable range after proportional rescaling. Prefer removing subtasks that are:
- Supplementary or optional (e.g. review, polish, extra practice)
- Least essential to completing the core task
- Smallest contributors relative to how much they inflate the total

Return the 1-based indices of the subtasks to remove.`;

    const result = await callGemini({
      system:
        "You are an academic study planner that optimizes study plans to fit time budgets.",
      prompt,
      schema: z.object({
        indicesToRemove: z
          .array(z.number().int().min(1))
          .describe("1-based indices of subtasks to remove"),
      }),
      schemaName: "SubtaskPruningDecision",
      schemaDescription: "Which subtasks to remove to fit the time budget",
    });

    const validIndices = result.indicesToRemove.filter(
      (i) => i >= 1 && i <= subtasks.length
    );
    if (validIndices.length === 0) return null;

    // Never remove all subtasks — keep at least one
    if (subtasks.length - validIndices.length < 1) return null;

    const subtaskIdsToRemove = validIndices.map((i) => subtasks[i - 1]._id);

    await ctx.runMutation(internal.mutations.timeEstimate.applySubtaskPruning, {
      taskId: args.taskId,
      subtaskIdsToRemove,
      targetMinutes: args.targetMinutes,
    });

    return null;
  },
});
