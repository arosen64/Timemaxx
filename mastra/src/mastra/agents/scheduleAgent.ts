import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { SCHEDULE_AGENT_SYSTEM } from "../lib/prompts/scheduleAgent.prompt";

export const scheduleAgent = new Agent({
  id: "schedule-agent",
  name: "Maxx Schedule Agent",
  instructions: SCHEDULE_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-6"),
});
