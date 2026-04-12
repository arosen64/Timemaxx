---
name: convex-functions
description: Patterns for Convex queries, mutations, actions, helpers, and internal functions. Use when writing Convex functions, implementing CRUD operations, working with async operations, scheduling tasks, or composing auth wrappers with database helpers.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex Function Patterns

Patterns for writing Convex queries, mutations, actions, guards, helpers, and internal functions.

## Related Skills

- **[convex-architecture](../convex-architecture/SKILL.md)** — File organization, domain structure
- **[convex-schema](../convex-schema/SKILL.md)** — Schema patterns, type hierarchy, indexes
- **[convex-guards](../convex-guards/SKILL.md)** — Authorization patterns
- **[convex-performance](../convex-performance/SKILL.md)** — Performance patterns, batch loading
- **[convex-debug](../convex-debug/SKILL.md)** — Debugging, MCP tools, documentation lookup

---

## Quick Reference

| Pattern      | File                       | Purpose                                               |
| ------------ | -------------------------- | ----------------------------------------------------- |
| **Wrappers** | [wrappers.md](wrappers.md) | Custom `queryWithAuth`, `mutationWithAuth` for auth   |
| **Patterns** | [patterns.md](patterns.md) | Helpers, queries, mutations with examples             |
| **Async**    | [async.md](async.md)       | Pending state pattern, internal functions for actions |

---

## Flow Summary

### Authentication Flow

```plaintext
Request → queryWithAuth/mutationWithAuth → Inject ctx.userId → Handler
```

### Query/Mutation Flow

```plaintext
Handler → Guard → Helper → Transform → Return
```

### Async Operation Flow

```plaintext
Mutation → Create with "pending" → scheduler.runAfter() → Internal Action → Update
```

---

## Key Principles

1. **Wrappers handle authentication** — every public function uses `queryWithAuth` or `mutationWithAuth`
2. **Guards handle authorization** — check ownership/roles after fetching
3. **Helpers are pure DB operations** — no auth logic, just database CRUD
4. **Queries compose all layers** — auth → guard → helper → transform
5. **Internal functions for actions** — actions can't access `ctx.db`, use `ctx.runQuery`/`ctx.runMutation`
6. **Always use `internal.*` for scheduling** — never schedule `api.*` functions

---

## Function Checklist

- [ ] Use `queryWithAuth`/`mutationWithAuth` for authenticated endpoints
- [ ] Always specify `returns:` validator
- [ ] Call guards after fetching, before returning/modifying
- [ ] Use helpers for all database operations
- [ ] Transform output with `to{Entity}Out()` before returning
- [ ] Schedule async operations with `ctx.scheduler.runAfter()`
- [ ] Use `internal.*` for all scheduled and `ctx.run*` calls
- [ ] Don't forget `await` on scheduler and db operations

---

## Detailed Documentation

- [wrappers.md](wrappers.md) — Full auth wrapper implementation
- [patterns.md](patterns.md) — Helper, query, and mutation patterns
- [async.md](async.md) — Pending state pattern for external APIs and internal functions
