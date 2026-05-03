/**
 * RAG Retrieval Eval
 *
 * Tests the same path production uses for chat-backed RAG in time estimates:
 * Convex `fetchRelevantContext` → `buildChatContext` (chatChunks excerpts) →
 * `buildTimeEstimatePrompt` (`<chat_history>`) → Mastra `estimationAgent`.
 *
 * Each case passes a full `contextPrompt` as the agent `input` (mirroring
 * `estimationWorkflow`). Scorers treat the `<chat_history>` body as the
 * retrieved RAG context (split into chunk strings matching production bullets).
 *
 * Scorers:
 *   - createContextRelevanceScorerLLM + createContextPrecisionScorer: chat RAG chunk quality vs full agent output (Haiku)
 *   - chatsTraceLlmGroundingScorer: Mastra {@link Agent} + structured output — **only** `reasoningTrace.chats` vs **chat RAG excerpts**
 *   - chatTraceKeywordGroundingScorer: deterministic phrase overlap (cheap regression check)
 *
 * Speed (this eval is heavy: 1× estimation Sonnet + several judge calls per case):
 *   - Cases run in parallel (`concurrency`).
 *   - `RAG_EVAL_FAST=1` — only the estimation agent + keyword scorer (no LLM judges).
 *   - `RAG_EVAL_SKIP_CHATS_LLM_GROUNDING=1` — drop chats-only LLM grounding (keeps relevance/precision/keywords).
 *
 * LLM judges use Haiku (cheap). If judge JSON validation fails, switch judgeModel to Sonnet below.
 *
 * Prerequisites: ANTHROPIC_API_KEY in mastra/.env or mastra/.env.local (see evals/loadEnv.ts).
 *
 * Run: cd mastra && npm run eval
 */

import "./loadEnv";
import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { createScorer, runEvals } from "@mastra/core/evals";
import type { ScorerRunOutputForAgent } from "@mastra/core/evals";
import { z } from "zod";
import {
  createContextPrecisionScorer,
  createContextRelevanceScorerLLM,
} from "@mastra/evals/scorers/prebuilt";
import {
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
} from "@mastra/evals/scorers/utils";
import { buildTimeEstimatePrompt } from "../../../backend/convex/lib/prompts/estimateTaskTime.prompt";
import { estimationAgent } from "../mastra/agents/estimationAgent";
import { estimationAgentOutputSchema } from "../mastra/lib/prompts/estimationAgent.prompt";

/** Same shape as `backend/convex/ai/estimateTaskTime.ts` `buildChatContext` output. */
function formatChatContextAsInProduction(excerptLines: string[]): string {
  const lines = excerptLines.map(
    (excerpt, i) =>
      `- (2026-03-${String(10 + i).padStart(2, "0")}T14:00:00.000Z) ${excerpt}`
  );
  return `Relevant chat history (excerpts from prior conversations):\n${lines.join("\n")}`;
}

/**
 * Extracts per-chunk strings from the assembled estimation prompt (inside `<chat_history>`).
 * Matches production formatting from `buildChatContext`: bullets `- (ISO date) excerpt`.
 */
export function extractChatRagChunksFromEstimationPrompt(fullPrompt: string): string[] {
  const m = fullPrompt.match(/<chat_history>\s*([\s\S]*?)\s*<\/chat_history>/i);
  if (!m) return [];
  let body = m[1].trim();
  body = body.replace(/^Relevant chat history[^\n]*\n/, "");
  const segments = body.split(/\n(?=-\s+\()/);
  return segments
    .map((s) => s.replace(/^-\s+/, "").trim())
    .filter((s) => s.length > 0);
}

/** Chat RAG bullet lines only — for context relevance / precision (retrieval quality). */
function chatRagChunksFromRunInput(input: unknown, _output?: unknown): string[] {
  void _output;
  const userText = getUserMessageFromRunInput(input) ?? "";
  return extractChatRagChunksFromEstimationPrompt(userText);
}

function parseEstimationJson(output: ScorerRunOutputForAgent): {
  reasoningTrace?: { chats?: string };
} | null {
  const text = getAssistantMessageFromRunOutput(output);
  if (!text) return null;
  try {
    return JSON.parse(text) as { reasoningTrace?: { chats?: string } };
  } catch {
    return null;
  }
}

/** Substrings that appear in the injected chat RAG and must show up in reasoningTrace.chats. */
type RagEvalGroundTruth = {
  chatsMustReference: string[];
};

const testData: Array<{
  input: string;
  groundTruth: RagEvalGroundTruth;
}> = [
  {
    input: buildTimeEstimatePrompt({
      title: "Problem set 6 — induction",
      taskType: "homework",
      description: "Ten proofs using strong induction; deadline Friday.",
      courseInfo: "CS 230 — Discrete Mathematics (Spring 2026)",
      chatContext: formatChatContextAsInProduction([
        "User said they spent about 4 hours last week on similar induction homework for this class.",
      ]),
      profileContext: "Year: sophomore.",
    }),
    groundTruth: {
      chatsMustReference: ["4 hour", "induction"],
    },
  },
  {
    input: buildTimeEstimatePrompt({
      title: "Physics lab report — optics bench",
      taskType: "lab",
      description: "Write up methods, error analysis, and attach raw sensor plots.",
      courseInfo: "PHYS 171 — Lab (Spring 2026)",
      courseContext:
        "Enrolled courses (most relevant to this task):\n- Code: PHYS.171 | Title: Intro Lab | Term: Spring 2026",
      chatContext: formatChatContextAsInProduction([
        "TA announced in chat that lab write-ups are capped at 10 pages double-spaced this term.",
        "Reminder: graph fonts must be readable; many students lost points for tiny axis labels last round.",
      ]),
    }),
    groundTruth: {
      // Hyphen/spacing variants (“10-page” vs “10 page”); “font” appears in graph-font reminder chunk.
      chatsMustReference: ["10 page", "font"],
    },
  },
  {
    input: buildTimeEstimatePrompt({
      title: "Mock exam practice",
      taskType: "exam prep",
      description: "Timed multiple-choice practice for the upcoming midterm.",
      courseInfo: "ECON 101 — Principles (Spring 2026)",
      chatContext: formatChatContextAsInProduction([
        "Off-topic: dining hall hours changed on Sundays.",
        "Student asked whether the midterm is closed-book; instructor replied yes, closed-book and 90 minutes in class.",
      ]),
    }),
    groundTruth: {
      chatsMustReference: ["closed-book", "90 minute"],
    },
  },
];

/** Judges only — Haiku is much faster than Sonnet; swap to claude-sonnet-4-6 if JSON validation errors appear. */
const judgeModel = anthropic("claude-haiku-4-5-20251001");

/** Mastra {@link Agent} for chats-trace grounding only — mirrors app agents (no direct `ai` SDK generate calls). */
const chatsGroundingJudgeAgent = new Agent({
  id: "rag-chats-grounding-judge",
  name: "RAG chats grounding judge",
  instructions:
    "You evaluate whether an assistant's reasoningTrace.chats text is grounded only in the chat excerpts given in the user message. Respond using the required structured output schema.",
  model: judgeModel,
});

const contextRelevanceScorer = createContextRelevanceScorerLLM({
  model: judgeModel,
  options: {
    contextExtractor: (input, output) => chatRagChunksFromRunInput(input, output),
    // Judge “missing context” lists are unhelpful for synthetic eval cases; don’t zero the score.
    penalties: {
      missingContextPerItem: 0,
      maxMissingContextPenalty: 0,
    },
  },
});

const contextPrecisionScorer = createContextPrecisionScorer({
  model: judgeModel,
  options: {
    contextExtractor: (input, output) => chatRagChunksFromRunInput(input, output),
  },
});

const chatsTraceGroundingJudgeSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("1.0 = chats trace fully supported by excerpts; 0 = major fabrication vs excerpts"),
  rationale: z.string().max(600).describe("One short paragraph"),
});

const CHATS_GROUNDING_JUDGE_PROMPT = (excerptBlock: string, chatsTrace: string) => `You grade whether the assistant's **chats** reasoning is grounded **only** in the chat excerpts below.

## Chat excerpts (retrieved RAG — sole source of truth for this score)
${excerptBlock}

## reasoningTrace.chats (evaluate ONLY this text)
${chatsTrace}

Rules:
- Score **1.0** if every substantive factual claim in the chats text is supported by or clearly paraphrases the excerpts. Reasonable arithmetic combining stated facts (e.g. "90 min" + buffer) is OK if it does not invent new facts.
- Score **lower** if the chats text asserts facts **not** in the excerpts, or **contradicts** them.
- If some excerpts are off-topic noise, **ignoring** them is fine; do not penalize unless the chats text **invents** content.
- Do **not** use task title, course, or profile — those are out of scope; judge **only** excerpt grounding.

Return score between 0 and 1.`;

/** Extract a single JSON object from model text (handles ```json fences and trailing junk). */
function parseJsonObjectFromText(text: string): unknown {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fence ? fence[1] : t).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model output");
  }
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

async function judgeChatsTraceGrounding(
  excerptBlock: string,
  chatsTrace: string
): Promise<{ score: number; rationale: string }> {
  const basePrompt = CHATS_GROUNDING_JUDGE_PROMPT(excerptBlock, chatsTrace);
  const providerOptions = { anthropic: { structuredOutputMode: "auto" as const } };
  // Zod v3 schema; Mastra public API expects PublicSchema (cast matches estimation agent / runEvals).
  const schema = chatsTraceGroundingJudgeSchema as any;

  try {
    const out = await chatsGroundingJudgeAgent.generate(basePrompt, {
      maxSteps: 1,
      structuredOutput: {
        schema,
        providerOptions,
      },
    });
    const obj = out.object;
    if (obj && typeof obj.score === "number" && typeof obj.rationale === "string") {
      return { score: obj.score, rationale: obj.rationale };
    }
    throw new Error(out.error?.message ?? "Judge agent returned no structured object");
  } catch (e1) {
    const first = e1 instanceof Error ? e1.message : String(e1);
    try {
      const out2 = await chatsGroundingJudgeAgent.generate(
        `${basePrompt}

Output **only** a compact JSON object (no markdown, no prose) with this exact shape:
{"score": <number 0-1>, "rationale": "<one short paragraph>"}`,
        {
          maxSteps: 1,
          providerOptions,
          modelSettings: { maxOutputTokens: 800 },
        }
      );
      const raw = parseJsonObjectFromText(out2.text);
      const parsed = chatsTraceGroundingJudgeSchema.safeParse(raw);
      if (parsed.success) {
        return {
          score: parsed.data.score,
          rationale: `${parsed.data.rationale} (json fallback; primary: ${first})`,
        };
      }
      return {
        score: 0,
        rationale: `Judge error: ${first}; JSON fallback invalid: ${parsed.error.message}; raw: ${out2.text.slice(0, 200)}`,
      };
    } catch (e2) {
      const second = e2 instanceof Error ? e2.message : String(e2);
      return { score: 0, rationale: `Judge error: ${first}; fallback: ${second}` };
    }
  }
}

/**
 * LLM judge scoped to RAG: compares **only** `reasoningTrace.chats` to the retrieved chat excerpt
 * strings (same bullets production passes via `<chat_history>`). Ignores task_details / courses / profile.
 * Higher score = better grounding in chat excerpts.
 */
const chatsTraceLlmGroundingScorer = createScorer({
  id: "rag-chats-trace-llm-grounding-scorer",
  description:
    "LLM: reasoningTrace.chats grounded in chat RAG excerpts only (not whole prompt)",
}).analyze(async ({ run }) => {
  const ragChunks = chatRagChunksFromRunInput(run.input);
  const parsed = parseEstimationJson(run.output as ScorerRunOutputForAgent);
  const chatsTrace = parsed?.reasoningTrace?.chats?.trim() ?? "";

  if (ragChunks.length === 0) {
    return { score: 1, rationale: "No chat excerpts in prompt — nothing to ground." };
  }
  if (!chatsTrace) {
    return {
      score: 0,
      rationale: "reasoningTrace.chats is empty but chat excerpts were provided.",
    };
  }

  const excerptBlock = ragChunks.map((c, i) => `[${i}] ${c}`).join("\n\n");
  return judgeChatsTraceGrounding(excerptBlock, chatsTrace);
}).generateScore(({ results }) => {
  const a = results.analyzeStepResult as { score?: number } | undefined;
  const s = a?.score;
  return typeof s === "number" && !Number.isNaN(s) ? s : 0;
});

/** Normalize so "10-page", "10 page", and extra spaces match. */
function normalizeForPhraseMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Code scorer: each ground-truth phrase must appear in RAG text and in reasoningTrace.chats. */
const chatTraceKeywordGroundingScorer = createScorer({
  id: "rag-chat-trace-keywords-scorer",
  description:
    "Fraction of required phrases present in both retrieved chat excerpts and reasoningTrace.chats",
}).analyze(({ run }) => {
  const gt = run.groundTruth as RagEvalGroundTruth | undefined;
  const phrases = gt?.chatsMustReference ?? [];
  const ragChunks = chatRagChunksFromRunInput(run.input);
  const chunkBlob = normalizeForPhraseMatch(ragChunks.join(" "));
  const parsed = parseEstimationJson(run.output as ScorerRunOutputForAgent);
  const chatsTrace = normalizeForPhraseMatch(parsed?.reasoningTrace?.chats ?? "");

  if (phrases.length === 0) {
    return { score: 1 };
  }

  let hits = 0;
  for (const p of phrases) {
    const needle = normalizeForPhraseMatch(p);
    if (needle.length === 0) continue;
    if (chunkBlob.includes(needle) && chatsTrace.includes(needle)) {
      hits++;
    }
  }

  return { score: hits / phrases.length };
}).generateScore(({ results }) => (results.analyzeStepResult as { score: number }).score);

function buildRagEvalAgentScorers() {
  const fast = process.env.RAG_EVAL_FAST === "1";
  const skipChatsLlm = process.env.RAG_EVAL_SKIP_CHATS_LLM_GROUNDING === "1";

  if (fast) {
    return [chatTraceKeywordGroundingScorer];
  }

  const out: any[] = [
    contextRelevanceScorer,
    contextPrecisionScorer,
    chatTraceKeywordGroundingScorer,
  ];
  if (!skipChatsLlm) {
    out.push(chatsTraceLlmGroundingScorer);
  }
  return out;
}

export async function runRagRetrievalEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }
  if (process.env.RAG_EVAL_FAST === "1") {
    console.log("  RAG_EVAL_FAST=1 — skipping LLM judge scorers (relevance / precision / chats grounding)");
  } else {
    if (process.env.RAG_EVAL_SKIP_CHATS_LLM_GROUNDING === "1") {
      console.log("  RAG_EVAL_SKIP_CHATS_LLM_GROUNDING=1 — skipping chats-only LLM grounding scorer");
    }
  }

  return runEvals({
    data: testData,
    target: estimationAgent,
    targetOptions: {
      // Zod v3 schema from agent prompt; Mastra runEvals types expect StandardSchema.
      structuredOutput: { schema: estimationAgentOutputSchema as any },
    },
    concurrency: Math.min(4, testData.length),
    scorers: {
      agent: buildRagEvalAgentScorers(),
    },
    onItemComplete: ({ item, scorerResults }) => {
      const preview =
        item.input.length > 220 ? `${item.input.slice(0, 220)}…` : item.input;
      console.log("  item input:", preview);
      console.log("  scores:", scorerResults);
    },
  });
}
