import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Inserts a single observability record for an AI call. Called from
 * `lib/aiObservability.ts` via `withAiObservability` / `recordAiCall`.
 */
export const recordAiCallLog = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    callSite: v.string(),
    provider: v.string(),
    model: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("timeout")),
    latencyMs: v.number(),
    promptPreview: v.optional(v.string()),
    responsePreview: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiCallLogs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
