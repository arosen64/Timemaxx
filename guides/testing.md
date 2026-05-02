# Testing Guide

## Overview

The project has three layers of automated tests:

| Layer | Tool | Environment | What it tests |
|---|---|---|---|
| `backend` | [Vitest](https://vitest.dev/) | `edge-runtime` | Convex mutations and queries using an in-memory Convex instance |
| `frontend` | [Vitest](https://vitest.dev/) | `happy-dom` | React components and pages using React Testing Library |
| `e2e` | [Playwright](https://playwright.dev/) | Headless Chromium | The production-built frontend running end-to-end against `vite preview` |

`npm test` runs the Vitest backend + frontend suites; `npm run test:e2e` runs the
Playwright E2E suite separately. None of the suites require a running Convex
backend or internet connection.

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

# Coverage report (text summary + HTML at coverage/index.html)
npm test -- --coverage
```

---

## Backend Test Helpers

Backend test files live in `backend/convex/tests/`. Helpers are in `backend/convex-tests/helpers.ts`.

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

## End-to-End Tests (Playwright)

E2E test files live in `e2e/tests/`, with shared page objects in `e2e/fixtures/`.
The Playwright config is at `playwright.config.ts` in the project root. See
[`e2e/README.md`](../e2e/README.md) for full conventions.

```bash
# One-time browser install (after npm install)
npm run test:e2e:install

# Run all E2E tests — auto-builds the frontend and serves it via vite preview
npm run test:e2e

# Run with the Playwright UI
npm run test:e2e:ui

# Run against a server you have already started yourself
E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

Current scope is **unauthenticated UI flows only** (landing page, public
routing). The build is invoked with a placeholder `VITE_CONVEX_URL`, so tests
never reach a real backend. Authenticated flows will be added once we have a
deterministic test deployment.

In CI, the `e2e` job runs after `build-and-test` and uploads the
`playwright-report/` artifact on failure.
