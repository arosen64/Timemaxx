import type { GenericActionCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Per-million-token USD pricing for cost estimation. Update when providers
 * change rates. Unknown models return undefined cost (logged but not priced).
 */
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
};

const PROMPT_PREVIEW_LIMIT = 4_000;
const RESPONSE_PREVIEW_LIMIT = 4_000;
const ERROR_MESSAGE_LIMIT = 2_000;

export type Provider = "gemini" | "anthropic" | "mastra";
export type CallStatus = "success" | "error" | "timeout";

export interface AiCallLogInput {
  userId?: Id<"users">;
  callSite: string;
  provider: Provider;
  model?: string;
  status: CallStatus;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  promptPreview?: string;
  responsePreview?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated ${value.length - max} chars]`;
}

/**
 * Computes USD cost from token counts using the static pricing table above.
 * Returns undefined when the model is unknown or token counts are missing.
 */
export function estimateCostUsd(
  model: string | undefined,
  promptTokens: number | undefined,
  completionTokens: number | undefined
): number | undefined {
  if (!model) return undefined;
  const pricing = PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return undefined;
  const inTokens = promptTokens ?? 0;
  const outTokens = completionTokens ?? 0;
  if (inTokens === 0 && outTokens === 0) return undefined;
  return (inTokens * pricing.input + outTokens * pricing.output) / 1_000_000;
}

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TimeoutError" || err.name === "ResponseAborted")
  );
}

/**
 * Fire-and-forget log writer. Never throws — observability must not break callers.
 */
export async function recordAiCall(
  ctx: GenericActionCtx<DataModel>,
  input: AiCallLogInput
): Promise<void> {
  try {
    await ctx.runMutation(internal.mutations.aiCallLogs.recordAiCallLog, {
      userId: input.userId,
      callSite: input.callSite,
      provider: input.provider,
      model: input.model,
      status: input.status,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      estimatedCostUsd: input.estimatedCostUsd,
      promptPreview: truncate(input.promptPreview, PROMPT_PREVIEW_LIMIT),
      responsePreview: truncate(input.responsePreview, RESPONSE_PREVIEW_LIMIT),
      errorMessage: truncate(input.errorMessage, ERROR_MESSAGE_LIMIT),
      metadata: input.metadata,
    });
  } catch (err) {
    console.error("recordAiCall: failed to write observability log", err);
  }
}

/**
 * Wraps an AI call with timing, status, and structured logging. Re-throws
 * caller errors after recording so existing error-handling paths are preserved.
 *
 * Usage:
 *   const result = await withAiObservability(
 *     ctx,
 *     { callSite, provider, model, userId, promptPreview, metadata },
 *     async () => doTheCall(),
 *     (result) => ({
 *       responsePreview: result.text,
 *       promptTokens: result.usage?.promptTokens,
 *       completionTokens: result.usage?.completionTokens,
 *     }),
 *   );
 */
export async function withAiObservability<T>(
  ctx: GenericActionCtx<DataModel>,
  base: {
    callSite: string;
    provider: Provider;
    model?: string;
    userId?: Id<"users">;
    promptPreview?: string;
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<T>,
  extractFromResult?: (result: T) => {
    responsePreview?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const extracted = extractFromResult?.(result) ?? {};
    const latencyMs = Date.now() - start;
    const totalTokens =
      extracted.totalTokens ??
      (extracted.promptTokens !== undefined || extracted.completionTokens !== undefined
        ? (extracted.promptTokens ?? 0) + (extracted.completionTokens ?? 0)
        : undefined);
    await recordAiCall(ctx, {
      ...base,
      status: "success",
      latencyMs,
      promptTokens: extracted.promptTokens,
      completionTokens: extracted.completionTokens,
      totalTokens,
      estimatedCostUsd: estimateCostUsd(
        base.model,
        extracted.promptTokens,
        extracted.completionTokens
      ),
      responsePreview: extracted.responsePreview,
    });
    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const status: CallStatus = isTimeoutError(err) ? "timeout" : "error";
    await recordAiCall(ctx, {
      ...base,
      status,
      latencyMs,
      errorMessage: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    throw err;
  }
}
