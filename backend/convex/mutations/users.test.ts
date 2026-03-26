import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

const VALID_ONBOARDING_ARGS = {
  major: "Computer Science",
  year: "Junior",
  difficultSubjects: ["Math", "Physics"],
  enjoyedSubjects: ["History"],
  courses: [{ title: "CS101", studyGoal: "A" }],
  workHoursGrid: [
    { day: "Monday", available: [9, 10, 11], blocked: [] },
  ],
  productivityTraits: { morningPerson: true },
  focusBlockLength: 50,
};

describe("mutations/users – deleteAccount", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.mutation(api.mutations.users.deleteAccount, {})
    ).rejects.toThrow("Not authenticated");
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
      });
      await ctx.db.insert("tasks", {
        userId,
        title: "Task 2",
        description: "desc",
        taskType: "Coding",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const tasks = await t.run((ctx) =>
      ctx.db.query("tasks").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()
    );
    expect(tasks).toHaveLength(0);
  });

  test("deletes all syllabi belonging to the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("syllabi", {
        userId,
        fileName: "cs101.pdf",
        courseName: "CS 101",
        status: "confirmed",
        createdAt: Date.now(),
      });
      await ctx.db.insert("syllabi", {
        userId,
        fileName: "math201.pdf",
        courseName: "Math 201",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const syllabi = await t.run((ctx) =>
      ctx.db.query("syllabi").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()
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
      ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).collect()
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
      ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).collect()
    );
    expect(sessions).toHaveLength(0);
  });

  test("only deletes data belonging to the authenticated user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { userId: otherUserId } = await createTestUser(t, { email: "other@example.com" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", {
        userId: otherUserId,
        title: "Other user task",
        description: "desc",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
      });
      await ctx.db.insert("syllabi", {
        userId: otherUserId,
        fileName: "other.pdf",
        courseName: "Other Course",
        status: "confirmed",
        createdAt: Date.now(),
      });
    });

    await withAuth.mutation(api.mutations.users.deleteAccount, {});

    const otherTasks = await t.run((ctx) =>
      ctx.db.query("tasks").withIndex("by_userId", (q) => q.eq("userId", otherUserId)).collect()
    );
    const otherSyllabi = await t.run((ctx) =>
      ctx.db.query("syllabi").withIndex("by_userId", (q) => q.eq("userId", otherUserId)).collect()
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

    const grid = [{ day: "Monday", available: [9, 10], blocked: [8] }];
    await withAuth.mutation(api.mutations.users.updateUserSettings, {
      workHoursGrid: grid,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.workHoursGrid).toEqual(grid);
  });

  test("updates courses field", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const courses = [
      { title: "CS101", studyGoal: "A" },
      { title: "Math201", studyGoal: "B+" },
    ];
    await withAuth.mutation(api.mutations.users.updateUserSettings, { courses });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.courses).toEqual(courses);
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

    await withAuth.mutation(
      api.mutations.users.completeOnboarding,
      VALID_ONBOARDING_ARGS
    );

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.onboardingComplete).toBe(true);
  });

  test("persists all onboarding fields on the user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    await withAuth.mutation(
      api.mutations.users.completeOnboarding,
      VALID_ONBOARDING_ARGS
    );

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.major).toBe("Computer Science");
    expect(user!.year).toBe("Junior");
    expect(user!.difficultSubjects).toEqual(["Math", "Physics"]);
    expect(user!.enjoyedSubjects).toEqual(["History"]);
    expect(user!.courses).toEqual([{ title: "CS101", studyGoal: "A" }]);
    expect(user!.focusBlockLength).toBe(50);
  });
});
