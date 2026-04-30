import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ChatWorkflowOutput } from "./chatWorkflowHttpTypes";

type BlockMcqResult = {
  needsBlockMcq: true;
  blockCandidates: Array<{ id: string; label: string; subtitle: string }>;
  aiText: string;
};
type ActionResult = { aiText: string } | BlockMcqResult;

async function scheduleTaskFromOutput(
  ctx: ActionCtx,
  activeTaskId: Id<"tasks"> | undefined,
  timezone: string
): Promise<ActionResult> {
  if (!activeTaskId) throw new Error("No task selected.");

  const blocks = await ctx.runQuery(internal.queries.studyBlocks.getStudyBlocksByTaskInternal, {
    taskId: activeTaskId,
  });

  if (blocks.length === 0) {
    return {
      aiText: "This task has no study blocks yet. Generate blocks from the task detail page first.",
    };
  }

  const unscheduledBefore = blocks.filter((b) => !b.startTime && !b.isCompleted).length;
  if (unscheduledBefore === 0) {
    return { aiText: "All blocks for this task are already scheduled!" };
  }

  const result = await ctx.runAction(api.actions.scheduleAllBlocks.scheduleAllBlocks, {
    taskId: activeTaskId,
    timezone,
  });

  const { scheduled } = result;
  const remaining = unscheduledBefore - scheduled;

  if (scheduled === 0) {
    return {
      aiText:
        "I couldn't find free time slots — try adjusting your work hours or the task's due date.",
    };
  }

  if (remaining === 0) {
    return { aiText: `Done! I've scheduled all ${scheduled} study block(s) for that task.` };
  }

  return {
    aiText: `Done! I've planned the first ${scheduled} block(s) for that task. ${remaining} more are still unscheduled — head to the **Schedule** page to fit in the rest.`,
  };
}

async function scheduleBlockFromOutput(
  ctx: ActionCtx,
  activeTaskId: Id<"tasks"> | undefined,
  activeBlockId: Id<"studyBlocks"> | undefined,
  timezone: string
): Promise<ActionResult> {
  if (!activeTaskId) throw new Error("No task selected.");

  const blocks = await ctx.runQuery(internal.queries.studyBlocks.getStudyBlocksByTaskInternal, {
    taskId: activeTaskId,
  });

  if (activeBlockId) {
    // Defense in depth: a stale activeBlockId from an earlier flow must not act on the wrong task.
    const picked = blocks.find((b) => b._id === activeBlockId);
    if (!picked) {
      return { aiText: "That block doesn't belong to the selected task." };
    }
    const result = await ctx.runAction(api.actions.scheduleBlock.scheduleBlock, {
      studyBlockId: activeBlockId,
      timezone,
    });
    if ("error" in result) {
      return {
        aiText:
          "I couldn't find a free time slot for that block — try adjusting your work hours or the task's due date.",
      };
    }
    if (result.scheduled === 0) {
      return { aiText: "That block is already scheduled!" };
    }
    return { aiText: "Done! I've scheduled that study block." };
  }

  const unscheduled = blocks.filter((b) => !b.startTime && !b.isCompleted);

  if (unscheduled.length === 0) {
    return { aiText: "All blocks for this task are already scheduled!" };
  }

  if (unscheduled.length === 1) {
    const result = await ctx.runAction(api.actions.scheduleBlock.scheduleBlock, {
      studyBlockId: unscheduled[0]._id,
      timezone,
    });
    if ("error" in result) {
      return {
        aiText:
          "I couldn't find a free time slot for that block — try adjusting your work hours or the task's due date.",
      };
    }
    if (result.scheduled === 0) {
      return { aiText: "That block is already scheduled!" };
    }
    return { aiText: "Done! I've scheduled that study block." };
  }

  const total = unscheduled.length;
  return {
    needsBlockMcq: true,
    blockCandidates: unscheduled.map((b, i) => ({
      id: String(b._id),
      label: b.title,
      subtitle: `Block ${i + 1} of ${total} · ${b.studyBlockLength} min`,
    })),
    aiText: "Which study block would you like me to schedule? Pick one below.",
  };
}

async function importGoogleCalendarFromOutput(
  ctx: ActionCtx,
  userId: Id<"users">
): Promise<ActionResult> {
  const calConn = await ctx.runQuery(internal.queries.calendar.getCalendarConnectionForUser, {
    userId,
  });
  if (!calConn) {
    return {
      aiText:
        "You haven't connected Google Calendar yet. Head to your **Profile** page to connect it, then come back to sync.",
    };
  }
  return {
    aiText:
      "Your Google Calendar is connected! It's automatically used when scheduling your tasks.",
  };
}

export async function executeScheduleAction(
  ctx: ActionCtx,
  params: {
    userId: Id<"users">;
    sessionId: string;
    activeTaskId?: Id<"tasks">;
    activeBlockId?: Id<"studyBlocks">;
    timezone: string;
    output: ChatWorkflowOutput;
  }
): Promise<ActionResult> {
  const { userId, sessionId, activeTaskId, activeBlockId, timezone, output } = params;
  let result: ActionResult = { aiText: output.reply };

  try {
    if (output.actionType === "schedule_task") {
      result = await scheduleTaskFromOutput(ctx, activeTaskId, timezone);
    } else if (output.actionType === "schedule_block") {
      result = await scheduleBlockFromOutput(ctx, activeTaskId, activeBlockId, timezone);
    } else if (output.actionType === "import_google_calendar") {
      result = await importGoogleCalendarFromOutput(ctx, userId);
    }
  } catch (err) {
    result = {
      aiText: `Sorry, I ran into an issue: ${err instanceof Error ? err.message : "Please try again."}`,
    };
  }

  // Block MCQ path: do NOT save message or clear state — http_chat.ts handles that.
  if ("needsBlockMcq" in result) {
    return result;
  }

  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: result.aiText,
  });
  await ctx.runMutation(internal.mutations.chatSessions.clearTaskAgentStateInternal, {
    userId,
    sessionId,
  });
  return result;
}
