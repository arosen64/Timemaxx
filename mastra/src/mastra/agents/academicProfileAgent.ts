import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { ACADEMIC_PROFILE_SYSTEM } from "../lib/prompts/academicProfileAgent.prompt";

/**
 * Academic Profile Agent — step 2 of the academic profile workflow.
 *
 * Receives the structured analysis produced by the Course Analyst Agent and
 * synthesizes it into exactly 5 labeled insights (Academic Strengths, Areas
 * for Improvement, Performance Trend, Course Load & Patterns, Study
 * Recommendations). Each insight is 1-2 sentences grounded in the analysis.
 */
export const academicProfileAgent = new Agent({
  id: "academic-profile-agent",
  name: "Academic Profile Agent",
  instructions: ACADEMIC_PROFILE_SYSTEM,
  model: anthropic("claude-sonnet-4-6"),
});
