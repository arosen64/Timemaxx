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
  test("updates accessToken and expiresAt without touching refreshToken, selectedCalendarIds, or scope", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "old-acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 1000,
        selectedCalendarIds: ["cal-1"],
        scope: "https://www.googleapis.com/auth/calendar.events",
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
    expect(record!.scope).toBe("https://www.googleapis.com/auth/calendar.events");
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

describe("mutations/calendar – storeCalendarTokenForUser", () => {
  test("stores a token with scope for the given user", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.mutation(internal.mutations.calendar.storeCalendarTokenForUser, {
      userId,
      accessToken: "enc-acc",
      refreshToken: "enc-ref",
      expiresAt: Date.now() + 3600_000,
      scope: "https://www.googleapis.com/auth/calendar",
    });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(record).not.toBeNull();
    expect(record!.scope).toBe("https://www.googleapis.com/auth/calendar");
  });

  test("stores timemaxxCalendarId as dedicated field and initial selectedCalendarIds when provided", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.mutation(internal.mutations.calendar.storeCalendarTokenForUser, {
      userId,
      accessToken: "enc-acc",
      refreshToken: "enc-ref",
      expiresAt: Date.now() + 3600_000,
      scope: "https://www.googleapis.com/auth/calendar",
      timemaxxCalendarId: "timemaxx-cal-id",
    });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(record!.timemaxxCalendarId).toBe("timemaxx-cal-id");
    expect(record!.selectedCalendarIds).toEqual(["timemaxx-cal-id"]);
  });

  test("does not set selectedCalendarIds when timemaxxCalendarId is omitted", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.mutation(internal.mutations.calendar.storeCalendarTokenForUser, {
      userId,
      accessToken: "enc-acc",
      refreshToken: "enc-ref",
      expiresAt: Date.now() + 3600_000,
    });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(record!.selectedCalendarIds).toBeUndefined();
  });

  test("overwrites an existing token and updates selectedCalendarIds on re-connect", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "old-acc",
        refreshToken: "old-ref",
        expiresAt: Date.now() + 1000,
      })
    );

    await t.mutation(internal.mutations.calendar.storeCalendarTokenForUser, {
      userId,
      accessToken: "new-acc",
      refreshToken: "new-ref",
      expiresAt: Date.now() + 3600_000,
      scope: "https://www.googleapis.com/auth/calendar",
      timemaxxCalendarId: "new-timemaxx-id",
    });

    const records = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );

    expect(records).toHaveLength(1);
    expect(records[0].accessToken).toBe("new-acc");
    expect(records[0].scope).toBe("https://www.googleapis.com/auth/calendar");
    expect(records[0].timemaxxCalendarId).toBe("new-timemaxx-id");
    expect(records[0].selectedCalendarIds).toEqual(["new-timemaxx-id"]);
  });
});

describe("mutations/calendar – deleteCalendarTokenForUser", () => {
  test("removes the token record for the given userId", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 3600_000,
      })
    );

    await t.mutation(internal.mutations.calendar.deleteCalendarTokenForUser, { userId });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );

    expect(record).toBeNull();
  });

  test("is a no-op when no token exists for the user", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.mutation(internal.mutations.calendar.deleteCalendarTokenForUser, { userId })
    ).resolves.not.toThrow();
  });

  test("does not remove a different user's token", async () => {
    const t = makeTestCtx();
    const { userId: user1Id } = await createTestUser(t);
    const { userId: user2Id } = await createTestUser(t, { email: "other@example.com" });

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId: user1Id,
        accessToken: "acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 3600_000,
      })
    );

    await t.mutation(internal.mutations.calendar.deleteCalendarTokenForUser, { userId: user2Id });

    const record = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", user1Id))
        .unique()
    );

    expect(record).not.toBeNull();
  });

  test("resets gcalColorMappingEnabled to false on the user record", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.run((ctx) => ctx.db.patch(userId, { gcalColorMappingEnabled: true }));
    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "acc",
        refreshToken: "ref",
        expiresAt: Date.now() + 3600_000,
      })
    );

    await t.mutation(internal.mutations.calendar.deleteCalendarTokenForUser, { userId });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.gcalColorMappingEnabled).toBe(false);
  });

  test("resets gcalColorMappingEnabled even when no connection record exists", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await t.run((ctx) => ctx.db.patch(userId, { gcalColorMappingEnabled: true }));

    await t.mutation(internal.mutations.calendar.deleteCalendarTokenForUser, { userId });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.gcalColorMappingEnabled).toBe(false);
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
