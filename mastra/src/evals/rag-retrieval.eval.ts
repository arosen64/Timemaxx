/**
 * RAG Retrieval Eval
 *
 * Evaluates the quality of the agent's retrieval-augmented responses:
 * whether retrieved context is relevant, whether the response is grounded
 * in that context, and whether the agent fabricates information.
 *
 * Scorers:
 *   - createContextRelevanceScorerLLM: are the retrieved chunks relevant to the query?
 *   - createFaithfulnessScorer: is the response grounded in the retrieved context?
 *   - createHallucinationScorer: does the response contain fabricated claims?
 *   - createContextPrecisionScorer: are the high-relevance chunks ranked first?
 *
 * HOW TO IMPLEMENT:
 * 1. Set ANTHROPIC_API_KEY in mastra/.env (required for all LLM judge scorers).
 * 2. Identify which agent performs RAG (e.g., taskAgent with memory retrieval).
 *    Replace `taskAgent` in the `runEvals` call below with the correct agent.
 * 3. Add items to `testData`:
 *      { input: "...", groundTruth: "expected factual answer" }
 * 4. Supply context chunks in the scorer options if they are known at test time,
 *    or implement a `contextExtractor` to pull them from the agent's output.
 * 5. Run: npm run eval (from mastra/)
 *
 * Example:
 *   {
 *     input: "What did the syllabus say about the midterm format?",
 *     groundTruth: "The midterm is closed-book, 60 minutes, multiple choice.",
 *   }
 */

import { anthropic } from "@ai-sdk/anthropic";
import { runEvals } from "@mastra/core/evals";
import {
  createContextRelevanceScorerLLM,
  createFaithfulnessScorer,
  createHallucinationScorer,
  createContextPrecisionScorer,
} from "@mastra/evals/scorers/prebuilt";
import { taskAgent } from "../mastra/agents/taskAgent";

// Add real test cases here
const testData: Array<{ input: string; groundTruth?: string }> = [
  // {
  //   input: "What did the syllabus say about the midterm format?",
  //   groundTruth: "The midterm is closed-book, 60 minutes, multiple choice.",
  // },
];

const judgeModel = anthropic("claude-haiku-4-5-20251001");

// Checks whether retrieved context chunks are relevant to the query
const contextRelevanceScorer = createContextRelevanceScorerLLM({
  model: judgeModel,
  options: {
    // Implement this to extract retrieved chunks from the agent run at eval time.
    // Return an array of context strings that the agent used to answer.
    contextExtractor: (_input, _output) => [],
  },
});

// Checks whether agent claims are grounded in the retrieved context
const faithfulnessScorer = createFaithfulnessScorer({ model: judgeModel });

// Checks whether the response contains fabricated facts not in context
const hallucinationScorer = createHallucinationScorer({ model: judgeModel });

// Checks whether high-relevance chunks are ranked before low-relevance ones
const contextPrecisionScorer = createContextPrecisionScorer({
  model: judgeModel,
  options: {
    contextExtractor: (_input, _output) => [],
  },
});

export async function runRagRetrievalEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }
  return runEvals({
    data: testData,
    target: taskAgent, // replace with the agent that performs RAG
    scorers: {
      agent: [
        contextRelevanceScorer,
        faithfulnessScorer,
        hallucinationScorer,
        contextPrecisionScorer,
      ],
    },
    onItemComplete: ({ item, scorerResults }) => {
      console.log("  item input:", item.input);
      console.log("  scores:", scorerResults);
    },
  });
}
