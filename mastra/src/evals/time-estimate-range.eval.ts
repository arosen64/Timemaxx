/**
 * Time Estimate Range Eval
 *
 * Evaluates whether the estimation agent produces time estimates that fall
 * within an expected min/max range. Uses a custom deterministic scorer
 * since built-in scorers don't support numeric range validation.
 *
 * Scorers:
 *   - timeEstimateRangeScorer (custom): parses the numeric estimate from
 *     agent output and checks it falls within [minHours, maxHours]
 *
 * HOW TO IMPLEMENT:
 * 1. Add items to `testData`. Each item needs:
 *      - `input`: the task description to estimate
 *      - `groundTruth`: { minHours: number, maxHours: number }
 * 2. Implement the output parser in `extractHoursFromOutput` to match
 *    the actual format your estimationAgent returns.
 * 3. Run: npm run eval (from mastra/)
 *
 * Example:
 *   {
 *     input: "Write a 5-page essay on climate change",
 *     groundTruth: { minHours: 2, maxHours: 6 },
 *   }
 */

import { createScorer, runEvals } from "@mastra/core/evals";
import type { ScorerRunOutputForAgent } from "@mastra/core/evals";
import { estimationAgent } from "../mastra/agents/estimationAgent";

// Parses the estimated hours from agent output text.
// Update this to match the actual output format of estimationAgent.
function extractHoursFromOutput(output: ScorerRunOutputForAgent): number | null {
  type Msg = { role: string; content: unknown };
  const text = Array.isArray(output)
    ? (output as Msg[])
        .filter((m) => m.role === "assistant")
        .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join(" ")
    : String(output);

  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  return match ? parseFloat(match[1]) : null;
}

// Custom scorer: checks that the parsed estimate falls within the expected range
const timeEstimateRangeScorer = createScorer({
  id: "time-estimate-range-scorer",
  description: "Checks that the agent's time estimate falls within the expected min/max hour range",
})
  .analyze(({ run }) => {
    const groundTruth = run.groundTruth as { minHours: number; maxHours: number } | undefined;
    if (!groundTruth) return { score: 0 };

    const estimated = extractHoursFromOutput(run.output as ScorerRunOutputForAgent);
    if (estimated === null) return { score: 0 };

    const inRange = estimated >= groundTruth.minHours && estimated <= groundTruth.maxHours;
    return { score: inRange ? 1 : 0 };
  })
  .generateScore(({ results }) => {
    return (results.analyzeStepResult as { score: number }).score;
  });

// Add real test cases here
const testData: Array<{ input: string; groundTruth: { minHours: number; maxHours: number } }> = [
  // {
  //   input: "Write a 5-page essay on climate change",
  //   groundTruth: { minHours: 2, maxHours: 6 },
  // },
];

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
