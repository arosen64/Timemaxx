---
name: frontend-testing
description: "Testing patterns with Vitest, React Testing Library, and Playwright. Use when writing tests, creating test files, testing stores, testing hooks, testing components, running tests, mocking localStorage, mocking AI SDK, mocking Legend-State, or asking about test conventions, file naming, and what to test."
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - "Bash(npm run test*)"
  - "Bash(npx vitest*)"
  - "Bash(npx playwright*)"
---

# Frontend Testing

## Testing Pyramid

| Layer      | Tool                                | What You Test                                                   | No React Needed |
| ---------- | ----------------------------------- | --------------------------------------------------------------- | --------------- |
| Stores     | Vitest                              | Pure functions: add, remove, update, decode safety, persistence | Yes             |
| AI lib     | Vitest                              | Mock AI SDK, test our abstraction boundary                      | Yes             |
| Hooks      | Vitest + `renderHook`               | Query hooks return data, mutation hooks modify stores           | No              |
| Components | Vitest + RTL `render` + `userEvent` | Render, interactions, conditional UI                            | No              |
| E2E        | Playwright                          | Full browser journeys across pages                              | N/A             |

## File Location Convention

Tests live in `__tests__/` subdirectories co-located with the code they test. E2E tests live in `e2e/` at the project root.

```plaintext
src/chats/store/__tests__/chat.test.ts          # store test
src/chats/hooks/__tests__/use-query-chats.test.ts  # hook test
src/chats/components/__tests__/chat-list.test.tsx   # component test
src/lib/__tests__/ai.test.ts                     # library test
e2e/chat-flow.spec.ts                            # E2E test
```

**Naming:** `*.test.ts` for non-JSX, `*.test.tsx` for JSX, `*.spec.ts` for Playwright.

## What NOT to Test

- **Third-party internals** — Don't test shadcn or prompt-kit component internals. Test _your usage_.
- **Type-level concerns** — TypeScript already checks these.
- **Implementation details** — Don't test internal state or private functions. Test observable behavior.
- **CSS/styling** — Vitest runs with `css: false`. Visual testing is for E2E.

## Mocking Patterns

| What                | How                                                     | Why                                                   |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| localStorage        | Stubbed globally in `setup.ts` + `localStorage.clear()` | Full Storage API stub for Legend-State persistence    |
| AI SDK              | `vi.mock("@/lib/ai")`                                   | Mock at our abstraction boundary, not the SDK         |
| Legend-State stores | Import `$store` + `.set()` directly                     | Direct store manipulation, reset in `beforeEach`      |
| `crypto.randomUUID` | Stubbed globally in `setup.ts`                          | Deterministic IDs: `test-uuid-1`, `test-uuid-2`, etc. |
| `sonner` toasts     | `vi.mock("sonner")`                                     | Verify toast calls without DOM portals                |
| Router (Wouter)     | `vi.mock("wouter")`                                     | Test navigation without real routing                  |
| `ResizeObserver`    | Stubbed globally in `setup.ts`                          | Radix UI needs it; jsdom doesn't provide it           |

## Store Test Pattern

```typescript
import { $store, addItem, removeItem } from "../store-file";
import { createTestItem } from "@/test/helpers";

beforeEach(() => {
  $store.set([]);
});

it("addItem appends to store", () => {
  const item = createTestItem({ _id: "1" });
  addItem(item);
  expect($store.get()).toHaveLength(1);
});
```

## Hook Test Pattern

```typescript
import { renderHook, act } from "@testing-library/react";
import { $store } from "@/feature/store/store-file";
import { useQueryItems } from "../use-query-items";

beforeEach(() => {
  $store.set([]);
});

it("returns items from store", () => {
  $store.set([item1, item2]);
  const { result } = renderHook(() => useQueryItems());
  expect(result.current.data).toHaveLength(2);
});
```

## Component Test Pattern

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("calls onSubmit when form is submitted", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<MyForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Name"), "Alice");
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(onSubmit).toHaveBeenCalledWith({ name: "Alice" });
});
```

## Checklist for New Tests

1. Create `__tests__/` directory next to the file being tested
2. Name: `[filename].test.ts(x)` matching the source file
3. Import and reset stores in `beforeEach`
4. Mock external dependencies (`sonner`, `@/app/router`, `@/lib/ai`)
5. Test observable behavior, not implementation details
6. Use test helpers from `@/test/helpers` for creating test data
7. Run `npx vitest run path/to/test` to verify

## Agentic E2E Testing (Playwright Agents)

Three custom agents in `.claude/agents/` automate E2E test creation and maintenance. Claude auto-dispatches to the right agent based on your request.

### Three-Agent Workflow

| Agent     | Role                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| Planner   | Reads source code + existing tests, produces a test plan in `playwright-specs/` |
| Generator | Takes a test plan, writes `.spec.ts` files, verifies they pass                  |
| Healer    | Runs failing tests, diagnoses errors, fixes the code                            |

### Key Files

- **`e2e/seed.spec.ts`** — Seed test that demonstrates the shared setup (localStorage clear + reload). Agents read this to understand the starting state.
- **`playwright-specs/`** — Directory for markdown test plans generated by the planner.
- **`.claude/agents/`** — Agent definitions for the three Playwright agents.

### Invoking the Agents

Ask Claude directly — it dispatches to the right agent:

- **"Plan E2E tests for the settings feature"** → dispatches to planner
- **"Generate E2E tests from playwright-specs/settings.plan.md"** → dispatches to generator
- **"Fix the failing E2E tests"** → dispatches to healer

### Coexistence with Hand-Written Tests

Hand-written E2E tests (`*-flow.spec.ts`) are maintained manually and are **not touched by agents**. Agent-generated tests live in separate files. Both run together with `pnpm run test:e2e`.

## Running Tests

```bash
pnpm run test              # Run all unit/component tests once
pnpm run test:watch        # Run in watch mode
pnpm run test:coverage     # Run with coverage report
pnpm run test:e2e          # Run Playwright E2E tests
pnpm run test:e2e:ui       # Run Playwright with UI
pnpm run validate          # Type-check + lint + test
```

## Test Setup Details

The setup file (`src/test/setup.ts`) handles:

1. **Jest-DOM matchers** — `toBeInTheDocument()`, `toHaveValue()`, etc.
2. **Persistent storage engine** — Plain object replaces jsdom localStorage for nanostores
3. **ResizeObserver stub** — Required by Radix UI components
4. **Deterministic UUIDs** — `crypto.randomUUID()` returns `test-uuid-1`, `test-uuid-2`, etc.
5. **Cleanup** — After each test: RTL cleanup, storage clear, UUID counter reset

## Reference

See `reference.md` in this directory for complete code examples of every test pattern.
