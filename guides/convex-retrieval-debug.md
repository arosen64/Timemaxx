# Debugging task & course retrieval (time-estimate context)

When `estimateTaskTime` runs, it loads extra context via `fetchRelevantContext` in `backend/convex/lib/retrieval.ts`: **related tasks**, **related courses**, and (later) **chats**. This guide shows how to **inspect task and course retrieval locally** without calling Anthropic.

Chat retrieval (`fetchRelevantChats`) is still a **stub** that returns no IDs; there is nothing to debug for chats until that is implemented.

---

## What you are testing

| Piece | Behavior today |
| ----- | ---------------- |
| **Tasks** | Up to 10 other tasks for the same user. If the anchor task has a **3072-dim** `embedding`, results come from **vector search** on `tasks` / `by_embedding` (similarity order). Otherwise, **recent tasks** heuristics. |
| **Courses** | Up to 10 `userCourses` for the same user. With a valid anchor embedding, **vector search** on `userCourses` / `by_embedding`; the task’s own `courseId` is excluded. Otherwise, **department / recency** heuristics. |
| **Chats** | Not implemented; `fetchRelevantChats` returns `[]`. |

Embeddings for tasks/courses are built from **title + description** (see `backend/convex/ai/embeddings.ts`). Vector search only returns rows that **already have** embeddings indexed.

---

## Prerequisites

1. **Repo root** — Shell cwd must be the directory that contains **`package.json`** and **`convex.json`** (the `team-04` root), **not** `backend/`. The Convex CLI looks for `package.json` there.
2. **`npx convex dev`** — Run in a separate terminal so your dev deployment has current functions and can read your dev data.
3. **Optional:** `GEMINI_API_KEY` on the deployment if you want embeddings to exist (vector path). Without embeddings, you still exercise the **heuristic** paths.

---

## CLI: `inspectRetrievalForTask`

Internal action: `backend/convex/ai/debugRetrieval.ts` → **`inspectRetrievalForTask`**.

Convex **`convex run`** expects the **module path + export name** as printed in error messages and the dashboard — **not** the TypeScript `internal.*` prefix.

```bash
npx convex run ai/debugRetrieval:inspectRetrievalForTask '{"taskId":"<paste_tasks._id_here>"}'
```

**JSON rules:** `taskId` must be a **string** in double quotes. Wrong: `{"taskId":abc123}`; right: `{"taskId":"abc123"}`.

**Example:**

```bash
npx convex run ai/debugRetrieval:inspectRetrievalForTask '{"taskId":"j574qjv328esbt31c8aqepmw6184m4wy"}'
```

You should see:

- JSON with `ok`, `anchorTask` (including `usedVectorRetrieval` and `embeddingLength`), `relevantTaskIds` / `relevantTasks`, `relevantClassIds` / `relevantClasses`.
- A **log line** in the terminal with counts and whether the vector path was used.

If the command says the function was not found, confirm **`npx convex dev`** has pushed successfully (no TypeScript errors) and that you used **`ai/debugRetrieval:...`**, not `internal/ai/...`.

---

## Dashboard

Convex dashboard → **Functions** → **`ai/debugRetrieval`** → **`inspectRetrievalForTask`** → run with `{"taskId": "..."}`.

---

## Related code

| File | Role |
| ---- | ---- |
| `backend/convex/lib/retrieval.ts` | `fetchRelevantTasks`, `fetchRelevantClasses`, `fetchRelevantContext` |
| `backend/convex/ai/debugRetrieval.ts` | Dev-only `inspectRetrievalForTask` action |
| `backend/convex/ai/estimateTaskTime.ts` | Calls `fetchRelevantContext` before the LLM |

---

## See also

- [Test Execution](testing.md) — Vitest / `convex-test` (different from this live-deployment debug flow).
- [Gemini API Key Setup](gemini-api-key-setup.md) — embeddings for tasks/courses.
