import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

describe("mutations/calendar – storeCalendarToken", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.mutation(api.mutations.calendar.storeCalendarToken, {
        accessToken: "acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 3600_000,
      })
    ).rejects.toThrow("Not authenticated");
  });

  test("stores a token for the authenticated user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.calendar.storeCalendarToken, {
      accessToken: "acc",
      refreshToken: "ref",
      expiresAt: Date.now() + 3600_000,
    });

    const token = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(token).not.toBeNull();
    expect(token!.accessToken).toBe("acc");
    expect(token!.refreshToken).toBe("ref");
  });

  test("overwrites an existing token on re-connect", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.calendar.storeCalendarToken, {
      accessToken: "acc-v1",
      refreshToken: "ref-v1",
      expiresAt: Date.now() + 3600_000,
    });

    await withAuth.mutation(api.mutations.calendar.storeCalendarToken, {
      accessToken: "acc-v2",
      refreshToken: "ref-v2",
      expiresAt: Date.now() + 7200_000,
    });

    const tokens = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );

    expect(tokens).toHaveLength(1);
    expect(tokens[0].accessToken).toBe("acc-v2");
    expect(tokens[0].refreshToken).toBe("ref-v2");
  });
});

describe("mutations/calendar – deleteCalendarToken", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.mutation(api.mutations.calendar.deleteCalendarToken, {})
    ).rejects.toThrow("Not authenticated");
  });

  test("removes the token record for the authenticated user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.calendar.storeCalendarToken, {
      accessToken: "acc",
      refreshToken: "ref",
      expiresAt: Date.now() + 3600_000,
    });

    await withAuth.mutation(api.mutations.calendar.deleteCalendarToken, {});

    const token = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(token).toBeNull();
  });

  test("is a no-op when no token exists", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.mutation(api.mutations.calendar.deleteCalendarToken, {})
    ).resolves.not.toThrow();
  });
});
