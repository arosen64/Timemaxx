import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

describe("queries/calendar – getCalendarConnectionStatus", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.query(api.queries.calendar.getCalendarConnectionStatus, {})
    ).rejects.toThrow("Not authenticated");
  });

  test("returns not connected when no token exists", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const result = await withAuth.query(
      api.queries.calendar.getCalendarConnectionStatus,
      {}
    );

    expect(result.connected).toBe(false);
  });

  test("returns connected when a token exists", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "enc-acc",
        refreshToken: "enc-ref",
        expiresAt: Date.now() + 3600_000,
      })
    );

    const result = await withAuth.query(
      api.queries.calendar.getCalendarConnectionStatus,
      {}
    );

    expect(result.connected).toBe(true);
  });

  test("does not return connected status for a different user's token", async () => {
    const t = makeTestCtx();
    const { userId: user1Id } = await createTestUser(t);
    const { withAuth: user2Auth } = await createTestUser(t, { email: "other@example.com" });

    await t.run((ctx) =>
      ctx.db.insert("calendarConnections", {
        userId: user1Id,
        accessToken: "enc-acc",
        refreshToken: "enc-ref",
        expiresAt: Date.now() + 3600_000,
      })
    );

    const result = await user2Auth.query(
      api.queries.calendar.getCalendarConnectionStatus,
      {}
    );

    expect(result.connected).toBe(false);
  });
});
