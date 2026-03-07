# Backend Testing Guide

## Overview

Tests are written with [Vitest](https://vitest.dev/) and [convex-test](https://github.com/get-convex/convex-test), which provides an in-memory Convex environment — no running backend required.

Test files live alongside the code they cover:

```
backend/
  convex/
    mutations/
      tasks.test.ts     # createTask mutation
      users.test.ts     # completeOnboarding mutation
    queries/
      tasks.test.ts     # getTask, getAllTasks, getTasksPaginated
      users.test.ts     # getCurrUser, isOnboardingComplete
  convex-tests/
    helpers.ts          # shared test utilities
```

---

## Running Tests

From the project root:

```bash
npx vitest
```

To run in watch mode (re-runs on file changes):

```bash
npx vitest --watch
```

To run a single file:

```bash
npx vitest backend/convex/mutations/tasks.test.ts
```

---

## Test Helpers

All tests import from `backend/convex-tests/helpers.ts`.

### `makeTestCtx()`

Creates a fresh in-memory Convex instance with the project schema. Each test should call this to get an isolated database.

```ts
const t = makeTestCtx();
```

### `createTestUser(t, overrides?)`

Inserts a user into the database and returns an authenticated context scoped to that user.

```ts
const { userId, withAuth } = await createTestUser(t);
// or with custom fields:
const { userId, withAuth } = await createTestUser(t, { name: "Alice", email: "alice@example.com" });
```

- `userId` — the inserted user's `_id`
- `withAuth` — a test context with that user's identity set; use this to call mutations/queries that require authentication

---

## What Each Test File Covers

### `mutations/tasks.test.ts` — `createTask`

| Test | What it checks |
|------|----------------|
| Throws when unauthenticated | Unauthenticated callers get an `"Unauthenticated"` error |
| Creates a task and returns its ID | A valid mutation inserts a task and returns a valid ID |
| Stores the authenticated user's ID | The task's `userId` field matches the calling user |
| Accepts all valid task types | `"Problem Set"`, `"Essay"`, `"Coding"`, `"Exam Prep"` are all accepted |

---

### `mutations/users.test.ts` — `completeOnboarding`

| Test | What it checks |
|------|----------------|
| Throws when unauthenticated | Unauthenticated callers get a `"Not authenticated"` error |
| Throws when major is empty or whitespace | Blank `major` values are rejected with `"Major cannot be empty"` |
| Sets `onboardingComplete` to true | After mutation, the user's `onboardingComplete` flag is `true` |
| Persists all onboarding fields | `major`, `year`, `difficultSubjects`, `enjoyedSubjects`, `courses`, and `focusBlockLength` are all saved |

---

### `queries/tasks.test.ts`

**`getTask`**

| Test | What it checks |
|------|----------------|
| Returns null when unauthenticated | No task is returned without an auth context |
| Returns the task for its owner | Owner can fetch their own task by ID |
| Returns null for another user's task | A task belonging to user B is not visible to user A |

**`getAllTasks`**

| Test | What it checks |
|------|----------------|
| Returns empty array when unauthenticated | Unauthenticated calls return `[]` |
| Returns all tasks for the authenticated user | All of the caller's tasks come back |
| Does not return other users' tasks | Tasks scoped to user B are excluded from user A's results |
| Filters by `taskType` | Passing `taskType` only returns tasks of that type |
| Descending sort order (default) | Newest tasks appear first |
| Ascending sort order | Oldest tasks appear first |

**`getTasksPaginated`**

| Test | What it checks |
|------|----------------|
| Returns null when unauthenticated | Unauthenticated callers get `null` |
| Returns paginated tasks | Respects `numItems` and returns a page + `isDone` flag |
| Filters paginated results by `taskType` | Only tasks of the specified type appear in the page |

---

### `queries/users.test.ts`

**`getCurrUser`**

| Test | What it checks |
|------|----------------|
| Returns null when unauthenticated | No user without an auth context |
| Returns the current user when authenticated | Returns the correct user record with matching `_id`, `name`, and `email` |

**`isOnboardingComplete`**

| Test | What it checks |
|------|----------------|
| Returns null when unauthenticated | No result without an auth context |
| Returns false before onboarding | New users have `onboardingComplete: false` |
| Returns true after onboarding | After setting `onboardingComplete: true`, the query reflects it |

---

## Notes

- Each test creates its own isolated `makeTestCtx()` instance — tests do not share state.
- The test environment runs in `edge-runtime` (see `vitest.config.mts`) to match the Convex execution environment.
- No running Convex backend or internet connection is needed to run tests.
