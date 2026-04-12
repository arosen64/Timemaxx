import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { fetchRelevantClasses, fetchRelevantTasks } from "../lib/retrieval";

const EMBEDDING_DIMS = 3072;

const anchorTaskShape = v.object({
  _id: v.id("tasks"),
  title: v.string(),
  taskType: v.string(),
  descriptionPreview: v.string(),
  userId: v.id("users"),
  courseId: v.optional(v.id("userCourses")),
  embeddingLength: v.union(v.number(), v.null()),
  usedVectorRetrieval: v.boolean(),
});

const taskHitShape = v.object({
  _id: v.id("tasks"),
  title: v.string(),
  taskType: v.string(),
  dueDate: v.optional(v.number()),
  descriptionPreview: v.string(),
});

const classHitShape = v.object({
  _id: v.id("userCourses"),
  courseCode: v.string(),
  title: v.string(),
  term: v.string(),
});

/**
 * Dev-only helper for `fetchRelevantTasks` + `fetchRelevantClasses` (not chats).
 *
 * CLI (from repo root, with `npx convex dev` running):
 * `npx convex run ai/debugRetrieval:inspectRetrievalForTask '{"taskId":"<tasks._id>"}'`
 *
 * Dashboard: Functions → `ai/debugRetrieval` → `inspectRetrievalForTask`.
 * See guides/convex-retrieval-debug.md (and CLAUDE.md for a one-liner).
 */
export const inspectRetrievalForTask = internalAction({
  args: { taskId: v.id("tasks") },
  returns: v.union(
    v.object({
      ok: v.literal(false),
      message: v.string(),
    }),
    v.object({
      ok: v.literal(true),
      anchorTask: anchorTaskShape,
      relevantTaskIds: v.array(v.id("tasks")),
      relevantTasks: v.array(taskHitShape),
      relevantClassIds: v.array(v.id("userCourses")),
      relevantClasses: v.array(classHitShape),
    }),
  ),
  handler: async (ctx, args) => {
    // `as unknown as { internal: any }` breaks TS self-reference: this module is part of `internal`
    // while resolving `import("../_generated/api")`.
    const { internal } = (await import("../_generated/api")) as unknown as { internal: any };
    const task: Doc<"tasks"> | null = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) {
      return { ok: false as const, message: "No task found for that taskId." };
    }

    const emb = task.embedding;
    const embeddingLength = Array.isArray(emb) ? emb.length : null;
    const usedVectorRetrieval =
      Array.isArray(emb) && emb.length === EMBEDDING_DIMS;

    const [relevantTaskIds, relevantClassIds] = await Promise.all([
      fetchRelevantTasks(ctx, args.taskId, task.userId),
      fetchRelevantClasses(ctx, args.taskId, task.userId),
    ]);

    const [relevantTasks, relevantClasses]: [Doc<"tasks">[], Doc<"userCourses">[]] =
      await Promise.all([
        relevantTaskIds.length === 0
          ? Promise.resolve([] as Doc<"tasks">[])
          : ctx.runQuery(internal.queries.tasks.getTasksByIdsInternal, {
              taskIds: relevantTaskIds,
            }),
        relevantClassIds.length === 0
          ? Promise.resolve([] as Doc<"userCourses">[])
          : ctx.runQuery(internal.queries.userCourses.getUserCoursesByIdsInternal, {
              courseIds: relevantClassIds,
            }),
      ]);

    const preview = (s: string, max = 120) =>
      s.length <= max ? s : `${s.slice(0, max)}…`;

    console.log(
      `[inspectRetrievalForTask] anchor=${task._id} vector=${usedVectorRetrieval} relevantTasks=${relevantTaskIds.length} relevantClasses=${relevantClassIds.length}`,
    );

    return {
      ok: true as const,
      anchorTask: {
        _id: task._id,
        title: task.title,
        taskType: task.taskType,
        descriptionPreview: preview(task.description ?? ""),
        userId: task.userId,
        courseId: task.courseId,
        embeddingLength,
        usedVectorRetrieval,
      },
      relevantTaskIds,
      relevantTasks: relevantTasks.map((t) => ({
        _id: t._id,
        title: t.title,
        taskType: t.taskType,
        dueDate: t.dueDate,
        descriptionPreview: preview(t.description ?? ""),
      })),
      relevantClassIds,
      relevantClasses: relevantClasses.map((c) => ({
        _id: c._id,
        courseCode: c.courseCode,
        title: c.title,
        term: c.term,
      })),
    };
  },
});
