/**
 * Time Estimate Range Eval
 *
 * Evaluates whether the estimation agent produces time estimates that fall
 * within an expected min/max range. Uses a custom deterministic scorer
 * since built-in scorers don't support numeric range validation.
 *
 * Scorers:
 *   - timeEstimateRangeScorer (custom): parses estimatedMinutes from the
 *     agent's JSON output and checks it falls within [minMinutes, maxMinutes]
 *
 * Run: npm run eval (from mastra/)
 */

import { createScorer, runEvals } from "@mastra/core/evals";
import type { ScorerRunOutputForAgent } from "@mastra/core/evals";
import { estimationAgent } from "../mastra/agents/estimationAgent";
import { extractJsonFieldFromOutput } from "./eval-utils";

type GroundTruth = { minMinutes: number; maxMinutes: number };

// Parses estimatedMinutes from the agent's JSON output.
// The estimationAgent always returns { estimatedMinutes: number, reasoningTrace: {...} }.
function extractMinutesFromOutput(output: ScorerRunOutputForAgent): number | null {
  const raw = extractJsonFieldFromOutput(output, "estimatedMinutes");
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// Custom scorer: checks that the parsed estimate falls within the expected minute range
const timeEstimateRangeScorer = createScorer({
  id: "time-estimate-range-scorer",
  description:
    "Checks that the agent's estimatedMinutes falls within the expected [minMinutes, maxMinutes] range",
})
  .analyze(({ run }) => {
    const groundTruth = run.groundTruth as GroundTruth | undefined;
    if (!groundTruth) return { score: 0 };

    const estimated = extractMinutesFromOutput(run.output as ScorerRunOutputForAgent);
    if (estimated === null) return { score: 0 };

    const inRange = estimated >= groundTruth.minMinutes && estimated <= groundTruth.maxMinutes;
    return { score: inRange ? 1 : 0, estimated, groundTruth };
  })
  .generateScore(({ results }) => {
    return (results.analyzeStepResult as { score: number }).score;
  });

const testData: Array<{ input: string; groundTruth: GroundTruth }> = [];

export async function runTimeEstimateRangeEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }
  return runEvals({
    data: testData,
    target: estimationAgent,
    scorers: [timeEstimateRangeScorer],
    onItemComplete: ({ item, scorerResults }) => {
      console.log("  item input:", item.input);
      console.log("  scores:", scorerResults);
    },
  });
}
