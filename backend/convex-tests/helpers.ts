/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "../convex/schema";

// import.meta.glob paths are relative to THIS file (backend/convex-tests/).
// "../convex/" puts us at backend/convex/, where the _generated directory lives.
// convex-test uses the presence of "_generated" in a key to find the root prefix.
const modules = import.meta.glob("../convex/**/*.*s");

export type TestInstance = ReturnType<typeof makeTestCtx>;

/**
 * Creates a convexTest instance with the project schema.
 */
export function makeTestCtx() {
  return convexTest(schema, modules);
}

/**
 * Inserts a test user into the database and returns a context scoped to that
 * user's identity, mimicking @convex-dev/auth's getAuthUserId behaviour.
 *
 * getAuthUserId splits identity.subject on "|" and returns the first segment,
 * so passing the userId as the subject is sufficient.
 */
export async function createTestUser(
  t: TestInstance,
  overrides: { name?: string; email?: string } = {}
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? "test@example.com",
    });
  });

  const withAuth = t.withIdentity({ subject: userId });
  return { userId, withAuth };
}
