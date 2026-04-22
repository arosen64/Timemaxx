import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { SYLLABUS_SYSTEM } from "../lib/prompts/syllabusAgent.prompt";

export const syllabusAgent = new Agent({
  id: "syllabus-agent",
  name: "Syllabus Parser Agent",
  instructions: SYLLABUS_SYSTEM,
  model: anthropic("claude-sonnet-4-20250514"),
});
