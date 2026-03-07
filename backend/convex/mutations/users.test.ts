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
