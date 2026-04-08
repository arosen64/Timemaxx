---
name: convex-architecture
description: Design patterns for Convex backend organization. Use when creating new Convex domains, setting up a Convex project, refactoring Convex code, or asking about file organization, folder structure, naming conventions, or domain separation.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex Architecture

Prescriptive design pattern for organizing Convex backends with clean separation of concerns.

## Related Skills

- **[convex-schema](../convex-schema/SKILL.md)** — Schema patterns, type hierarchy, indexes
- **[convex-functions](../convex-functions/SKILL.md)** — Queries, mutations, actions, helpers
- **[convex-guards](../convex-guards/SKILL.md)** — Authorization patterns
- **[convex-performance](../convex-performance/SKILL.md)** — Performance patterns, batch loading
- **[convex-testing](../convex-testing/SKILL.md)** — Testing with convex-test
- **[convex-debug](../convex-debug/SKILL.md)** — Debugging, MCP tools, documentation lookup

---

## Philosophy

Convex has three runtime contexts (queries, mutations, actions) with different capabilities. The architecture embraces this:

1. **Separate concerns by file** — flat structure with domain-prefixed names
2. **Thin API layers** that delegate to helpers
3. **Compose behaviors** through wrappers and guards
4. **Maintain type safety** with a schema hierarchy

---

## File Organization

All files live at the root of `convex/`. Use domain-prefixed naming:

```plaintext
convex/
├── _generated/              # Auto-generated (don't edit)
├── schema.ts                # Main schema (imports domain tables)
├── lib.ts                   # Custom wrappers (queryWithAuth, etc.)
├── shared.ts                # Cross-domain types and utilities
│
├── {domain}_schema.ts       # Type definitions and table schema
├── {domain}_helpers.ts      # Pure database operations
├── {domain}_queries.ts      # Public query endpoints
├── {domain}_mutations.ts    # Public mutation endpoints
├── {domain}_guards.ts       # Authorization checks (optional)
├── {domain}_internals.ts    # Internal functions for actions (optional)
│
├── auth.ts                  # Auth configuration
└── http.ts                  # HTTP endpoints (optional)
```

### Why Flat Files, Not Folders?

Convex uses file-based routing. `convex/chats/queries.ts` creates `api.chats.queries.getAll` — deep nesting causes verbose references and TypeScript slowdowns. Flat files with domain prefixes give `api.chats_queries.getAll` — one level deep.

---

## Responsibility Chain

| Layer         | File                    | Responsibility                    | Required? |
| ------------- | ----------------------- | --------------------------------- | --------- |
| **Schema**    | `{domain}_schema.ts`    | Types, table definition, indexes  | Yes       |
| **Helpers**   | `{domain}_helpers.ts`   | Pure DB operations, transforms    | Yes       |
| **Queries**   | `{domain}_queries.ts`   | Auth → Guard → Helper → Transform | Yes       |
| **Mutations** | `{domain}_mutations.ts` | Auth → Guard → Helper → Schedule  | Yes       |
| **Guards**    | `{domain}_guards.ts`    | Authorization (ownership, roles)  | If needed |
| **Internals** | `{domain}_internals.ts` | DB access for actions, scheduling | If needed |
| **Lib**       | `lib.ts`                | Auth wrappers, shared utilities   | Shared    |

---

## File Size Guidelines

| Metric         | Target     | Hard Limit    |
| -------------- | ---------- | ------------- |
| **Lines/file** | ~100 lines | 250-300 lines |
| **Functions**  | 3-5/file   | 8-10 max      |

Split when a file exceeds 250 lines or mixes distinct concerns. Use a re-export facade to keep the public API stable:

```plaintext
{domain}_queries.ts              # Re-exports only
{domain}_queries_basic.ts        # Core CRUD reads
{domain}_queries_search.ts       # Search and filter
```

---

## Security Rules

- Every public function uses `queryWithAuth` or `mutationWithAuth`
- Guards check authorization after authentication
- Never trust client-supplied roles or permissions
- All scheduled functions use `internal.*`, never `api.*`

---

## Required Dependencies

```json
{
  "dependencies": {
    "convex": "^1.17.0",
    "convex-helpers": "^0.1.78"
  }
}
```

`convex-helpers` provides `customQuery`, `customMutation`, and `customAction` for the wrapper pattern.

---

## Checklist for New Domain

**Required:**

- [ ] Create `{domain}_schema.ts` with type hierarchy and table definition
- [ ] Add table to `schema.ts`
- [ ] Create `{domain}_helpers.ts` with CRUD operations and output transform
- [ ] Create `{domain}_queries.ts` with public read endpoints
- [ ] Create `{domain}_mutations.ts` with public write endpoints
- [ ] Add indexes for common query patterns

**Optional (create only if needed):**

- [ ] `{domain}_guards.ts` — if authorization beyond simple ownership
- [ ] `{domain}_internals.ts` — if async operations, seeding, or HTTP access needed
