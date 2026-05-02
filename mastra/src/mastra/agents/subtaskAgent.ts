import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { SUBTASK_AGENT_SYSTEM } from "../lib/prompts/subtaskAgent.prompt";

/**
 * Subtask Agent — breaks an assignment into 1–6 concrete, actionable subtasks.
 *
 * Called by the Convex `generateSubtasks` internal action after it has
 * assembled the task details and any uploaded file content into a single
 * `contextPrompt`. The agent never touches the database — it only returns
 * a structured list of subtasks that the Convex layer persists.
 *
 * Input (via subtaskGenerationWorkflow):
 *   contextPrompt — assignment title, type, due date, description, and
 *   optional file content, assembled by the Convex action.
 *
 * Output:
 *   subtasks — ordered array of { title, description, taskType }.
 *
 * System prompt and response schema live in lib/prompts/subtaskAgent.prompt.ts.
 */
export const subtaskAgent = new Agent({
  id: "subtask-agent",
  name: "Subtask Agent",
  instructions: SUBTASK_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-6"),
});
