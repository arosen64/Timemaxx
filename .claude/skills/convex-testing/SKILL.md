---
name: convex-testing
description: Testing patterns for Convex backends using convex-test and Vitest. Use when writing tests for Convex queries, mutations, or actions, setting up test infrastructure, or testing authenticated operations.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex Testing Patterns

Testing patterns for Convex backends using `convex-test` and `vitest`.

## Related Skills

- **[convex-functions](../convex-functions/SKILL.md)** — Function patterns being tested
- **[convex-guards](../convex-guards/SKILL.md)** — Authorization logic to test
- **[convex-architecture](../convex-architecture/SKILL.md)** — Domain file organization tests depend on
- **[convex-debug](../convex-debug/SKILL.md)** — Debugging, MCP tools, documentation lookup

## Quick Reference

| Topic     | File                 |
| --------- | -------------------- |
| **Setup** | [setup.md](setup.md) |

---

## Quick Start

See [setup.md](setup.md) for full dependency installation, `vitest.config.ts`, and the `createTestUser` helper.

### Example Test

```typescript
import { expect, test, describe, vi, beforeAll, afterAll } from "vitest";
import { api } from "./_generated/api";
import { createTestUser, modules } from "./test.setup";
import schema from "./schema";
import { convexTest } from "convex-test";

beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());

describe("entities", () => {
  test("authenticated user can create resource", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await createTestUser(t, "Alice");

    const id = await asUser.mutation(api.entity_mutations.create, {
      title: "Test",
    });

    expect(id).toBeDefined();
  });
});
```

---

## Test Categories

Every domain should test:

1. **Authentication** — unauthenticated access denied
2. **CRUD** — create, read, update, delete work correctly
3. **Authorization** — cross-user access denied
4. **Edge cases** — minimal fields, partial updates, non-existent resources

---

## Key Patterns

### New Context Per Test

```typescript
test("test 1", async () => {
  const t = convexTest(schema, modules); // Fresh context
});
```

Always create a new test context for each test to ensure isolation.

### Authenticated Actions

```typescript
const { userId, asUser } = await createTestUser(t, "Alice");
const result = await asUser.query(api.entity_queries.getOne, { id });
```

### Testing Errors

```typescript
await expect(
  asUser.mutation(api.entity_mutations.action, { ... }),
).rejects.toThrow("error message");
```

### Direct DB Access

```typescript
await t.run(async (ctx) => {
  await ctx.db.insert("table", { field: "value" });
});
```

### Cross-User Authorization

```typescript
test("user cannot access another user's resource", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asAlice } = await createTestUser(t, "Alice");
  const { asUser: asBob } = await createTestUser(t, "Bob");

  const id = await asAlice.mutation(api.entity_mutations.create, {
    title: "Alice's item",
  });

  await expect(
    asBob.query(api.entity_queries.getOne, { entityId: id }),
  ).rejects.toThrow();
});
```

---

## Scheduled Functions

Mutations that schedule background functions cause "Write outside of transaction" errors in tests. Use fake timers to prevent scheduled functions from executing:

```typescript
beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());
```

---

## Anti-Patterns

| Anti-Pattern                      | Fix                                       |
| --------------------------------- | ----------------------------------------- |
| Shared test context between tests | Create new `convexTest()` per test        |
| Missing `modules` import          | Always pass `modules` from test.setup     |
| Random string as identity subject | Use `createTestUser` helper               |
| Missing fake timers               | Add `beforeAll(() => vi.useFakeTimers())` |

---

## Checklist for New Domain Tests

- [ ] Create `convex/{domain}.test.ts`
- [ ] Import `createTestUser, modules` from `./test.setup`
- [ ] Add fake timers setup/teardown
- [ ] Add authentication tests
- [ ] Add CRUD tests
- [ ] Add authorization tests
- [ ] Add edge case tests

---

## Detailed Documentation

- [setup.md](setup.md) — Full setup including `createTestUser` implementation
