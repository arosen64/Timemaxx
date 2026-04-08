---
name: convex-guards
description: Authorization patterns for Convex backends. Use when adding access control to queries or mutations, implementing ownership guards, role-based authorization, auditing for missing server-side authorization, or reviewing security of Convex functions.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex Authorization Guards

Server-side authorization patterns for Convex backends. Prevents the most common security flaw: **client-side-only authorization** where the UI hides controls but the backend accepts any call.

## Related Skills

- **[convex-functions](../convex-functions/SKILL.md)** — Query/mutation composition that uses guards
- **[convex-schema](../convex-schema/SKILL.md)** — Schema-level ownership fields guards depend on
- **[convex-architecture](../convex-architecture/SKILL.md)** — Where guard files fit in the domain structure
- **[convex-testing](../convex-testing/SKILL.md)** — Testing authorization logic

---

## The Core Problem

Convex exposes all public functions via a WebSocket API. Any authenticated user can call any `query()` or `mutation()` from the browser console. If functions don't check **who** is calling and **what they can do**, any logged-in user can read or modify other users' data.

**The UI is not a security boundary.** Every public Convex function must enforce authorization server-side.

---

## Authentication vs Authorization

```plaintext
Authentication (WHO are you?)          Authorization (WHAT can you do?)
─────────────────────────────          ─────────────────────────────────
queryWithAuth / mutationWithAuth       Guard functions
Proves: "This is user X"              Proves: "User X can do Y on resource Z"
Rejects: anonymous callers             Rejects: authenticated but unauthorized callers
Handled by: lib.ts wrappers           Handled by: {domain}_guards.ts
```

Both layers are required. A function using `queryWithAuth` without a guard is still vulnerable — it just means the attacker needs to be logged in.

---

## Guard Patterns

### Ownership Guard

The most common guard — verifies the caller owns the resource:

```typescript
// convex/{domain}_guards.ts
import { ConvexError } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";

type AnyCtx = QueryCtx | MutationCtx;

export function ownershipGuard(
  userId: Id<"users">,
  resourceOwnerId: Id<"users">,
): void {
  if (resourceOwnerId !== userId) {
    throw new ConvexError({ message: "Not authorized", code: 403 });
  }
}
```

### Resource Guard (Fetch + Verify)

Returns the fetched resource to avoid a redundant `ctx.db.get`:

```typescript
export async function requireResourceOwner(
  ctx: AnyCtx & { userId: Id<"users"> },
  resourceId: Id<"resources">,
): Promise<Doc<"resources">> {
  const resource = await ctx.db.get(resourceId);
  if (!resource) {
    throw new ConvexError({ code: 404, message: "Resource not found" });
  }
  if (resource.userId !== ctx.userId) {
    throw new ConvexError({ code: 403, message: "Not authorized" });
  }
  return resource;
}
```

### Role-Based Guard

For resources with role-based access (admin, owner, member):

```typescript
export async function requireResourceOwnerOrAdmin(
  ctx: AnyCtx & { userId: Id<"users"> },
  resourceId: Id<"resources">,
): Promise<{ resource: Doc<"resources">; isAdmin: boolean }> {
  const resource = await ctx.db.get(resourceId);
  if (!resource) {
    throw new ConvexError({ code: 404, message: "Resource not found" });
  }

  const user = await ctx.db.get(ctx.userId);
  if (user?.role === "admin") {
    return { resource, isAdmin: true };
  }

  if (resource.userId !== ctx.userId) {
    throw new ConvexError({ code: 403, message: "Not authorized" });
  }

  return { resource, isAdmin: false };
}
```

---

## Key Principles

1. **Call the guard before any work in the handler** — guards themselves fetch the resource internally
2. **Guards return the resource** — avoids redundant `ctx.db.get` calls
3. **Throw ConvexError with codes** — `401` (not authenticated), `403` (not authorized), `404` (not found)
4. **Never trust client-supplied values** — always resolve roles/permissions server-side
5. **Internal functions skip guards** — `internalMutation`/`internalQuery` are not publicly callable

---

## Applying Guards

```typescript
// Guard first in queries
export const getOne = queryWithAuth({
  args: { entityId: v.id("entities") },
  handler: async (ctx, args) => {
    const entity = await requireResourceOwner(ctx, args.entityId);
    return toEntityOut(entity);
  },
});

// Guard first in mutations
export const update = mutationWithAuth({
  args: { entityId: v.id("entities"), title: v.string() },
  handler: async (ctx, args) => {
    const entity = await requireResourceOwner(ctx, args.entityId);
    await ctx.db.patch(entity._id, { title: args.title });
  },
});
```

---

## Anti-Patterns

| Anti-Pattern                                  | Why It's Wrong                       |
| --------------------------------------------- | ------------------------------------ |
| Trusting client-supplied `role` or `viewType` | Attacker sends `role: "admin"`       |
| Fetching data before checking guard           | Data leaked even if guard throws     |
| Skipping guards on "read-only" queries        | Queries leak private data            |
| Using `api.*` for scheduled functions         | Exposes internal operations publicly |

---

## Audit Checklist

- [ ] Every public `query`/`mutation` calls a guard before returning data or mutating
- [ ] No function trusts a client-supplied role or permission
- [ ] Mutations accepting a `userId` arg verify it matches the authenticated caller
- [ ] Queries returning lists filter results by the caller's permissions
- [ ] `internalMutation`/`internalQuery` skip guards — they're not publicly callable
- [ ] Scheduled operations use `internal.*`, not `api.*`
