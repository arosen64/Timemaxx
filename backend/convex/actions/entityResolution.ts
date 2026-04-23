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

type TermBucket = 0 | 1 | 2 | 3;

function termToOrdinal(termName: string): number | null {
  const lower = termName.toLowerCase();
  const yearMatch = termName.match(/\d{4}/);
  if (!yearMatch) return null;
  const year = Number.parseInt(yearMatch[0], 10);
  const season =
    lower.includes("intersession") ? 0 :
    lower.includes("spring") ? 1 :
    lower.includes("summer") ? 2 :
    lower.includes("fall") ? 3 : null;
  if (season === null) return null;
  return year * 10 + season;
}

function currentTermOrdinal(date = new Date()): number {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const season =
    month === 1 && day < 15 ? 0 :
    month < 6 ? 1 :
    month < 8 || (month === 8 && day < 15) ? 2 : 3;
  return year * 10 + season;
}

function termBucket(term: string | undefined): TermBucket {
  if (!term) return 3;
  const ord = termToOrdinal(term);
  if (ord === null) return 3;
  const now = currentTermOrdinal();
  if (ord === now) return 0; // current first
  if (ord > now) return 1; // then future
  return 2; // then past
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
    const rawRank = new Map<string, number>();
    const raw = await ctx.vectorSearch("userCourses", "by_embedding", {
      vector,
      limit: VECTOR_LIMIT,
      filter: (q) => q.eq("userId", args.userId),
    });
    const matching: CourseId[] = [];
    for (const [index, r] of raw.entries()) {
      if (exclude.has(String(r._id))) continue;
      matching.push(r._id);
      rawRank.set(String(r._id), index);
    }
    const courses: Doc<"userCourses">[] = await ctx.runQuery(
      internal.queries.userCourses.getUserCoursesByIdsInternal,
      { courseIds: matching },
    );
    const byId = new Map<string, Doc<"userCourses">>(courses.map((c) => [String(c._id), c]));
    const rankedIds = matching
      .slice()
      .sort((a, b) => {
        const ac = byId.get(String(a));
        const bc = byId.get(String(b));
        const bucketDiff = termBucket(ac?.term) - termBucket(bc?.term);
        if (bucketDiff !== 0) return bucketDiff;
        return (rawRank.get(String(a)) ?? 9999) - (rawRank.get(String(b)) ?? 9999);
      });
    const pageIds = rankedIds.slice(0, PAGE);
    const candidates = pageIds.map((id) => {
      const c = byId.get(String(id))!;
      return {
        id,
        label: `${c.courseCode}`,
        subtitle: c.title,
      };
    });
    const hasMore = rankedIds.length > PAGE;
    return { candidates, hasMore };
  },
});
