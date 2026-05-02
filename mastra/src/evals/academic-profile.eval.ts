/**
 * Academic Profile Eval
 *
 * Evaluates whether the academic profile agent correctly extracts all profile
 * fields from a transcript/document, produces output faithful to the source,
 * and matches the expected structured output.
 *
 * Scorers:
 *   - createCompletenessScorer: all expected profile fields are present in output
 *   - createFaithfulnessScorer: extracted values are accurate to the source document
 *   - createAnswerSimilarityScorer: overall output matches the expected profile
 *
 * HOW TO IMPLEMENT:
 * 1. Set ANTHROPIC_API_KEY in mastra/.env (required for LLM judge scorers).
 * 2. Add items to `testData`:
 *      { input: "transcript text", groundTruth: "expected JSON or structured profile" }
 * 3. Adjust `semanticThreshold` in the similarity scorer to set pass/fail sensitivity.
 * 4. Run: npm run eval (from mastra/)
 *
 * Example:
 *   {
 *     input: "Name: Jane Doe\nGPA: 3.8\nMajor: Computer Science\nYear: Junior",
 *     groundTruth: JSON.stringify({ name: "Jane Doe", gpa: 3.8, major: "Computer Science", year: "Junior" }),
 *   }
 */

import { anthropic } from "@ai-sdk/anthropic";
import { runEvals } from "@mastra/core/evals";
import {
  createCompletenessScorer,
  createFaithfulnessScorer,
  createAnswerSimilarityScorer,
} from "@mastra/evals/scorers/prebuilt";
import { academicProfileAgent } from "../mastra/agents/academicProfileAgent";

// Add real test cases here
const testData: Array<{ input: string; groundTruth?: string }> = [
  // {
  //   input: "Name: Jane Doe\nGPA: 3.8\nMajor: Computer Science\nYear: Junior",
  //   groundTruth: JSON.stringify({ name: "Jane Doe", gpa: 3.8, major: "Computer Science", year: "Junior" }),
  // },
];

const judgeModel = anthropic("claude-haiku-4-5-20251001");

// Code-based: checks that all input elements appear in the output (no LLM required)
const completenessScorer = createCompletenessScorer();

// LLM-based: checks that extracted values are accurate to the source
const faithfulnessScorer = createFaithfulnessScorer({ model: judgeModel });

// LLM-based: checks overall similarity between output and expected profile
const answerSimilarityScorer = createAnswerSimilarityScorer({
  model: judgeModel,
  options: { semanticThreshold: 0.8 },
});

export async function runAcademicProfileEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }
  return runEvals({
    data: testData,
    target: academicProfileAgent,
    scorers: {
      agent: [completenessScorer, faithfulnessScorer, answerSimilarityScorer],
    },
    onItemComplete: ({ item, scorerResults }) => {
      console.log("  item input:", item.input);
      console.log("  scores:", scorerResults);
    },
  });
}
