/**
 * Supervisor Domain Clarification Eval
 *
 * Evaluates whether the supervisor agent correctly sets `needsDomainClarification: true`
 * when a message is too vague to route or spans two or more domains.
 *
 * The supervisor must NOT set this flag when a single primary intent is clear —
 * so this eval also covers the negative case (flag stays false for clear single-domain
 * messages that mention a second domain in passing).
 *
 * Scorer:
 *   - clarificationScorer (custom): extracts `needsDomainClarification` from the
 *     agent's JSON and compares it to groundTruth ("true" or "false").
 *
 * Run: npm run eval (from mastra/)
 */

import { runEvals } from "@mastra/core/evals";
import {
  createJsonFieldScorer,
  makeOnItemComplete,
  printAgentSummary,
  type ItemSummary,
} from "./eval-utils";
import { supervisorAgent } from "../mastra/agents/supervisorAgent";

const clarificationScorer = createJsonFieldScorer("needsDomainClarification");

// ---------------------------------------------------------------------------
// Should trigger clarification (needsDomainClarification = true)
// ---------------------------------------------------------------------------

const shouldClarifyData: Array<{ input: string; groundTruth: string }> = [
  {
    // Completely off-topic — no route can be inferred
    input: "Hi",
    groundTruth: "true",
  },
  {
    // Random noise — too vague for any route
    input: "idk",
    groundTruth: "true",
  },
  {
    // Generic help with no specific domain — can't pick a route
    input: "What can you help me with?",
    groundTruth: "true",
  },
  {
    // Generic help synonym
    input: "help",
    groundTruth: "true",
  },
  {
    // Two equal-weight domains: tasks AND preferences — can't pick one primary intent
    input: "I want to create a task for my essay and also change my focus block length",
    groundTruth: "true",
  },
  {
    // tasks + schedule with equal weight: "add AND schedule"
    input: "Can you add a new assignment for CHEM and schedule it at the same time?",
    groundTruth: "true",
  },
  {
    // classes + feedback with equal weight: "add AND talk about"
    input: "I want to add Linear Algebra and also discuss how Organic Chemistry went",
    groundTruth: "true",
  },
  {
    // tasks + preferences, both explicit verbs
    input: "Update my essay due date and set my preferred study days to Tuesday",
    groundTruth: "true",
  },
  {
    // App-meta question with no actionable domain
    input: "Who made you?",
    groundTruth: "true",
  },
  {
    // Vague complaint — no domain intent at all
    input: "I have so much to do and I don't know where to start",
    groundTruth: "true",
  },
];

// ---------------------------------------------------------------------------
// Should NOT trigger clarification (needsDomainClarification = false)
// These messages mention a second topic in passing but have one clear primary intent.
// ---------------------------------------------------------------------------

const shouldNotClarifyData: Array<{ input: string; groundTruth: string }> = [
  {
    // Primary intent is tasks; "schedule" is just context
    input: "Add a CHEM Essay task — I'll schedule it later",
    groundTruth: "false",
  },
  {
    // Primary intent is schedule; "task" is just the noun
    input: "Schedule my CHEM Essay task for this week",
    groundTruth: "false",
  },
  {
    // Primary intent is classes; mention of "hard" is incidental, not feedback intent
    input: "Add Organic Chemistry — I hear it's a tough course",
    groundTruth: "false",
  },
  {
    // Primary intent is feedback; "task" is the subject, not a CRUD request
    input: "That CS task was really hard — I want to talk about how it went",
    groundTruth: "false",
  },
  {
    // Primary intent is preferences; the phrase "I also have tasks" is context
    input: "Change my focus block to 30 minutes — I have a lot of tasks coming up",
    groundTruth: "false",
  },
  {
    // Can-I question with a single clear domain — no clarification needed
    input: "Can I create a task from here?",
    groundTruth: "false",
  },
  {
    // How-to question for a single domain
    input: "How do I add a new class?",
    groundTruth: "false",
  },
];

// ---------------------------------------------------------------------------
// Eval runner
// ---------------------------------------------------------------------------

export async function runSupervisorClarificationEval() {
  const hasAny = shouldClarifyData.length > 0 || shouldNotClarifyData.length > 0;

  if (!hasAny) {
    console.log("  (no test cases — add items to testData arrays to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }

  let totalItems = 0;
  const allScores: Record<string, unknown> = {};

  const runGroup = async (label: string, data: Array<{ input: string; groundTruth: string }>) => {
    if (data.length === 0) return;
    console.log(`  [${label}]`);
    const acc: ItemSummary[] = [];
    const r = await runEvals({
      data,
      target: supervisorAgent,
      scorers: [clarificationScorer],
      onItemComplete: makeOnItemComplete(
        "needsDomainClarification",
        "needsDomainClarification-scorer",
        acc
      ),
    });
    printAgentSummary(label, acc);
    totalItems += r.summary.totalItems;
    allScores[label] = r.scores;
  };

  await runGroup("should-clarify", shouldClarifyData);
  await runGroup("should-not-clarify", shouldNotClarifyData);

  return { scores: allScores, summary: { totalItems } };
}
