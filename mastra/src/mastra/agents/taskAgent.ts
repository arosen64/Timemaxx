import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { TASK_AGENT_SYSTEM } from "../lib/prompts/taskAgent.prompt";

/**
 * Maxx Task Agent — handles all task CRUD conversations.
 *
 * Per-turn context is built in Convex (`buildTaskAgentContextPrompt`) and passed
 * into the workflow; see `lib/prompts/taskAgent.prompt.ts` for system instructions.
 */
export const taskAgent = new Agent({
  id: "task-agent",
  name: "Maxx Task Agent",
  instructions: TASK_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-6"),
});
