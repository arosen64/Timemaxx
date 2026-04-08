# Convex Schema Reference

Detailed validator patterns, index types, and TypeScript integration.

---

## TypeScript Type Extraction

Use `Infer<typeof validator>` to extract TypeScript types from Convex validators:

```typescript
import { Infer, v } from "convex/values";

const entityValidator = v.object({
  title: v.string(),
  count: v.number(),
});
type EntityType = Infer<typeof entityValidator>;
// Result: { title: string; count: number }
```

### Convex-Provided Types

```typescript
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

type Entity = Doc<"entities">; // Document with system fields
type EntityId = Id<"entities">; // Reference to a document
type EntityInput = Omit<Doc<"entities">, "_id" | "_creationTime">;
```

### Context Types for Helpers

```typescript
async function getEntityById(ctx: QueryCtx, id: Id<"entities">): Promise<Doc<"entities">> { ... }
async function createEntity(ctx: MutationCtx, data: EntityInput): Promise<Id<"entities">> { ... }
```

---

## Validator Patterns

### Optional with Default

```typescript
// In schema
status: v.optional(v.string()),

// In helper — apply default
const status = data.status ?? "draft";
```

### Union Types

```typescript
export const BlockType = v.union(
  v.literal("text"),
  v.literal("code"),
  v.literal("image"),
);
export type BlockTypeValue = Infer<typeof BlockType>;
```

### Nullable vs Optional

```typescript
field: v.optional(v.string()); // string | undefined
field: v.union(v.string(), v.null()); // string | null
field: v.optional(v.union(v.string(), v.null())); // string | null | undefined
```

### Nested Objects

```typescript
export const settingsSchema = {
  theme: v.object({
    mode: v.union(v.literal("light"), v.literal("dark")),
    preset: v.optional(v.string()),
  }),
  notifications: v.object({
    email: v.boolean(),
    push: v.boolean(),
  }),
};
```

---

## Index Types

### Basic Index

For simple equality lookups:

```typescript
.index("by_user_id", ["userId"])
```

```typescript
ctx.db
  .query("entities")
  .withIndex("by_user_id", (q) => q.eq("userId", userId))
  .collect();
```

### Compound Index for Sorting

Include sort field last:

```typescript
.index("by_parent_order", ["parentId", "order"])
```

```typescript
// Results already sorted by order — no .sort() needed
ctx.db
  .query("items")
  .withIndex("by_parent_order", (q) => q.eq("parentId", id))
  .collect();
```

### Search Index

For full-text search:

```typescript
.searchIndex("search_all", {
  searchField: "searchableContent",
  filterFields: ["userId"],
})
```

```typescript
ctx.db
  .query("entities")
  .withSearchIndex("search_all", (q) =>
    q.search("searchableContent", searchQuery).eq("userId", userId),
  )
  .collect();
```

### Vector Index

For semantic/similarity search (actions only):

```typescript
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
  filterFields: ["userId"],
})
```

```typescript
ctx.vectorSearch("entities", "by_embedding", {
  vector: embedding,
  limit: 10,
  filter: (q) => q.eq("userId", userId),
});
```

---

## Shared Types

Common types used across domains:

```typescript
// convex/shared.ts
import { v, Infer } from "convex/values";

export const paginationOptsValidator = v.object({
  numItems: v.number(),
  cursor: v.union(v.string(), v.null()),
});
export type PaginationOptsType = Infer<typeof paginationOptsValidator>;

export const SortOrder = v.union(v.literal("asc"), v.literal("desc"));
export type SortOrderType = Infer<typeof SortOrder>;
```
