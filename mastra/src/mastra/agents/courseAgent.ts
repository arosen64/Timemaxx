import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { COURSE_AGENT_SYSTEM } from "../lib/prompts/courseAgent.prompt";

/**
 * Maxx Course Agent — handles course-related conversations.
 */
export const courseAgent = new Agent({
  id: "course-agent",
  name: "Maxx Course Agent",
  instructions: COURSE_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-20250514"),
});
