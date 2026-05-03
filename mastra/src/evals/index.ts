import { runChatToolCallsEval } from "./chat-tool-calls.eval";
import { runSupervisorRoutingEval } from "./supervisor-routing.eval";
import { runEntityClarificationEval } from "./entity-clarification.eval";
import { runTimeEstimateRangeEval } from "./time-estimate-range.eval";
import { runRagRetrievalEval } from "./rag-retrieval.eval";
import { runAcademicProfileEval } from "./academic-profile.eval";
import { runSchedulingEval } from "./scheduling.eval";

const evals = [
  { name: "chat-tool-calls", run: runChatToolCallsEval },
  { name: "supervisor-routing", run: runSupervisorRoutingEval },
  {
    name: "entity-clarification",
    run: runEntityClarificationEval,
  },
  { name: "time-estimate-range", run: runTimeEstimateRangeEval },
  { name: "rag-retrieval", run: runRagRetrievalEval },
  { name: "academic-profile", run: runAcademicProfileEval },
  { name: "scheduling", run: runSchedulingEval },
];

async function main() {
  console.log("=== TimeMaxx Mastra Eval Suite ===\n");

  for (const { name, run } of evals) {
    console.log(`\n--- Running: ${name} ---`);
    const result = await run();
    console.log(
      `  Summary: ${result.summary.totalItems} item(s) evaluated, scores:`,
      JSON.stringify(result.scores, null, 2)
    );
  }

  console.log("\n=== All evals complete ===");
}

main().catch(console.error);
