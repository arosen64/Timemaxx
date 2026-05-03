import type { GenericActionCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

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
  extractFromResult?: (result: T) => { responsePreview?: string }
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const extracted = extractFromResult?.(result) ?? {};
    const latencyMs = Date.now() - start;
    await recordAiCall(ctx, {
      ...base,
      status: "success",
      latencyMs,
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
