/**
 * Entity Clarification Eval
 *
 * Evaluates whether the supervisor agent correctly extracts and clarifies task/class
 * entity IDs from ambiguous user input. Checks that all referenced entities are
 * identified and that the response matches the expected output.
 *
 * Scorers:
 *   - createAnswerSimilarityScorer: compares extracted entity info against ground truth
 *   - createCompletenessScorer: checks that all entities from the input are present in output
 *
 * HOW TO IMPLEMENT:
 * 1. Set ANTHROPIC_API_KEY in mastra/.env (required for the LLM judge scorer).
 * 2. Add items to `testData`:
 *      { input: "...", groundTruth: "expected entity extraction" }
 * 3. Adjust the scorer options (semanticThreshold, scale) to fit your use case.
 * 4. Run: npm run eval (from mastra/)
 *
 * Example:
 *   {
 *     input: "Update the CS101 assignment due date",
 *     groundTruth: "entities: course=CS101, action=update, field=due_date",
 *   }
 */

import { anthropic } from "@ai-sdk/anthropic";
import { runEvals } from "@mastra/core/evals";
import {
  createAnswerSimilarityScorer,
  createCompletenessScorer,
} from "@mastra/evals/scorers/prebuilt";
import { supervisorAgent } from "../mastra/agents/supervisorAgent";

// Add real test cases here
const testData: Array<{ input: string; groundTruth?: string }> = [
  // {
  //   input: "Update the CS101 assignment due date",
  //   groundTruth: "entities: course=CS101, action=update, field=due_date",
  // },
];

const answerSimilarityScorer = createAnswerSimilarityScorer({
  model: anthropic("claude-haiku-4-5-20251001"),
  options: { semanticThreshold: 0.7 },
});

// Code-based completeness check (no LLM required)
const completenessScorer = createCompletenessScorer();

export async function runEntityClarificationEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }
  return runEvals({
    data: testData,
    target: supervisorAgent,
    scorers: {
      agent: [answerSimilarityScorer, completenessScorer],
    },
    onItemComplete: ({ item, scorerResults }) => {
      console.log("  item input:", item.input);
      console.log("  scores:", scorerResults);
    },
  });
}
