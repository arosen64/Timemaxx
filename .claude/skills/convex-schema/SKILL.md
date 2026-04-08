---
name: convex-schema
description: Schema patterns for Convex backends including type hierarchy, validators, indexes, and table definitions. Use when defining tables, creating validators, designing indexes, working with the Convex type system, or asking about nullable vs optional fields, schema organization, or TypeScript type extraction.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex Schema Patterns

Schema design patterns covering type hierarchy, validators, indexes, and TypeScript integration.

## Related Skills

- **[convex-architecture](../convex-architecture/SKILL.md)** — File organization, domain structure
- **[convex-functions](../convex-functions/SKILL.md)** — Queries, mutations, helpers
- **[convex-guards](../convex-guards/SKILL.md)** — Guards depend on schema ownership fields
- **[convex-performance](../convex-performance/SKILL.md)** — Index design for performance

## Four-Level Type Hierarchy

Each domain defines four schema levels in `{domain}_schema.ts`:

```typescript
import { defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// INPUT — What clients provide when creating
export const entityInSchema = {
  title: v.string(),
  description: v.optional(v.string()),
};
export const entityInSchemaObject = v.object(entityInSchema);
export type EntityInType = Infer<typeof entityInSchemaObject>;

// UPDATE — Partial fields for updates
export const entityUpdateSchema = {
  ...entityInSchema,
  title: v.optional(v.string()),
};
export const entityUpdateSchemaObject = v.object(entityUpdateSchema);
export type EntityUpdateType = Infer<typeof entityUpdateSchemaObject>;

// INTERNAL — What's stored in the database
export const entitySchema = {
  ...entityInSchema,
  userId: v.id("users"),
};
export const entitySchemaObject = v.object(entitySchema);
export type EntityType = Infer<typeof entitySchemaObject>;

// OUTPUT — What's returned to clients
export const entityOutSchema = {
  _id: v.id("entities"),
  _creationTime: v.number(),
  ...entityInSchema,
  userId: v.id("users"),
};
export const entityOutValidator = v.object(entityOutSchema);
export type EntityOutType = Infer<typeof entityOutValidator>;

// Table definition with indexes
export const entityTables = {
  entities: defineTable(entitySchema).index("by_user_id", ["userId"]),
};
```

---

## Main Schema File

```typescript
// convex/schema.ts
import { defineSchema } from "convex/server";
import { entityTables } from "./entity_schema";

export default defineSchema({
  ...entityTables,
});
```

---

## Index Design Rules

1. **Always use `.withIndex()` for equality checks** — never `.filter()` alone
2. **Put sort fields last** — `["parentId", "order"]` sorts by `order` within a `parentId`
3. **Don't create redundant indexes** — `by_foo` is redundant if `by_foo_bar` exists
4. **Include filter fields in search indexes**

---

## Schema Checklist

- [ ] Create `{domain}_schema.ts`
- [ ] Define input, update, internal, and output schemas
- [ ] Create validator objects and TypeScript types for each level
- [ ] Create table definition with `defineTable()`
- [ ] Add `by_user_id` index (or equivalent ownership index)
- [ ] Add compound indexes for common query + sort patterns
- [ ] Export table definition and add to main `schema.ts`

---

## Detailed Documentation

- [reference.md](reference.md) — Validator patterns, index types, TypeScript extraction
