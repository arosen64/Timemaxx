# Function Patterns

Helpers, queries, and mutations — the core building blocks of Convex functions.

---

## Helpers

Helpers are pure database operations without authentication logic. They live in `{domain}_helpers.ts`.

```typescript
// convex/{domain}_helpers.ts

import { ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import type {
  EntityInType,
  EntityUpdateType,
  EntityOutType,
} from "./entity_schema";

// ── READ OPERATIONS ──────────────────────────────────────────────

export async function getEntityById(
  ctx: QueryCtx,
  entityId: Id<"entities">,
): Promise<Doc<"entities">> {
  const entity = await ctx.db.get(entityId);
  if (!entity) {
    throw new ConvexError({
      message: `Entity ${entityId} not found`,
      code: 404,
    });
  }
  return entity;
}

export async function getAllEntities(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"entities">[]> {
  return ctx.db
    .query("entities")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
}

// ── WRITE OPERATIONS ─────────────────────────────────────────────

export async function createEntity(
  ctx: MutationCtx,
  userId: Id<"users">,
  data: EntityInType,
): Promise<Id<"entities">> {
  return ctx.db.insert("entities", { ...data, userId });
}

export async function updateEntity(
  ctx: MutationCtx,
  entityId: Id<"entities">,
  data: EntityUpdateType,
): Promise<void> {
  await ctx.db.patch(entityId, data);
}

export async function deleteEntity(
  ctx: MutationCtx,
  entityId: Id<"entities">,
): Promise<void> {
  await ctx.db.delete(entityId);
}

// ── CASCADE ──────────────────────────────────────────────────────

export async function deleteEntityWithCascade(
  ctx: MutationCtx,
  entityId: Id<"entities">,
): Promise<void> {
  const children = await ctx.db
    .query("children")
    .withIndex("by_entity_id", (q) => q.eq("entityId", entityId))
    .collect();
  await Promise.all(children.map((child) => ctx.db.delete(child._id)));
  await ctx.db.delete(entityId);
}

// ── TRANSFORMS ───────────────────────────────────────────────────

export function toEntityOut(entity: Doc<"entities">): EntityOutType {
  return {
    _id: entity._id,
    _creationTime: entity._creationTime,
    title: entity.title,
    description: entity.description,
    userId: entity.userId,
  };
}
```

---

## Queries

Queries are thin wrappers that compose guards and helpers. They live in `{domain}_queries.ts`.

```typescript
// convex/{domain}_queries.ts

import { v } from "convex/values";
import { queryWithAuth, AuthQueryCtx } from "./lib";
import { ownershipGuard } from "./entity_guards";
import { getAllEntities, getEntityById, toEntityOut } from "./entity_helpers";
import { entityOutValidator, EntityOutType } from "./entity_schema";

export const getAll = queryWithAuth({
  args: {},
  returns: v.array(entityOutValidator),
  handler: async (ctx: AuthQueryCtx): Promise<EntityOutType[]> => {
    const entities = await getAllEntities(ctx, ctx.userId);
    return entities.map(toEntityOut);
  },
});

export const getOne = queryWithAuth({
  args: { entityId: v.id("entities") },
  returns: entityOutValidator,
  handler: async (ctx: AuthQueryCtx, args): Promise<EntityOutType> => {
    const entity = await getEntityById(ctx, args.entityId);
    ownershipGuard(ctx.userId, entity.userId);
    return toEntityOut(entity);
  },
});
```

---

## Mutations

Mutations follow the same pattern with additional scheduling for async operations. They live in `{domain}_mutations.ts`.

```typescript
// convex/{domain}_mutations.ts

import { v } from "convex/values";
import { mutationWithAuth, AuthMutationCtx } from "./lib";
import { ownershipGuard } from "./entity_guards";
import {
  createEntity,
  updateEntity,
  deleteEntityWithCascade,
  getEntityById,
} from "./entity_helpers";
import { entityInSchema, entityUpdateSchema } from "./entity_schema";

export const create = mutationWithAuth({
  args: entityInSchema,
  returns: v.id("entities"),
  handler: async (ctx: AuthMutationCtx, args) => {
    return createEntity(ctx, ctx.userId, args);
  },
});

export const update = mutationWithAuth({
  args: { entityId: v.id("entities"), ...entityUpdateSchema },
  returns: v.boolean(),
  handler: async (ctx: AuthMutationCtx, args) => {
    const { entityId, ...data } = args;
    const entity = await getEntityById(ctx, entityId);
    ownershipGuard(ctx.userId, entity.userId);
    await updateEntity(ctx, entityId, data);
    return true;
  },
});

export const remove = mutationWithAuth({
  args: { entityId: v.id("entities") },
  returns: v.boolean(),
  handler: async (ctx: AuthMutationCtx, args) => {
    const entity = await getEntityById(ctx, args.entityId);
    ownershipGuard(ctx.userId, entity.userId);
    await deleteEntityWithCascade(ctx, args.entityId);
    return true;
  },
});
```

---

## Shared Utilities

See [convex-schema reference.md](../convex-schema/reference.md) for shared types (`paginationOptsValidator`, `SortOrder`) used across domains.
