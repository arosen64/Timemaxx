import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

const VALID_ONBOARDING_ARGS = {
  major: "Computer Science",
  year: "Junior",
  workHoursGrid: [{ day: "Monday" as const, blocked: [] as number[] }],
  productivityTraits: { timeOfDay: ["Morning"] },
  focusBlockLength: 50,
};

describe("mutations/users – deleteAccount", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(t.mutation(api.mutations.users.deleteAccount, {})).rejects.toThrow(
      "Not authenticated"
    );
  });

  test("deletes the user record", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toBeNull();
  });

  test("deletes all tasks belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", {
        userId,
        title: "Task 1",
        description: "desc",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
        isManualEstimate: false,
        status: "not_started",
      });
      await ctx.db.insert("tasks", {
        userId,
        title: "Task 2",
        description: "desc",
        taskType: "Coding",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
        isManualEstimate: false,
        status: "not_started",
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const tasks = await t.run((ctx) =>
      ctx.db
        .query("tasks")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(tasks).toHaveLength(0);
  });

  test("deletes all syllabi belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("syllabi", {
        userId,
        fileContents: "cs101 syllabus text",
        status: "confirmed",
        createdAt: Date.now(),
      });
      await ctx.db.insert("syllabi", {
        userId,
        fileContents: "math201 syllabus text",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const syllabi = await t.run((ctx) =>
      ctx.db
        .query("syllabi")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(syllabi).toHaveLength(0);
  });

  test("deletes all authAccounts belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "google-123",
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const accounts = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(accounts).toHaveLength(0);
  });

  test("deletes all authSessions belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86_400_000,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const sessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(sessions).toHaveLength(0);
  });

  test("deletes all userCourses belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("userCourses", {
        userId,
        courseCode: "EN.601.421",
        title: "EN.601.421: Object-Oriented Software Engineering",
        term: "Spring 2026",
        studyGoal: "Do well",
      });
      await ctx.db.insert("userCourses", {
        userId,
        courseCode: "EN.601.226",
        title: "EN.601.226: Data Structures",
        term: "Fall 2025",
        grade: "A",
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const userCourses = await t.run((ctx) =>
      ctx.db
        .query("userCourses")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(userCourses).toHaveLength(0);
  });

  test("deletes all chatMessages belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("chatMessages", {
        userId,
        role: "user",
        content: "hello",
        createdAt: Date.now(),
      });
      await ctx.db.insert("chatMessages", {
        userId,
        role: "assistant",
        content: "hi there",
        createdAt: Date.now() + 1,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const messages = await t.run((ctx) =>
      ctx.db
        .query("chatMessages")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(messages).toHaveLength(0);
  });

  test("deletes all chatSessions belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("chatSessions", {
        userId,
        sessionId: "session-1",
      });
      await ctx.db.insert("chatSessions", {
        userId,
        sessionId: "session-2",
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const sessions = await t.run((ctx) =>
      ctx.db
        .query("chatSessions")
        .withIndex("by_userId_sessionId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(sessions).toHaveLength(0);
  });

  test("deletes all chatChunks belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("chatChunks", {
        userId,
        sessionId: "session-1",
        text: "chunk text",
        chunkIndex: 0,
        startCreatedAt: Date.now(),
        linkedTaskIds: [],
        linkedCourseIds: [],
        createdAt: Date.now(),
      });
      await ctx.db.insert("chatChunks", {
        userId,
        sessionId: "session-1",
        text: "chunk text 2",
        chunkIndex: 1,
        startCreatedAt: Date.now() + 1,
        linkedTaskIds: [],
        linkedCourseIds: [],
        createdAt: Date.now() + 1,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const chunks = await t.run((ctx) =>
      ctx.db
        .query("chatChunks")
        .withIndex("by_userId_sessionId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(chunks).toHaveLength(0);
  });

  test("deletes all calendarConnections belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("calendarConnections", {
        userId,
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600_000,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const connections = await t.run((ctx) =>
      ctx.db
        .query("calendarConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(connections).toHaveLength(0);
  });

  test("deletes all calendarOAuthStates belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("calendarOAuthStates", {
        userId,
        state: "state-abc",
        expiresAt: Date.now() + 600_000,
      });
      await ctx.db.insert("calendarOAuthStates", {
        userId,
        state: "state-xyz",
        expiresAt: Date.now() + 600_000,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const states = await t.run((ctx) =>
      ctx.db
        .query("calendarOAuthStates")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect()
    );
    expect(states).toHaveLength(0);
  });

  test("deletes orphaned studyBlocks belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("studyBlocks", {
        userId,
        title: "Orphaned block",
        studyBlockLength: 50,
        isCompleted: false,
        isConflicted: false,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const blocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(blocks).toHaveLength(0);
  });

  test("deletes authVerificationCodes linked to the user's accounts", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      const accountId = await ctx.db.insert("authAccounts", {
        userId,
        provider: "resend-otp",
        providerAccountId: "user@example.com",
      });
      await ctx.db.insert("authVerificationCodes", {
        accountId,
        provider: "resend-otp",
        code: "123456",
        expirationTime: Date.now() + 600_000,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const accounts = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(accounts).toHaveLength(0);

    const codes = await t.run((ctx) => ctx.db.query("authVerificationCodes").collect());
    expect(codes).toHaveLength(0);
  });

  test("deletes authRefreshTokens linked to the user's sessions", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86_400_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 86_400_000,
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const sessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(sessions).toHaveLength(0);

    const tokens = await t.run((ctx) => ctx.db.query("authRefreshTokens").collect());
    expect(tokens).toHaveLength(0);
  });

  test("only deletes data belonging to the authenticated user", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const { userId: otherUserId } = await createTestUser(t, { email: "other@example.com" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", {
        userId: otherUserId,
        title: "Other user task",
        description: "desc",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
        isManualEstimate: false,
        status: "not_started",
      });
      await ctx.db.insert("syllabi", {
        userId: otherUserId,
        fileContents: "other syllabus text",
        status: "confirmed",
        createdAt: Date.now(),
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const otherTasks = await t.run((ctx) =>
      ctx.db
        .query("tasks")
        .withIndex("by_userId", (q) => q.eq("userId", otherUserId))
        .collect()
    );
    const otherSyllabi = await t.run((ctx) =>
      ctx.db
        .query("syllabi")
        .withIndex("by_userId", (q) => q.eq("userId", otherUserId))
        .collect()
    );
    expect(otherTasks).toHaveLength(1);
    expect(otherSyllabi).toHaveLength(1);
  });
});

describe("mutations/users – updateUserSettings", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.mutation(api.mutations.users.updateUserSettings, { focusBlockLength: 45 })
    ).rejects.toThrow("Not authenticated");
  });

  test("throws when focusBlockLength is zero or negative", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.mutation(api.mutations.users.updateUserSettings, { focusBlockLength: 0 })
    ).rejects.toThrow("focusBlockLength must be a positive number");

    await expect(
      withAuth.mutation(api.mutations.users.updateUserSettings, { focusBlockLength: -10 })
    ).rejects.toThrow("focusBlockLength must be a positive number");
  });

  test("updates a single field", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      focusBlockLength: 45,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.focusBlockLength).toBe(45);
  });

  test("updates multiple fields at once", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      major: "Biology",
      year: "Senior",
      focusBlockLength: 60,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.major).toBe("Biology");
    expect(user!.year).toBe("Senior");
    expect(user!.focusBlockLength).toBe(60);
  });

  test("updates workHoursGrid", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const grid = [{ day: "Monday" as const, blocked: [8] }];
    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      workHoursGrid: grid,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.workHoursGrid).toEqual(grid);
  });

  test("does not affect unspecified fields", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.completeOnboarding, VALID_ONBOARDING_ARGS);
    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      focusBlockLength: 30,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.major).toBe("Computer Science");
    expect(user!.year).toBe("Junior");
    expect(user!.focusBlockLength).toBe(30);
  });

  test("sets gcalColorMappingEnabled to true", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      gcalColorMappingEnabled: true,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.gcalColorMappingEnabled).toBe(true);
  });

  test("sets gcalColorMappingEnabled to false", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run((ctx) => ctx.db.patch(userId, { gcalColorMappingEnabled: true }));

    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      gcalColorMappingEnabled: false,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.gcalColorMappingEnabled).toBe(false);
  });

  test("does not affect other fields when only gcalColorMappingEnabled is updated", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.completeOnboarding, VALID_ONBOARDING_ARGS);
    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      gcalColorMappingEnabled: true,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.major).toBe("Computer Science");
    expect(user!.focusBlockLength).toBe(50);
    expect(user!.gcalColorMappingEnabled).toBe(true);
  });
});

describe("mutations/users – completeOnboarding", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.mutation(api.mutations.users.completeOnboarding, VALID_ONBOARDING_ARGS)
    ).rejects.toThrow("Not authenticated");
  });

  test("throws when major is empty or whitespace", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.mutation(api.mutations.users.completeOnboarding, {
        ...VALID_ONBOARDING_ARGS,
        major: "   ",
      })
    ).rejects.toThrow("Major cannot be empty");
  });

  test("sets onboardingComplete to true on the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.completeOnboarding, VALID_ONBOARDING_ARGS);

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.onboardingComplete).toBe(true);
  });

  test("persists all onboarding fields on the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(api.mutations.users.completeOnboarding, VALID_ONBOARDING_ARGS);

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.major).toBe("Computer Science");
    expect(user!.year).toBe("Junior");
    expect(user!.focusBlockLength).toBe(50);
  });
});
