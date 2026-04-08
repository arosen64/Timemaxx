# Custom Auth Wrappers

Wrapper functions that inject authentication context into every public function.

---

## Implementation

```typescript
// convex/lib.ts

import {
  customQuery,
  customMutation,
  customAction,
} from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";
import {
  query,
  mutation,
  action,
  QueryCtx,
  MutationCtx,
  ActionCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Context types with authenticated user
export type AuthQueryCtx = QueryCtx & { userId: Id<"users"> };
export type AuthMutationCtx = MutationCtx & { userId: Id<"users"> };
export type AuthActionCtx = ActionCtx & { userId: Id<"users"> };

/**
 * Query that requires authentication.
 * Injects ctx.userId for use in handler.
 */
export const queryWithAuth = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ message: "Not authenticated", code: 401 });
    }
    return { ctx: { ...ctx, userId }, args: {} };
  },
});

/**
 * Mutation that requires authentication.
 * Injects ctx.userId for use in handler.
 */
export const mutationWithAuth = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ message: "Not authenticated", code: 401 });
    }
    return { ctx: { ...ctx, userId }, args: {} };
  },
});

/**
 * Action that requires authentication.
 * Injects ctx.userId for use in handler.
 */
export const actionWithAuth = customAction(action, {
  args: {},
  input: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ message: "Not authenticated", code: 401 });
    }
    return { ctx: { ...ctx, userId }, args: {} };
  },
});

// Re-export standard functions for unauthenticated endpoints
export { query, mutation, action } from "./_generated/server";
export {
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
```

---

## Dependencies

```json
{
  "convex-helpers": "^0.1.78",
  "@convex-dev/auth": "^0.0.80"
}
```

`convex-helpers` provides `customQuery`, `customMutation`, `customAction`.

### Auth Provider Adaptation

The example above uses `@convex-dev/auth`. Swap the auth check for your provider:

```typescript
// @convex-dev/auth:
const userId = await getAuthUserId(ctx);

// Clerk:
const identity = await ctx.auth.getUserIdentity();
const userId = identity?.subject;

// Custom JWT:
const identity = await ctx.auth.getUserIdentity();
const userId = identity?.tokenIdentifier;
```

---

## Usage

```typescript
import { queryWithAuth, AuthQueryCtx } from "./lib";

export const getAll = queryWithAuth({
  args: {},
  returns: v.array(entityOutValidator),
  handler: async (ctx: AuthQueryCtx, args) => {
    // ctx.userId is guaranteed to exist
    const entities = await getAllEntities(ctx, ctx.userId);
    return entities.map(toEntityOut);
  },
});
```
