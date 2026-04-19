import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { ESTIMATION_AGENT_SYSTEM } from "../lib/prompts/estimationAgent.prompt";

/**
 * Estimation Agent — estimates how many minutes a task or subtask will take.
 *
 * Called by the Convex `estimateTaskTime` internal action after it has
 * gathered and sanitized all relevant context from the database. The agent
 * never touches the database itself — it receives a single pre-built
 * `contextPrompt` string and returns a structured JSON response.
 *
 * Input (via estimationWorkflow):
 *   contextPrompt — XML-tagged sections for task details, enrolled courses,
 *   prior task history with feedback, chat history excerpts, and the
 *   student's academic profile.
 *
 * Output:
 *   estimatedMinutes — positive integer, minutes to complete the task.
 *   reasoningTrace   — one entry per context category (classes, tasks,
 *                      chats, profile) explaining how each shaped the
 *                      estimate; every category is addressed even when empty.
 *
 * System prompt and response schema live in lib/prompts/estimationAgent.prompt.ts.
 */
export const estimationAgent = new Agent({
  id: "estimation-agent",
  name: "Estimation Agent",
  instructions: ESTIMATION_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-20250514"),
});
