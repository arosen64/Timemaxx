# Testing Guide

## Overview

Tests are written with [Vitest](https://vitest.dev/). The project has two test environments that run together under `npm test`:

| Project | Environment | What it tests |
|---|---|---|
| `backend` | `edge-runtime` | Convex mutations and queries using an in-memory Convex instance |
| `frontend` | `happy-dom` | React components and pages using React Testing Library |

No running Convex backend or internet connection is needed to run any tests.

---

## Running Tests

From the project root:

```bash
# Run all tests (backend + frontend)
npm test

# Watch mode — reruns on file changes
npm run test:watch

# Backend or frontend only
npx vitest run --project backend
npx vitest run --project frontend

# Single file
npx vitest run frontend/tests/OnboardingPage.test.tsx
```

---

## Backend Test Helpers

Backend tests import from `backend/convex-tests/helpers.ts`.

**`makeTestCtx()`** — creates a fresh in-memory Convex instance. Call this in each test to get an isolated database.

```ts
const t = makeTestCtx();
```

**`createTestUser(t, overrides?)`** — inserts a user and returns an authenticated context scoped to that user.

```ts
const { userId, withAuth } = await createTestUser(t);
```

- `userId` — the inserted user's `_id`
- `withAuth` — use this to call mutations/queries that require authentication

---

## Frontend Test Helpers

Frontend tests import from `frontend/tests/utils.tsx`.

**`renderWithProviders(ui, options?)`** — renders a component inside a `MemoryRouter`. Pass `initialEntries` to set the starting URL.

```tsx
renderWithProviders(<OnboardingPage />, { initialEntries: ['/onboarding'] })
```

**`makeMutationFn()`** — returns a `vi.fn()` that resolves successfully. Use this to mock `useMutation` and `useAction`.

```tsx
const saveOnboarding = makeMutationFn()
mockUseMutation.mockReturnValue(saveOnboarding as never)
```

Each test file mocks `convex/react` at the module level so `useQuery`, `useMutation`, `useAction`, and `useConvexAuth` can be controlled per-test.

---

## What's Tested

- **`mutations/tasks.test.ts`** — `createTask`: auth checks, task creation, field storage
- **`mutations/users.test.ts`** — `completeOnboarding`: validation, field persistence
- **`queries/tasks.test.ts`** — `getTask`, `getAllTasks`, `getTasksPaginated`: auth, ownership, filtering, sorting
- **`queries/users.test.ts`** — `getCurrUser`, `isOnboardingComplete`: auth and state checks
- **`App.test.tsx`** — auth redirect logic for all routes
- **`OnboardingPage.test.tsx`** — 3-step flow, validation, navigation, submission
- **`DashboardPage.test.tsx`** — task list rendering, modals, error handling
- **`ProfileForm.test.tsx`** — form fields, tag inputs, controlled component behavior
