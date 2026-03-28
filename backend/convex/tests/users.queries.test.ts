import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

describe("queries/users – getCurrUser", () => {
  test("returns null when unauthenticated", async () => {
    const t = makeTestCtx();
    const result = await t.query(api.queries.users.getCurrUser, {});
    expect(result).toBeNull();
  });

  test("returns the current user when authenticated", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t, {
      name: "Alice",
      email: "alice@example.com",
    });

    const result = await withAuth.query(api.queries.users.getCurrUser, {});
    expect(result).not.toBeNull();
    expect(result!._id).toBe(userId);
    expect(result!.name).toBe("Alice");
    expect(result!.email).toBe("alice@example.com");
  });
});

describe("queries/users – isOnboardingComplete", () => {
  test("returns null when unauthenticated", async () => {
    const t = makeTestCtx();
    const result = await t.query(
      api.queries.users.isOnboardingComplete,
      {}
    );
    expect(result).toBeNull();
  });

  test("returns false when user has not completed onboarding", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const result = await withAuth.query(
      api.queries.users.isOnboardingComplete,
      {}
    );
    expect(result).toBe(false);
  });

  test("returns true after onboarding is completed", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    // Patch the user directly to simulate completed onboarding
    await t.run((ctx) =>
      ctx.db.patch(userId, { onboardingComplete: true })
    );

    const result = await withAuth.query(
      api.queries.users.isOnboardingComplete,
      {}
    );
    expect(result).toBe(true);
  });
});
