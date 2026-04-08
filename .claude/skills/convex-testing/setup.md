# Test Setup

## Required Dependencies

```bash
pnpm add -D convex-test vitest @edge-runtime/vm
```

## Configuration

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
});
```

### package.json Scripts

```json
{
  "scripts": {
    "test:convex": "vitest --config convex/vitest.config.ts",
    "test:convex:once": "vitest run --config convex/vitest.config.ts"
  }
}
```

---

## Test Setup File

### convex/test.setup.ts

```typescript
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

// Export all convex modules for testing
export const modules = import.meta.glob("./**/*.ts");

/**
 * Create an authenticated test user.
 *
 * Works with @convex-dev/auth's getAuthUserId by encoding
 * the userId in the identity subject.
 */
export async function createTestUser(
  t: ReturnType<typeof convexTest>,
  name: string,
) {
  const userId = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase()}@test.com`,
    });
  });

  // @convex-dev/auth's getAuthUserId extracts userId from identity.subject
  // Format: "userId|sessionId" — splits on "|" and takes first part
  const sessionId = `session-${Date.now()}-${Math.random()}`;
  const subject = `${userId}|${sessionId}`;
  const tokenIdentifier = `test|${subject}`;

  const asUser = t.withIdentity({
    name,
    subject,
    tokenIdentifier,
    issuer: "test",
  });

  return { userId, asUser };
}

/**
 * Type helper for test user.
 */
export type TestUser = {
  userId: Id<"users">;
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;
};
```

The `subject` field MUST contain the actual Convex user ID as its first segment (before the `|` delimiter). The `getAuthUserId` function parses this to get the userId. Adapt this helper if using a different auth provider.
