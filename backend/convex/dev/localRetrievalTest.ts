import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  buildChatRetrievalQueryText,
  chunkHasMetadataOverlap,
  fetchRelevantChats,
  fetchRelevantClasses,
  fetchRelevantTasks,
} from "../lib/retrieval";

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

const chatChunkHitShape = v.object({
  _id: v.id("chatChunks"),
  sessionId: v.string(),
  textPreview: v.string(),
  startCreatedAt: v.number(),
  linkedTaskIds: v.array(v.id("tasks")),
  linkedCourseIds: v.array(v.id("userCourses")),
  hadMetadataOverlap: v.boolean(),
  embeddingLength: v.union(v.number(), v.null()),
});

/** Anchor summary for chat RAG inspect only (omits task self-embedding fields — those describe task/course retrieval, not the chat query). */
const chatInspectAnchorTaskShape = v.object({
  _id: v.id("tasks"),
  title: v.string(),
  taskType: v.string(),
  descriptionPreview: v.string(),
  userId: v.id("users"),
  courseId: v.optional(v.id("userCourses")),
});

/**
 * Local testing helper for `fetchRelevantTasks` + `fetchRelevantClasses` (not chats).
 * Not used by production routes — run from the Convex CLI or dashboard against a dev deployment.
 * For **`chatChunks`** RAG, use **`inspectChatRetrievalForTask`**.
 *
 * CLI (from repo root, with `npx convex dev` running):
 * `npx convex run dev/localRetrievalTest:inspectRetrievalForTask '{"taskId":"<tasks._id>"}'`
 *
 * Dashboard: Functions → `dev/localRetrievalTest` → `inspectRetrievalForTask`.
 * See guides/convex-retrieval-debug.md.
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

/**
 * Local testing: runs the same chat RAG path as `estimateTaskTime` — related tasks
 * and courses, then `fetchRelevantChats`, and returns chunk previews plus
 * whether each hit had entity metadata overlap. Not wired into production.
 *
 * CLI (repo root, `npx convex dev` running, `GEMINI_API_KEY` on deployment for
 * query embedding and indexed `chatChunks`):
 * `npx convex run dev/localRetrievalTest:inspectChatRetrievalForTask '{"taskId":"<tasks._id>"}'`
 */
export const inspectChatRetrievalForTask = internalAction({
  args: { taskId: v.id("tasks") },
  returns: v.union(
    v.object({
      ok: v.literal(false),
      message: v.string(),
    }),
    v.object({
      ok: v.literal(true),
      anchorTask: chatInspectAnchorTaskShape,
      relevantTaskIds: v.array(v.id("tasks")),
      relevantClassIds: v.array(v.id("userCourses")),
      retrievalQueryPreview: v.string(),
      queryEmbeddingOk: v.boolean(),
      relevantChatChunkIds: v.array(v.id("chatChunks")),
      chatChunks: v.array(chatChunkHitShape),
    }),
  ),
  handler: async (ctx, args) => {
    const { internal } = (await import("../_generated/api")) as unknown as { internal: any };
    const task: Doc<"tasks"> | null = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) {
      return { ok: false as const, message: "No task found for that taskId." };
    }

    const [relevantTaskIds, relevantClassIds] = await Promise.all([
      fetchRelevantTasks(ctx, args.taskId, task.userId),
      fetchRelevantClasses(ctx, args.taskId, task.userId),
    ]);

    const preview = (s: string, max = 200) => (s.length <= max ? s : `${s.slice(0, max)}…`);

    const retrievalFullText = buildChatRetrievalQueryText(task);
    if (retrievalFullText === null) {
      const retrievalQueryPreview =
        "Skipped: empty task title and description (no anchor text for chat retrieval).";
      console.log(
        `[inspectChatRetrievalForTask] anchor=${task._id} queryEmbedOk=false chunks=0 (empty anchor text) relevantTasks=${relevantTaskIds.length} relevantClasses=${relevantClassIds.length}`,
      );
      return {
        ok: true as const,
        anchorTask: {
          _id: task._id,
          title: task.title,
          taskType: task.taskType,
          descriptionPreview: preview(task.description ?? "", 120),
          userId: task.userId,
          courseId: task.courseId,
        },
        relevantTaskIds,
        relevantClassIds,
        retrievalQueryPreview,
        queryEmbeddingOk: false,
        relevantChatChunkIds: [],
        chatChunks: [],
      };
    }

    const retrievalQueryPreview =
      retrievalFullText.length <= 600 ? retrievalFullText : `${retrievalFullText.slice(0, 600)}…`;

    const queryVector = (await ctx.runAction(internal.ai.embeddings.embedRetrievalQueryInternal, {
      text: retrievalFullText,
    })) as number[] | null;
    const queryEmbeddingOk =
      Array.isArray(queryVector) && queryVector.length === EMBEDDING_DIMS;

    let relevantChatChunkIds: Doc<"chatChunks">["_id"][] = [];
    let chunksRaw: Doc<"chatChunks">[] = [];
    if (queryEmbeddingOk) {
      const chats = await fetchRelevantChats(ctx, task.userId, args.taskId, relevantTaskIds, relevantClassIds, {
        queryEmbedding: queryVector,
      });
      relevantChatChunkIds = chats.chunkIds;
      chunksRaw = chats.chunks;
    }

    const taskIdSet = new Set([args.taskId, ...relevantTaskIds]);
    const courseIdSet = new Set(relevantClassIds);
    if (task.courseId) {
      courseIdSet.add(task.courseId);
    }

    const chatChunks = chunksRaw.map((c) => ({
      _id: c._id,
      sessionId: c.sessionId,
      textPreview: preview(c.text),
      startCreatedAt: c.startCreatedAt,
      linkedTaskIds: c.linkedTaskIds,
      linkedCourseIds: c.linkedCourseIds,
      hadMetadataOverlap: chunkHasMetadataOverlap(c, taskIdSet, courseIdSet),
      embeddingLength: Array.isArray(c.embedding) ? c.embedding.length : null,
    }));

    console.log(
      `[inspectChatRetrievalForTask] anchor=${task._id} queryEmbedOk=${queryEmbeddingOk} chunks=${relevantChatChunkIds.length} relevantTasks=${relevantTaskIds.length} relevantClasses=${relevantClassIds.length}`,
    );

    return {
      ok: true as const,
      anchorTask: {
        _id: task._id,
        title: task.title,
        taskType: task.taskType,
        descriptionPreview: preview(task.description ?? "", 120),
        userId: task.userId,
        courseId: task.courseId,
      },
      relevantTaskIds,
      relevantClassIds,
      retrievalQueryPreview,
      queryEmbeddingOk,
      relevantChatChunkIds,
      chatChunks,
    };
  },
});
