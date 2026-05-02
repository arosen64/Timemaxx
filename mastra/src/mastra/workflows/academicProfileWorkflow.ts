/**
 * Academic Profile Workflow — two-step agentic pipeline.
 *
 * Step 1 (analyze-courses): Course Analyst Agent extracts structured
 * observations from raw course history (grades, difficulty, terms).
 *
 * Step 2 (generate-profile): Academic Profile Agent synthesizes those
 * observations into exactly 5 labeled insights.
 *
 * Triggered by the Convex `generateAcademicProfile` action via MastraClient.
 * The action is responsible for building the sanitized course list; this
 * workflow owns both LLM calls and the data flow between them.
 *
 * Input:  { sanitizedCourseList: string }
 * Output: { insights: Array<{ label: string; text: string }> }
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { courseAnalystAgent } from "../agents/courseAnalystAgent";
import { academicProfileAgent } from "../agents/academicProfileAgent";
import {
  courseAnalysisSchema,
  buildCourseAnalysisPrompt,
} from "../lib/prompts/courseAnalystAgent.prompt";
import {
  academicProfileSchema,
  buildAcademicProfilePrompt,
} from "../lib/prompts/academicProfileAgent.prompt";

// ---------------------------------------------------------------------------
// Step 1 — extract structured observations from raw course data
// ---------------------------------------------------------------------------

const analyzeCourseStep = createStep({
  id: "analyze-courses",
  inputSchema: z.object({
    sanitizedCourseList: z.string().describe("Sanitized course history string"),
  }),
  outputSchema: courseAnalysisSchema,
  execute: async ({ inputData }) => {
    const response = await courseAnalystAgent.generate(
      buildCourseAnalysisPrompt(inputData.sanitizedCourseList),
      { structuredOutput: { schema: courseAnalysisSchema } },
    );
    if (!response.object) throw new Error("courseAnalystAgent returned no structured output");
    return response.object;
  },
});

// ---------------------------------------------------------------------------
// Step 2 — synthesize observations into 5 labeled insights
// ---------------------------------------------------------------------------

const generateProfileStep = createStep({
  id: "generate-profile",
  inputSchema: courseAnalysisSchema,
  outputSchema: academicProfileSchema,
  execute: async ({ inputData }) => {
    const response = await academicProfileAgent.generate(
      buildAcademicProfilePrompt(inputData),
      { structuredOutput: { schema: academicProfileSchema } },
    );
    if (!response.object) throw new Error("academicProfileAgent returned no structured output");
    return response.object;
  },
});

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export const academicProfileWorkflow = createWorkflow({
  id: "academic-profile-workflow",
  inputSchema: z.object({
    sanitizedCourseList: z.string(),
  }),
  outputSchema: academicProfileSchema,
})
  .then(analyzeCourseStep)
  .then(generateProfileStep)
  .commit();
