import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  supervisorRouteEnum,
  SUPERVISOR_AGENT_SYSTEM,
} from "../lib/prompts/supervisorAgent.prompt";

export type Route = z.infer<typeof supervisorRouteEnum>;

/**
 * Pure router: decides which subagent should handle this message.
 * Does NOT do entity clarification — that belongs to each subagent.
 */
export const supervisorAgent = new Agent({
  id: "supervisor-agent",
  name: "Maxx Supervisor",
  instructions: SUPERVISOR_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-20250514"),
});
