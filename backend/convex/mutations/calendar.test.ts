import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
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

describe("mutations/calendar – updateCalendarToken", () => {
  test("updates accessToken and expiresAt without touching refreshToken or selectedCalendarIds", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "old-acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 1000,
        selectedCalendarIds: ["cal-1"],
      })
    );

    const newExpiry = Date.now() + 3600_000;
    await t.mutation(internal.mutations.calendar.updateCalendarToken, {
      userId,
      accessToken: "new-acc",
      expiresAt: newExpiry,
    });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(record!.accessToken).toBe("new-acc");
    expect(record!.expiresAt).toBe(newExpiry);
    expect(record!.refreshToken).toBe("ref");
    expect(record!.selectedCalendarIds).toEqual(["cal-1"]);
  });

  test("is a no-op when no calendarConnections record exists", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.mutation(internal.mutations.calendar.updateCalendarToken, {
        userId,
        accessToken: "new-acc",
        expiresAt: Date.now() + 3600_000,
      })
    ).resolves.not.toThrow();
  });
});

describe("mutations/calendar – saveSelectedCalendars", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.mutation(api.mutations.calendar.saveSelectedCalendars, {
        selectedCalendarIds: ["cal-1"],
      })
    ).rejects.toThrow("Not authenticated");
  });

  test("writes selectedCalendarIds to the calendarConnections record", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 3600_000,
      })
    );

    await withAuth.mutation(api.mutations.calendar.saveSelectedCalendars, {
      selectedCalendarIds: ["cal-1", "cal-2"],
    });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(record!.selectedCalendarIds).toEqual(["cal-1", "cal-2"]);
  });

  test("overwrites a previous selection", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 3600_000,
        selectedCalendarIds: ["cal-old"],
      })
    );

    await withAuth.mutation(api.mutations.calendar.saveSelectedCalendars, {
      selectedCalendarIds: ["cal-1"],
    });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(record!.selectedCalendarIds).toEqual(["cal-1"]);
  });
});
