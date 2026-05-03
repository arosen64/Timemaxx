import { internalQuery, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Returns the most recent AI call logs for the signed-in user.
 * Useful for debugging "why did Maxx say X?" or "what did the model see?".
 */
export const getRecentForCurrentUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = Math.min(args.limit ?? 50, 200);
    return await ctx.db
      .query("aiCallLogs")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Returns recent failed AI calls (across all users) for diagnosis. Caller is
 * responsible for any admin gating; this is exposed as an internal query so
 * dashboards / cron can call it without an authenticated user context.
 */
export const getRecentFailuresInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    const errors = await ctx.db
      .query("aiCallLogs")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "error"))
      .order("desc")
      .take(limit);
    const timeouts = await ctx.db
      .query("aiCallLogs")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "timeout"))
      .order("desc")
      .take(limit);
    return [...errors, ...timeouts].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },
});

/**
 * Aggregates total spend, request count, and average latency over a recent
 * window. Returned as an admin/analytics-style summary so we can spot a sudden
 * cost spike or latency regression.
 */
export const getUsageSummaryInternal = internalQuery({
  args: { sinceMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const since = args.sinceMs ?? Date.now() - 24 * 60 * 60 * 1000;
    const logs = await ctx.db
      .query("aiCallLogs")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", since))
      .collect();

    const summary = {
      totalCalls: logs.length,
      totalSuccess: 0,
      totalErrors: 0,
      totalTimeouts: 0,
      totalCostUsd: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      avgLatencyMs: 0,
      byCallSite: {} as Record<string, { count: number; costUsd: number; avgLatencyMs: number }>,
    };

    let latencySum = 0;
    const callSiteLatencies: Record<string, number> = {};

    for (const log of logs) {
      if (log.status === "success") summary.totalSuccess += 1;
      else if (log.status === "timeout") summary.totalTimeouts += 1;
      else summary.totalErrors += 1;

      summary.totalCostUsd += log.estimatedCostUsd ?? 0;
      summary.totalPromptTokens += log.promptTokens ?? 0;
      summary.totalCompletionTokens += log.completionTokens ?? 0;
      latencySum += log.latencyMs;

      const bucket = (summary.byCallSite[log.callSite] ??= {
        count: 0,
        costUsd: 0,
        avgLatencyMs: 0,
      });
      bucket.count += 1;
      bucket.costUsd += log.estimatedCostUsd ?? 0;
      callSiteLatencies[log.callSite] = (callSiteLatencies[log.callSite] ?? 0) + log.latencyMs;
    }

    summary.avgLatencyMs = logs.length > 0 ? latencySum / logs.length : 0;
    for (const [site, bucket] of Object.entries(summary.byCallSite)) {
      bucket.avgLatencyMs = callSiteLatencies[site] / bucket.count;
    }

    return summary;
  },
});
