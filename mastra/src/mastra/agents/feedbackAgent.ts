import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { FEEDBACK_AGENT_SYSTEM } from "../lib/prompts/feedbackAgent.prompt";

/**
 * Maxx Feedback Agent — converses with users about task/class difficulty and effort.
 *
 * Per-turn context is built in Convex (`buildFeedbackAgentContextPrompt`); system
 * instructions live in `lib/prompts/feedbackAgent.prompt.ts`.
 */
export const feedbackAgent = new Agent({
  id: "feedback-agent",
  name: "Maxx Feedback Agent",
  instructions: FEEDBACK_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-20250514"),
});
