import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { PREFERENCES_AGENT_SYSTEM } from "../lib/prompts/preferencesAgent.prompt";

/**
 * Maxx Preferences Agent — stub.
 * Directs users to the Preferences page to make changes.
 * TODO: implement actual preference reading/writing via Convex tools.
 */
export const preferencesAgent = new Agent({
  id: "preferences-agent",
  name: "Maxx Preferences Agent",
  instructions: PREFERENCES_AGENT_SYSTEM,
  model: anthropic("claude-sonnet-4-20250514"),
});
