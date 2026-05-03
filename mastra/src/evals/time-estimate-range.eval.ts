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

const testData: Array<{ input: string; groundTruth: GroundTruth }> = [
  {
    // Short reading: ~25 pages with notes → 45–120 min
    input: `Estimate the study time in minutes for this task. Use all available context to produce an accurate estimate, then provide a reasoning trace for each context category.

<task_details>
Title: Read Chapter 3 and Take Notes
Type: reading
Description: Read Chapter 3 of "Introduction to Algorithms" (approximately 25 pages) and take structured notes on sorting algorithms.
Course: CS 600: Algorithms (Spring 2026)
</task_details>`,
    groundTruth: { minMinutes: 45, maxMinutes: 120 },
  },
  {
    // Medium problem set: 10 calculus problems → 60–180 min
    input: `Estimate the study time in minutes for this task. Use all available context to produce an accurate estimate, then provide a reasoning trace for each context category.

<task_details>
Title: Calculus Problem Set 4
Type: assignment
Description: Complete 10 integration problems covering u-substitution and integration by parts from Problem Set 4.
Course: MATH 201: Calculus II (Spring 2026)
</task_details>`,
    groundTruth: { minMinutes: 60, maxMinutes: 180 },
  },
  {
    // Lab report: methods, results, and discussion → 90–240 min
    input: `Estimate the study time in minutes for this task. Use all available context to produce an accurate estimate, then provide a reasoning trace for each context category.

<task_details>
Title: Chemistry Lab Report — Titration
Type: writing
Description: Write a formal lab report for the acid-base titration experiment, including an introduction, methods section, results with data tables, and a 2-paragraph discussion.
Course: CHEM 110: General Chemistry I (Spring 2026)
</task_details>`,
    groundTruth: { minMinutes: 90, maxMinutes: 240 },
  },
  {
    // Coding assignment: BST in Java → 90–240 min
    input: `Estimate the study time in minutes for this task. Use all available context to produce an accurate estimate, then provide a reasoning trace for each context category.

<task_details>
Title: Implement Binary Search Tree
Type: programming
Description: Implement a binary search tree in Java with insert, delete, search, and in-order traversal methods. Include unit tests for each method.
Course: CS 226: Data Structures (Spring 2026)
</task_details>`,
    groundTruth: { minMinutes: 90, maxMinutes: 240 },
  },
  {
    // Research paper: 10 pages → 240–600 min
    input: `Estimate the study time in minutes for this task. Use all available context to produce an accurate estimate, then provide a reasoning trace for each context category.

<task_details>
Title: Research Paper — Effects of Social Media on Academic Performance
Type: writing
Description: Write a 10-page research paper with a thesis, literature review, analysis of at least 6 peer-reviewed sources, and a conclusion. Proper citation format required.
Course: WRIT 300: Advanced Academic Writing (Spring 2026)
</task_details>`,
    groundTruth: { minMinutes: 240, maxMinutes: 600 },
  },
];

const SCORER_ID = "time-estimate-range-scorer";

type ScorerResult = { score?: number; analyzeStepResult?: { estimated?: number; groundTruth?: GroundTruth } };

export async function runTimeEstimateRangeEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }

  const results: { passed: boolean; estimated: number | null; range: GroundTruth }[] = [];

  const evalResult = await runEvals({
    data: testData,
    target: estimationAgent,
    scorers: [timeEstimateRangeScorer],
    onItemComplete: ({ item, scorerResults }) => {
      const result = scorerResults[SCORER_ID] as ScorerResult | undefined;
      const passed = (result?.score ?? 0) === 1;
      const estimated = result?.analyzeStepResult?.estimated ?? null;
      const range = item.groundTruth as GroundTruth;

      results.push({ passed, estimated, range });

      const inputStr = typeof item.input === "string" ? item.input : JSON.stringify(item.input);
      const title = inputStr.match(/Title: (.+)/)?.[1] ?? inputStr.slice(0, 50);
      if (passed) {
        console.log(`    ✓  "${title}" — ${estimated} min in [${range.minMinutes}, ${range.maxMinutes}]  PASS`);
      } else {
        console.log(
          `    ✗  "${title}" — got ${estimated ?? "(none)"} min, expected [${range.minMinutes}, ${range.maxMinutes}]  FAIL`
        );
      }
    },
  });

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  console.log(`  time-estimate-range: ${passed}/${total} passed (${pct}%)`);

  return evalResult;
}
