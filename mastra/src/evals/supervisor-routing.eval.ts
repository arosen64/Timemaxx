/**
 * Supervisor Routing Eval
 *
 * Evaluates whether the supervisor agent routes user messages to the correct
 * downstream agent and follows the expected routing path.
 *
 * Scorers:
 *   - createTrajectoryAccuracyScorerCode: verifies the routing path (which agent was invoked)
 *   - createToolCallAccuracyScorerCode: verifies any tool handoffs made during routing
 *
 * HOW TO IMPLEMENT:
 * 1. Add items to `testData`. Each item should have an `input` (user message)
 *    and an `expectedTrajectory` describing which agent(s) should be called.
 * 2. In `expectedTrajectory.steps`, use `stepType: "agent_run"` to match agent
 *    handoffs, or `stepType: "tool_call"` to match tool calls.
 * 3. Run: npm run eval (from mastra/)
 *
 * Example:
 *   {
 *     input: "Add a new task: finish homework by Friday",
 *     expectedTrajectory: {
 *       steps: [{ name: "task-agent", stepType: "agent_run" as const }],
 *       ordering: "relaxed" as const,
 *     },
 *   }
 */

import { runEvals } from "@mastra/core/evals";
import {
  createTrajectoryAccuracyScorerCode,
  createToolCallAccuracyScorerCode,
} from "@mastra/evals/scorers/prebuilt";
import { supervisorAgent } from "../mastra/agents/supervisorAgent";

// Add real test cases here
const testData: Array<{ input: string; expectedTrajectory?: unknown }> = [
  // {
  //   input: "Add a new task: finish homework by Friday",
  //   expectedTrajectory: {
  //     steps: [{ name: "task-agent", stepType: "agent_run" as const }],
  //     ordering: "relaxed" as const,
  //   },
  // },
];

const trajectoryScorer = createTrajectoryAccuracyScorerCode({
  comparisonOptions: { ordering: "relaxed" },
});

const toolCallAccuracyScorer = createToolCallAccuracyScorerCode({
  expectedToolOrder: [], // replace with the expected ordered tool call sequence
  strictMode: false,
});

export async function runSupervisorRoutingEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }
  return runEvals({
    data: testData,
    target: supervisorAgent,
    scorers: {
      agent: [toolCallAccuracyScorer],
      trajectory: [trajectoryScorer],
    },
    onItemComplete: ({ item, scorerResults }) => {
      console.log("  item input:", item.input);
      console.log("  scores:", scorerResults);
    },
  });
}
