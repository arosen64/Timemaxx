# Testing Guide

## Overview

Tests are written with [Vitest](https://vitest.dev/). The project has two test environments that run together under `npm test`:

| Project | Environment | What it tests |
|---|---|---|
| `backend` | `edge-runtime` | Convex mutations and queries using an in-memory Convex instance |
| `frontend` | `happy-dom` | React components and pages using React Testing Library |

### File structure

```
backend/
  convex/
    mutations/
      tasks.test.ts         # createTask mutation
      users.test.ts         # completeOnboarding mutation
    queries/
      tasks.test.ts         # getTask, getAllTasks, getTasksPaginated
      users.test.ts         # getCurrUser, isOnboardingComplete
  convex-tests/
    helpers.ts              # shared backend test utilities
frontend/
  tests/
    App.test.tsx            # auth redirect logic
    OnboardingPage.test.tsx # 3-step onboarding flow
    DashboardPage.test.tsx  # task list, modals, error handling
    ProfileForm.test.tsx    # form field and tag input behavior
    utils.tsx               # shared frontend test helpers
    setup.ts                # jest-dom matchers + Vitest globals
```

---

## Running Tests

From the project root:

```bash
# Run all tests (backend + frontend)
npm test

# Watch mode — reruns on file changes
npm run test:watch

# Backend tests only
npx vitest run --project backend

# Frontend tests only
npx vitest run --project frontend

# Single file
npx vitest run frontend/tests/OnboardingPage.test.tsx
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

---

## Frontend Test Helpers

All frontend tests import from `frontend/tests/utils.tsx`.

### `renderWithProviders(ui, options?)`

Renders a component inside a `MemoryRouter` so any component using React Router hooks works without a real browser. Accepts an optional `initialEntries` array to set the starting URL.

```tsx
renderWithProviders(<OnboardingPage />, { initialEntries: ['/onboarding'] })
```

### `makeMutationFn(resolved?)`

Returns a `vi.fn()` that resolves successfully. Use this to mock `useMutation` and `useAction` return values.

```tsx
const saveOnboarding = makeMutationFn()
mockUseMutation.mockReturnValue(saveOnboarding as never)

// later in assertions:
expect(saveOnboarding).toHaveBeenCalledWith(expect.objectContaining({ major: 'Math' }))
```

### Mocking Convex hooks

Each test file mocks `convex/react` at the module level. The api module is also mocked with a plain object so accessing `api.queries.users.getCurrUser` etc. doesn't throw.

```tsx
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
  useConvexAuth: vi.fn(),
}))

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: { users: { getCurrUser: 'getCurrUser' } },
    mutations: { tasks: { updateTask: 'updateTask' } },
    // ...
  },
}))
```

When mocking `useQuery` for components that call it more than once, distinguish calls by the query key string rather than call count — otherwise re-renders return the wrong data:

```tsx
mockUseQuery.mockImplementation((query: string) => {
  if (query === 'getAllTasks') return MOCK_TASKS
  return MOCK_USER
})
```

### Controlled input components

`ProfileForm` and similar components are controlled — the parent owns the data. When testing them, use a stateful wrapper so inputs actually update as the user types:

```tsx
function Wrapper() {
  const [data, setData] = useState(DEFAULT_DATA)
  return <ProfileForm data={data} onChange={setData} errors={{}} />
}
render(<Wrapper />)
```

Without this, each keystroke would overwrite the previous because the data prop never changes.

---

## What Each Frontend Test File Covers

### `App.test.tsx` — auth redirect logic

| Test | What it checks |
|---|---|
| Unauthenticated user at `/` | Lands on LandingPage |
| Unauthenticated user at `/dashboard` | Redirected to LandingPage |
| Unauthenticated user at `/onboarding` | Redirected to LandingPage |
| Authenticated + complete profile at `/` | Redirected to DashboardPage |
| Authenticated + incomplete profile at `/` | Redirected to OnboardingPage |
| Authenticated + complete profile at `/dashboard` | Renders DashboardPage |
| Authenticated user at `/profile` | Renders ProfilePage |
| Auth still loading | No redirect — stays on current route |

---

### `OnboardingPage.test.tsx` — 3-step onboarding flow

| Test | What it checks |
|---|---|
| Already complete | Redirects to `/dashboard` immediately |
| Step 1 renders | Profile form (major, year fields) is shown initially |
| Step 1 validation | Empty required fields block advancing and show error messages |
| Step 1 → Step 2 | Filling major + year and clicking Next advances to work hours |
| Step 2 → Step 3 | Clicking Next on step 2 shows the preferences form with Submit button |
| Back navigation | Clicking Back from step 2 returns to step 1 with entered data preserved |
| Full flow submit | Calls `saveOnboarding` with correct shape and navigates to `/dashboard` |
| Back disabled on step 1 | Back button is disabled when on the first step |

---

### `DashboardPage.test.tsx` — task list and modals

| Test | What it checks |
|---|---|
| Empty state | "No tasks yet" message shown when task list is empty |
| Task list renders | Task titles appear in the list |
| Time estimate display | Minutes are shown next to tasks that have an estimate |
| Loading state | "Loading tasks…" shown while `useQuery` returns `undefined` |
| Add Task modal opens | Clicking "Add Task" button renders the modal |
| Add Task modal closes | Closing the modal removes it from the DOM |
| JSON estimation error | Error code and message from Convex error wrapper are displayed |
| Dismiss error modal | Clicking Dismiss removes the estimation error modal |
| Non-JSON estimation error | Falls back to a generic error message |

---

### `ProfileForm.test.tsx` — form fields and tag inputs

| Test | What it checks |
|---|---|
| Major renders with value | Input shows the current `data.major` value |
| Major onChange | Typing updates the value and calls `onChange` with the new major |
| Major error | Error message renders when `errors.major` is set |
| Year onChange | Selecting an option calls `onChange` with the correct year |
| Year error | Error message renders when `errors.year` is set |
| Difficult subjects — add tag (Enter) | Pressing Enter adds the tag and calls `onChange` |
| Difficult subjects — renders existing | Existing tags in `data.difficultSubjects` are displayed |
| Difficult subjects — remove tag | Clicking × on a tag removes it and calls `onChange` |
| Enjoyed subjects — add tag (comma) | Pressing `,` adds the tag and calls `onChange` |
| Courses — add course | Clicking "Add course" appends an empty course entry |
| Courses — remove course | Clicking × removes the correct course |
| Courses — update title | Typing in a course title calls `onChange` with the updated title |
| Courses — set study goal | Clicking a radio option updates the course's `studyGoal` |

---

## Notes

- Each backend test creates its own isolated `makeTestCtx()` instance — tests do not share state.
- The backend test environment runs in `edge-runtime` (see `vitest.config.mts`) to match the Convex execution environment.
- Frontend tests run in `happy-dom`, a lightweight DOM environment compatible with Vitest.
- No running Convex backend or internet connection is needed to run any tests.
