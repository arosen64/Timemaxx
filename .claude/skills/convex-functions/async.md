# Async Operations & Internal Functions

Patterns for external API calls, long-running operations, and internal functions.

---

## When Do You Need Internal Functions?

Actions cannot access `ctx.db` directly. They must use `ctx.runQuery()` and `ctx.runMutation()`. You need internal functions when:

| Scenario                   | Why                                                     |
| -------------------------- | ------------------------------------------------------- |
| **Async operations**       | Action needs to update DB after external call completes |
| **Seeding**                | Seed scripts run as actions without user auth           |
| **HTTP endpoints**         | HTTP handlers are actions, can't access `ctx.db`        |
| **Scheduled tasks**        | Scheduled functions run without original user context   |
| **Vector/semantic search** | `ctx.vectorSearch()` only available in actions          |

If your domain is purely synchronous CRUD with no external integrations, you don't need `_internals.ts`.

---

## Pending State Pattern

For external API calls, use a "pending" marker:

### 1. Schema Field

```typescript
// undefined = not started, "pending" = in progress, value = complete
externalId: v.optional(v.string()),
```

### 2. Mutation — Schedule Async Work

```typescript
export const create = mutationWithAuth({
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("entities", {
      ...args,
      userId: ctx.userId,
      externalId: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.external_api.createResource, {
      entityId: id,
    });

    return id;
  },
});
```

### 3. Internal Action — Perform External Call

```typescript
export const createResource = internalAction({
  args: { entityId: v.id("entities") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resource = await externalApi.create({});

    await ctx.runMutation(internal.entity_internals.updateExternalId, {
      entityId: args.entityId,
      externalId: resource.id,
    });

    return null;
  },
});
```

### 4. Check State Before Using

```typescript
if (entity.externalId && entity.externalId !== "pending") {
  // Safe to use
}
```

---

## Internal Functions

Internal functions are not publicly callable. Used by scheduled actions, seeding, and other server-side operations.

```typescript
// convex/{domain}_internals.ts

import { v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getEntityById } from "./entity_helpers";

export const getById = internalQuery({
  args: { entityId: v.id("entities") },
  handler: async (ctx, args) => {
    return getEntityById(ctx, args.entityId);
  },
});

export const updateExternalId = internalMutation({
  args: {
    entityId: v.id("entities"),
    externalId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entityId, { externalId: args.externalId });
    return null;
  },
});
```

---

## Why Actions Can't Access ctx.db

```typescript
// WRONG — ctx.db doesn't exist in actions
export const myAction = internalAction({
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.entityId); // Error!
  },
});

// CORRECT — use internal query
export const myAction = internalAction({
  handler: async (ctx, args) => {
    const entity = await ctx.runQuery(internal.entity_internals.getById, {
      entityId: args.entityId,
    });
  },
});
```

---

## Scheduling Rules

- Always use `internal.*` for scheduled functions, never `api.*`
- Always `await` the scheduler call
- Don't chain multiple `ctx.runMutation` calls expecting transaction guarantees — batch into a single mutation
