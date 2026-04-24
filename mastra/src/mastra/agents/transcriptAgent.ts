import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { TRANSCRIPT_SYSTEM } from "../lib/prompts/transcriptAgent.prompt";

export const transcriptAgent = new Agent({
  id: "transcript-agent",
  name: "Transcript Parser Agent",
  instructions: TRANSCRIPT_SYSTEM,
  model: anthropic("claude-sonnet-4-20250514"),
});
