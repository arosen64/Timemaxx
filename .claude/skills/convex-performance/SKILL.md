---
name: convex-performance
description: Performance patterns and anti-patterns for Convex backends. Use when optimizing queries, fixing N+1 problems, designing indexes, implementing batch loading, paginating results, or reviewing Convex code for efficiency.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex Performance Patterns

Performance optimization patterns and anti-patterns for Convex backends.

## Related Skills

- **[convex-schema](../convex-schema/SKILL.md)** — Index design
- **[convex-functions](../convex-functions/SKILL.md)** — Query and mutation patterns
- **[convex-architecture](../convex-architecture/SKILL.md)** — File organization

---

## Performance Guidelines

| Metric                    | Target                                 |
| ------------------------- | -------------------------------------- |
| **Function duration**     | < 100ms                                |
| **Records per operation** | < few hundred                          |
| **Use actions**           | Sparingly — slower and less guaranteed |

- **Queries for reads** — use queries, not actions, for app reads
- **Mutations are transactions** — the entire mutation is atomic
- **Let Convex handle caching** — don't build custom state layers on top
- **Queries drive UI** — don't use mutation return values for UI state updates

---

## Avoid N+1 Queries

The most common performance problem — fetching related data in a loop:

```typescript
// N+1 ANTI-PATTERN
const items = await ctx.db.query("items").withIndex(...).collect();
const withContent = await Promise.all(
  items.map(async (item) => {
    const content = await ctx.db.get(item.contentId); // N extra queries!
    return { ...item, content };
  }),
);

// BATCH LOADING — constant number of queries
const items = await ctx.db.query("items").withIndex(...).collect();
const withContent = await batchLoadContent(ctx, items);
```

---

## Batch Loading Pattern

```typescript
import { Doc, Id, TableNames } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

async function batchGet<T extends TableNames>(
  ctx: QueryCtx,
  table: T,
  ids: Id<T>[],
): Promise<Doc<T>[]> {
  const uniqueIds = [...new Set(ids)];
  const results = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  return results.filter((doc): doc is Doc<T> => doc !== null);
}

async function batchLoadContent(ctx: QueryCtx, items: Doc<"items">[]) {
  const contentIds = items.map((i) => i.contentId);
  const content = await batchGet(ctx, "content", contentIds);
  const contentMap = new Map(content.map((c) => [c._id, c]));

  return items.map((item) => ({
    ...item,
    content: contentMap.get(item.contentId) ?? null,
  }));
}
```

---

## Use Indexes for Sorting

```typescript
// ANTI-PATTERN — fetch then sort in memory
const items = await ctx.db
  .query("items")
  .withIndex("by_parent", (q) => q.eq("parentId", id))
  .collect();
return items.sort((a, b) => a.order - b.order); // Wasteful!

// CORRECT — index provides sort order
const items = await ctx.db
  .query("items")
  .withIndex("by_parent_order", (q) => q.eq("parentId", id))
  .collect();
// Already sorted — no .sort() needed
```

Create compound indexes with the sort field last:

```typescript
.index("by_parent_order", ["parentId", "order"])
```

---

## Use Indexes for Lookups

Always use `.withIndex()` for equality checks:

```typescript
// ANTI-PATTERN — full table scan
const item = await ctx.db
  .query("items")
  .filter((q) => q.eq(q.field("slug"), args.slug))
  .first();

// CORRECT — index lookup
const item = await ctx.db
  .query("items")
  .withIndex("by_slug", (q) => q.eq("slug", args.slug))
  .first();
```

---

## Avoid Quadratic Operations

```typescript
// QUADRATIC — O(n * m)
const result = parents.map((p) => ({
  ...p,
  children: children.filter((c) => c.parentId === p._id),
}));

// LINEAR — O(n + m) using Map
const childrenByParent = new Map<string, Child[]>();
for (const child of children) {
  const key = child.parentId as string;
  if (!childrenByParent.has(key)) childrenByParent.set(key, []);
  childrenByParent.get(key)!.push(child);
}
const result = parents.map((p) => ({
  ...p,
  children: childrenByParent.get(p._id as string) ?? [],
}));
```

---

## Pagination for Large Datasets

Never use `.collect()` on potentially large datasets:

```typescript
// DANGEROUS
const all = await ctx.db.query("items").collect();

// SAFE — use pagination
const page = await ctx.db
  .query("items")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .paginate(paginationOpts);
```

---

## Anti-Patterns Summary

| Category      | Anti-Pattern                         | Fix                                  |
| ------------- | ------------------------------------ | ------------------------------------ |
| **Queries**   | `.filter()` for indexed fields       | Use `.withIndex()`                   |
| **Queries**   | Fetching related data in loops (N+1) | Batch loading helpers                |
| **Queries**   | In-memory `.sort()`                  | Compound index with sort field       |
| **Queries**   | Nested `.filter()` for grouping      | Build a `Map` in one pass            |
| **Queries**   | `.collect()` on large datasets       | Use pagination                       |
| **Functions** | Missing `await` on async ops         | Always `await` scheduler, db calls   |
| **Functions** | `ctx.db` in actions                  | Use `ctx.runQuery`/`ctx.runMutation` |
| **Functions** | `api.*` for scheduling               | Use `internal.*`                     |

---

## Performance Checklist

- [ ] All queries use `.withIndex()` for equality checks
- [ ] Compound indexes include sort fields last
- [ ] No in-memory `.sort()` when an index can provide the order
- [ ] Related entity loading uses batch helpers
- [ ] Large result sets use pagination
- [ ] No nested `.filter()` loops — use `Map` for O(1) lookups
- [ ] All `await` keywords present on async operations
- [ ] Internal functions used for scheduling (`internal.*` not `api.*`)
- [ ] No `ctx.db` access in actions
