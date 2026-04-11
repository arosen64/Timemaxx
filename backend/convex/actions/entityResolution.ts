"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { embedGeminiText } from "../lib/geminiEmbedding";
import type { Doc, Id } from "../_generated/dataModel";

type TaskId = Id<"tasks">;
type CourseId = Id<"userCourses">;

const PAGE = 5;
const VECTOR_LIMIT = 64;

function formatDue(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export const searchTaskCandidates = internalAction({
  args: {
    userId: v.id("users"),
    queryText: v.string(),
    excludeIds: v.array(v.id("tasks")),
  },
  returns: v.object({
    candidates: v.array(
      v.object({
        id: v.id("tasks"),
        label: v.string(),
        subtitle: v.string(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { internal } = await import("../_generated/api");
    const vector = await embedGeminiText(args.queryText);
    const exclude = new Set<string>(args.excludeIds.map(String));
    const raw = await ctx.vectorSearch("tasks", "by_embedding", {
      vector,
      limit: VECTOR_LIMIT,
      filter: (q) => q.eq("userId", args.userId),
    });
    const matching: TaskId[] = [];
    for (const r of raw) {
      if (exclude.has(String(r._id))) continue;
      matching.push(r._id);
    }
    const pageIds = matching.slice(0, PAGE);
    const tasks: Doc<"tasks">[] = await ctx.runQuery(internal.queries.tasks.getTasksByIdsInternal, {
      taskIds: pageIds,
    });
    const byId = new Map<string, Doc<"tasks">>(tasks.map((t) => [String(t._id), t]));
    const candidates = pageIds.map((id) => {
      const t = byId.get(String(id))!;
      return {
        id,
        label: t.title,
        subtitle: t.dueDate ? `Due ${formatDue(t.dueDate)}` : "No due date",
      };
    });
    /** True when more non-excluded matches exist beyond this page (so "Other" can paginate). */
    const hasMore = matching.length > PAGE;
    return { candidates, hasMore };
  },
});

export const searchCourseCandidates = internalAction({
  args: {
    userId: v.id("users"),
    queryText: v.string(),
    excludeIds: v.array(v.id("userCourses")),
  },
  returns: v.object({
    candidates: v.array(
      v.object({
        id: v.id("userCourses"),
        label: v.string(),
        subtitle: v.string(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { internal } = await import("../_generated/api");
    const vector = await embedGeminiText(args.queryText);
    const exclude = new Set<string>(args.excludeIds.map(String));
    const raw = await ctx.vectorSearch("userCourses", "by_embedding", {
      vector,
      limit: VECTOR_LIMIT,
      filter: (q) => q.eq("userId", args.userId),
    });
    const matching: CourseId[] = [];
    for (const r of raw) {
      if (exclude.has(String(r._id))) continue;
      matching.push(r._id);
    }
    const pageIds = matching.slice(0, PAGE);
    const courses: Doc<"userCourses">[] = await ctx.runQuery(
      internal.queries.userCourses.getUserCoursesByIdsInternal,
      {
        courseIds: pageIds,
      },
    );
    const byId = new Map<string, Doc<"userCourses">>(courses.map((c) => [String(c._id), c]));
    const candidates = pageIds.map((id) => {
      const c = byId.get(String(id))!;
      return {
        id,
        label: `${c.courseCode}`,
        subtitle: c.title,
      };
    });
    const hasMore = matching.length > PAGE;
    return { candidates, hasMore };
  },
});
