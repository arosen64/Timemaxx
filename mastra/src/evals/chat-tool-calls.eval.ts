/**
 * Chat Tool Calls Eval
 *
 * Evaluates whether the supervisor agent selects the correct tool
 * and follows the expected call sequence when answering user queries.
 *
 * Scorers:
 *   - createToolCallAccuracyScorerCode: checks whether the expected tool was called
 *   - createTrajectoryAccuracyScorerCode: checks the full sequence of tool calls
 *
 * HOW TO IMPLEMENT:
 * 1. Add items to `testData` — each item is one test case:
 *      { input: "user message", expectedTrajectory: { steps: [...] } }
 * 2. Set `expectedTool` in the tool call scorer to the tool name you expect.
 * 3. Set `expectedTrajectory.steps` to the ordered tool-call sequence you expect.
 * 4. Run: npm run eval (from mastra/)
 *
 * Example:
 *   {
 *     input: "What tasks do I have due tomorrow?",
 *     expectedTrajectory: {
 *       steps: [{ name: "getTasks", stepType: "tool_call" as const }],
 *       ordering: "relaxed" as const,
 *     },
 *   }
 */

import { runEvals } from "@mastra/core/evals";
import {
  createToolCallAccuracyScorerCode,
  createTrajectoryAccuracyScorerCode,
} from "@mastra/evals/scorers/prebuilt";
import { supervisorAgent } from "../mastra/agents/supervisorAgent";

// Add real test cases here
const testData: Array<{ input: string; expectedTrajectory?: any }> = [
  // {
  //   input: "What tasks do I have due tomorrow?",
  //   expectedTrajectory: {
  //     steps: [{ name: "getTasks", stepType: "tool_call" as const }],
  //     ordering: "relaxed" as const,
  //   },
  // },
];

const toolCallAccuracyScorer = createToolCallAccuracyScorerCode({
  expectedTool: "getTasks", // replace with the tool name you expect to be called
  strictMode: false,
});

const trajectoryScorer = createTrajectoryAccuracyScorerCode({
  comparisonOptions: { ordering: "relaxed", allowRepeatedSteps: true },
});

export async function runChatToolCallsEval() {
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
