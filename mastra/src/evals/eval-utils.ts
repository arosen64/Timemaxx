/**
 * Shared eval utilities for structured-output agent scorers.
 *
 * These helpers are used by eval files that test agents that return a single
 * JSON object (no Mastra tool calls) and need to verify a named field in that
 * output against a groundTruth string.
 */

import { createScorer } from "@mastra/core/evals";
import type { ScorerRunOutputForAgent } from "@mastra/core/evals";

// ---------------------------------------------------------------------------
// Output parser
// ---------------------------------------------------------------------------

// Extracts plain text from a single assistant message's content.
// Handles both legacy string content and the MastraMessageContentV2 parts format.
function extractTextFromMessage(content: any): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return JSON.stringify(content);

  // MastraMessageContentV2: { format: 2, parts: Array<{ type, text, ... }> }
  if (Array.isArray(content.parts)) {
    return content.parts
      .filter((p: any) => p.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text as string)
      .join(" ");
  }

  return JSON.stringify(content);
}

/**
 * Parses a named field from the agent's structured JSON output.
 * Walks assistant message parts to find the JSON object the agent emitted.
 */
export function extractJsonFieldFromOutput(
  output: ScorerRunOutputForAgent,
  fieldName: string
): string | null {
  const text = Array.isArray(output)
    ? output
        .filter((m: any) => m.role === "assistant")
        .map((m: any) => extractTextFromMessage(m.content))
        .join(" ")
        .trim()
    : String(output).trim();

  // Agents output exactly one JSON object — try parsing the full text first.
  try {
    const parsed = JSON.parse(text);
    if (parsed[fieldName] !== undefined) return String(parsed[fieldName]);
  } catch {}

  // Fall back to extracting the first {...} block (handles ```json ``` wrapping).
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed[fieldName] !== undefined ? String(parsed[fieldName]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scorer factory
// ---------------------------------------------------------------------------

/**
 * Creates a deterministic scorer that extracts `fieldName` from the agent's
 * JSON output and compares it to `groundTruth`. Score is 1 on match, 0 otherwise.
 */
export function createJsonFieldScorer(fieldName: string) {
  return createScorer({
    id: `${fieldName}-scorer`,
    description: `Checks that the agent's "${fieldName}" in structured output matches groundTruth`,
  })
    .analyze(({ run }) => {
      const groundTruth = run.groundTruth as string | undefined;
      if (!groundTruth) return { score: 0 };

      const value = extractJsonFieldFromOutput(
        run.output as ScorerRunOutputForAgent,
        fieldName
      );
      return { score: value === groundTruth ? 1 : 0 };
    })
    .generateScore(({ results }) => {
      return (results.analyzeStepResult as any).score as number;
    });
}

// ---------------------------------------------------------------------------
// Runner helpers
// ---------------------------------------------------------------------------

export type ItemSummary = { expected: string; actual: string | null; passed: boolean };

/**
 * Returns an `onItemComplete` callback that logs a single PASS line or a
 * detailed FAIL trace, and appends the result to `acc`.
 */
export function makeOnItemComplete(fieldName: string, scorerId: string, acc: ItemSummary[]) {
  return ({ item, scorerResults }: { item: any; scorerResults: any }) => {
    const result = scorerResults[scorerId] as any;
    const passed = (result?.score ?? 0) === 1;
    const expected = item.groundTruth as string;
    const actual = extractJsonFieldFromOutput(
      result?.output as ScorerRunOutputForAgent,
      fieldName
    );

    acc.push({ expected, actual, passed });

    if (passed) {
      console.log(`    ✓  ${expected}  PASS`);
    } else {
      console.log(`    ✗  ${expected}  FAIL — expected "${expected}" got "${actual ?? "(none)"}"`);
      console.log("       full trace:", JSON.stringify(result, null, 2));
    }
  };
}

/**
 * Prints a one-line summary for an agent block:
 *   agentName: 3/4 passed (75%) | actions: create_task ✓, delete_task ✗
 */
export function printAgentSummary(label: string, items: ItemSummary[]) {
  const passed = items.filter((i) => i.passed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const actions = items
    .map((i) =>
      i.passed
        ? `${i.expected} ✓`
        : `${i.expected}→${i.actual ?? "(none)"} ✗`
    )
    .join(", ");
  console.log(`  ${label}: ${passed}/${total} passed (${pct}%) | actions: ${actions}`);
}
