import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { COURSE_ANALYST_SYSTEM } from "../lib/prompts/courseAnalystAgent.prompt";

/**
 * Course Analyst Agent — step 1 of the academic profile workflow.
 *
 * Receives sanitized course history (title, grade, term, difficulty) and
 * extracts structured factual observations: subject strengths, grade trends,
 * course-load patterns, and study observations. It does NOT generate advice —
 * that is the Academic Profile Agent's job.
 */
export const courseAnalystAgent = new Agent({
  id: "course-analyst-agent",
  name: "Course Analyst Agent",
  instructions: COURSE_ANALYST_SYSTEM,
  model: anthropic("claude-sonnet-4-6"),
});
