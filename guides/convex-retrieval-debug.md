# Debugging task & course retrieval (time-estimate context)

When `estimateTaskTime` runs, it loads extra context via `fetchRelevantContext` in `backend/convex/lib/retrieval.ts`: **related tasks**, **related courses**, and **chat chunks** (vector RAG over `chatChunks`). This guide shows how to **inspect that retrieval locally** without calling Anthropic.

The local retrieval testing actions live under **`backend/convex/dev/`** (module **`dev/localRetrievalTest`**) — they are **not** imported by production HTTP, mutations, or scheduled jobs; they exist only for **`npx convex run`** and the dashboard.

---

## What you are testing

| Piece | Behavior today |
| ----- | ---------------- |
| **Tasks** | Up to 10 other tasks for the same user. If the anchor task has a **3072-dim** `embedding`, results come from **vector search** on `tasks` / `by_embedding` (similarity order). Otherwise, **recent tasks** heuristics. |
| **Courses** | Up to 10 `userCourses` for the same user. With a valid anchor embedding, **vector search** on `userCourses` / `by_embedding`; the task’s own `courseId` is excluded. Otherwise, **department / recency** heuristics. |
| **Chats** | Up to **8** `chatChunks` per user: **vector search** on the embedding of (anchor task title + description + fixed intent phrase). Hits are **re-ranked** so chunks whose `linkedTaskIds` / `linkedCourseIds` overlap the anchor task, similar tasks, similar courses, or the task’s course come first. Requires **`GEMINI_API_KEY`** and chunks that already have **`embedding`** indexed. |

Embeddings for tasks/courses are built from **title + description** (see `backend/convex/ai/embeddings.ts`). Vector search only returns rows that **already have** embeddings indexed.

---

## Prerequisites

1. **Repo root** — Shell cwd must be the directory that contains **`package.json`** and **`convex.json`** (the `team-04` root), **not** `backend/`. The Convex CLI looks for `package.json` there.
2. **`npx convex dev`** — Run in a separate terminal so your dev deployment has current functions and can read your dev data.
3. **`GEMINI_API_KEY`** on the deployment for **task/course vector** paths and for **chat chunk** query embeddings. Chat hits also require **`chatChunks`** rows with embeddings (created when chat messages are chunked; see `mutations/chatChunks.ts`).

---

## CLI: `inspectRetrievalForTask`

Internal action: `backend/convex/dev/localRetrievalTest.ts` → **`inspectRetrievalForTask`**.

Convex **`convex run`** expects the **module path + export name** as printed in error messages and the dashboard — **not** the TypeScript `internal.*` prefix.

```bash
npx convex run dev/localRetrievalTest:inspectRetrievalForTask '{"taskId":"<paste_tasks._id_here>"}'
```

**JSON rules:** `taskId` must be a **string** in double quotes. Wrong: `{"taskId":abc123}`; right: `{"taskId":"abc123"}`.

**Example:**

```bash
npx convex run dev/localRetrievalTest:inspectRetrievalForTask '{"taskId":"j574qjv328esbt31c8aqepmw6184m4wy"}'
```

You should see:

- JSON with `ok`, `anchorTask` (including `usedVectorRetrieval` and `embeddingLength`), `relevantTaskIds` / `relevantTasks`, `relevantClassIds` / `relevantClasses`.
- A **log line** in the terminal with counts and whether the vector path was used.

If the command says the function was not found, confirm **`npx convex dev`** has pushed successfully (no TypeScript errors) and that **`convex run`** uses the module path **`dev/localRetrievalTest:...`** (as in the dashboard), not a dotted `internal.*` path.

---

## CLI: `inspectChatRetrievalForTask`

Internal action: `backend/convex/dev/localRetrievalTest.ts` → **`inspectChatRetrievalForTask`**.

Runs **`fetchRelevantTasks`**, **`fetchRelevantClasses`**, and **`fetchRelevantChats`** for the same anchor `taskId`, then loads chunk rows. Use this to verify **semantic hits**, **`queryEmbeddingOk`**, and **`hadMetadataOverlap`** per chunk.

```bash
npx convex run dev/localRetrievalTest:inspectChatRetrievalForTask '{"taskId":"<paste_tasks._id_here>"}'
```

You should see JSON with `retrievalQueryPreview`, `queryEmbeddingOk`, `relevantChatChunkIds`, and `chatChunks` (each with `textPreview`, `linkedTaskIds`, `linkedCourseIds`, `hadMetadataOverlap`, `embeddingLength`). A **log line** is printed with counts.

When `queryEmbeddingOk` is true, the same query vector is **reused** for `fetchRelevantChats` so Gemini is only called **once** per run.

---

## Dashboard

Convex dashboard → **Functions** → **`dev/localRetrievalTest`** → **`inspectRetrievalForTask`** or **`inspectChatRetrievalForTask`** → run with `{"taskId": "..."}`.

---

## Related code

| File | Role |
| ---- | ---- |
| `backend/convex/lib/retrieval.ts` | `fetchRelevantTasks`, `fetchRelevantClasses`, `fetchRelevantChats`, `fetchRelevantContext` |
| `backend/convex/dev/localRetrievalTest.ts` | Local testing: `inspectRetrievalForTask`, `inspectChatRetrievalForTask` |
| `backend/convex/ai/estimateTaskTime.ts` | Calls `fetchRelevantContext` before the LLM |

---

## See also

- [Test Execution](testing.md) — Vitest / `convex-test` (different from this live-deployment debug flow).
- [Gemini API Key Setup](gemini-api-key-setup.md) — embeddings for tasks/courses.
