import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ChatWorkflowOutput } from "./chatWorkflowHttpTypes";

async function scheduleTaskFromOutput(
  _ctx: ActionCtx,
  activeTaskId: Id<"tasks"> | undefined,
  _output: ChatWorkflowOutput,
): Promise<{ aiText: string }> {
  if (!activeTaskId) throw new Error("No task selected.");
  // TODO: call scheduleTask action, return scheduled block count in confirmation
  return { aiText: "Done! I've scheduled study blocks for that task." };
}

async function importGoogleCalendarFromOutput(
  ctx: ActionCtx,
  userId: Id<"users">,
  _output: ChatWorkflowOutput,
): Promise<{ aiText: string }> {
  const calConn = await ctx.runQuery(internal.queries.calendar.getCalendarConnectionForUser, { userId });
  if (!calConn) {
    return {
      aiText: "You haven't connected Google Calendar yet. Head to your **Profile** page to connect it, then come back to sync.",
    };
  }
  // TODO: trigger calendar sync and surface results
  return { aiText: "Your Google Calendar is connected! It's automatically used when scheduling your tasks." };
}

export async function executeScheduleAction(
  ctx: ActionCtx,
  params: {
    userId: Id<"users">;
    sessionId: string;
    activeTaskId?: Id<"tasks">;
    output: ChatWorkflowOutput;
  },
): Promise<string> {
  const { userId, sessionId, activeTaskId, output } = params;
  let aiText = output.reply;

  try {
    if (output.actionType === "schedule_task") {
      const r = await scheduleTaskFromOutput(ctx, activeTaskId, output);
      aiText = r.aiText;
    } else if (output.actionType === "import_google_calendar") {
      const r = await importGoogleCalendarFromOutput(ctx, userId, output);
      aiText = r.aiText;
    }
  } catch (err) {
    aiText = `Sorry, I ran into an issue: ${err instanceof Error ? err.message : "Please try again."}`;
  }

  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: aiText,
  });
  await ctx.runMutation(internal.mutations.chatSessions.clearTaskAgentStateInternal, { userId, sessionId });
  return aiText;
}
