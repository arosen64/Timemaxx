import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser, TestInstance } from "../../convex-tests/helpers";
import { COURSE_COLOR_PALETTE } from "../lib/courseColors";
import { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.*s");

const FUTURE = Date.now() + 86_400_000;

describe("mutations/userCourses – addUserCourse", () => {
  test("assigns a color from the palette when a course is created", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const userCourseId = await withAuth.mutation(api.mutations.userCourses.addUserCourse, {
      courseCode: "EN.601.226",
      title: "Data Structures",
      term: "Fall 2025",
    });

    const record = await t.run((ctx) => ctx.db.get(userCourseId));
    expect(record).not.toBeNull();
    expect(record!.color).toBeDefined();
    expect(COURSE_COLOR_PALETTE).toContain(record!.color);
  });
});

describe("mutations/userCourses – deleteUserCourse", () => {
  test("deletes tasks and study blocks linked to the course, then the course", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const userCourseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226.FA25",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    const otherCourseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.421.SP26",
        title: "OOSE",
        term: "Spring 2026",
      })
    );

    const taskToRemove = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "HW1",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        isManualEstimate: false,
        courseId: userCourseId,
        status: "not_started",
      })
    );

    const taskKeep = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "HW2",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        isManualEstimate: false,
        courseId: otherCourseId,
        status: "not_started",
      })
    );

    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskToRemove as never,
        title: "Block",
        studyBlockLength: 60,
        isCompleted: false,
        isConflicted: false,
      })
    );

    await withAuth.mutation(api.mutations.userCourses.deleteUserCourse, {
      userCourseId,
    });

    expect(await t.run((ctx) => ctx.db.get(userCourseId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(taskToRemove))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(blockId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(taskKeep))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(otherCourseId))).not.toBeNull();
  });

  test("deletes dashboard tasks tagged by classTag only (no courseId)", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const userCourseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.500.112.FA25",
        title: "Gateway Computing",
        term: "Fall 2025",
      })
    );

    const taskTagged = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "Lab 3",
        description: "d",
        taskType: "Lab",
        dueDate: FUTURE,
        createdAt: Date.now(),
        isManualEstimate: false,
        classTag: "EN.500.112.FA25: Gateway Computing",
        status: "not_started",
      })
    );

    await withAuth.mutation(api.mutations.userCourses.deleteUserCourse, {
      userCourseId,
    });

    expect(await t.run((ctx) => ctx.db.get(taskTagged))).toBeNull();
  });

  test("deletes tasks with legacy classTag when title duplicated OfferingName (SIS shape)", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const userCourseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.423.SP26",
        title: "EN.601.423: AI-Enabled Software Engineering",
        term: "Spring 2026",
      })
    );

    const legacyTag = "EN.601.423.SP26: EN.601.423: AI-Enabled Software Engineering";

    const taskLegacy = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "Essay",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        isManualEstimate: false,
        classTag: legacyTag,
        status: "not_started",
      })
    );

    await withAuth.mutation(api.mutations.userCourses.deleteUserCourse, {
      userCourseId,
    });

    expect(await t.run((ctx) => ctx.db.get(taskLegacy))).toBeNull();
  });

  test("deletes tasks with canonical deduped classTag for SIS title shape", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const userCourseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.423.SP26",
        title: "EN.601.423: AI-Enabled Software Engineering",
        term: "Spring 2026",
      })
    );

    const canonicalTag = "EN.601.423.SP26: AI-Enabled Software Engineering";

    const task = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "Essay",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        isManualEstimate: false,
        classTag: canonicalTag,
        status: "not_started",
      })
    );

    await withAuth.mutation(api.mutations.userCourses.deleteUserCourse, {
      userCourseId,
    });

    expect(await t.run((ctx) => ctx.db.get(task))).toBeNull();
  });

  test("clears courseId on syllabi linked to the deleted course", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const userCourseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "AS.110.201.SP26",
        title: "Calc",
        term: "Spring 2026",
      })
    );

    const syllabusId = await t.run((ctx) =>
      ctx.db.insert("syllabi", {
        userId: userId as never,
        fileContents: "text",
        courseId: userCourseId,
        status: "confirmed",
        createdAt: Date.now(),
      })
    );

    await withAuth.mutation(api.mutations.userCourses.deleteUserCourse, {
      userCourseId,
    });

    const syllabus = await t.run((ctx) => ctx.db.get(syllabusId));
    expect(syllabus).not.toBeNull();
    expect(syllabus!.courseId).toBeUndefined();
  });
});

describe("queries/userCourses – getCourseMetadata", () => {
  test("returns hasSyllabus=true only when a confirmed syllabus exists for the course", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const courseWithSyllabus = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    const courseWithoutSyllabus = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.421",
        title: "OOSE",
        term: "Spring 2026",
      })
    );

    await t.run((ctx) =>
      ctx.db.insert("syllabi", {
        userId: userId as never,
        fileContents: "...",
        courseId: courseWithSyllabus,
        status: "confirmed",
        createdAt: Date.now(),
      })
    );

    const metadata = await withAuth.query(api.queries.userCourses.getCourseMetadata, {});

    const withSyl = metadata.find((m) => m.courseId === courseWithSyllabus);
    const withoutSyl = metadata.find((m) => m.courseId === courseWithoutSyllabus);

    expect(withSyl?.hasSyllabus).toBe(true);
    expect(withoutSyl?.hasSyllabus).toBe(false);
  });

  test("does not count a pending syllabus as hasSyllabus", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const courseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    await t.run((ctx) =>
      ctx.db.insert("syllabi", {
        userId: userId as never,
        fileContents: "...",
        courseId,
        status: "pending",
        createdAt: Date.now(),
      })
    );

    const metadata = await withAuth.query(api.queries.userCourses.getCourseMetadata, {});
    const entry = metadata.find((m) => m.courseId === courseId);
    expect(entry?.hasSyllabus).toBe(false);
  });

  test("returns correct taskCount per course without counting tasks from other courses", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const courseA = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    const courseB = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.421",
        title: "OOSE",
        term: "Spring 2026",
      })
    );

    const FUTURE = Date.now() + 86_400_000;
    for (let i = 0; i < 3; i++) {
      await t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId: userId as never,
          title: `Task ${i}`,
          description: "d",
          taskType: "Essay",
          dueDate: FUTURE,
          createdAt: Date.now(),
          courseId: courseA,
          status: "not_started",
        })
      );
    }

    await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "Single task",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        courseId: courseB,
        status: "not_started",
      })
    );

    const metadata = await withAuth.query(api.queries.userCourses.getCourseMetadata, {});

    const entryA = metadata.find((m) => m.courseId === courseA);
    const entryB = metadata.find((m) => m.courseId === courseB);

    expect(entryA?.taskCount).toBe(3);
    expect(entryB?.taskCount).toBe(1);
  });

  test("returns taskCount=0 and hasSyllabus=false for a course with no tasks or syllabus", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const courseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    const metadata = await withAuth.query(api.queries.userCourses.getCourseMetadata, {});
    const entry = metadata.find((m) => m.courseId === courseId);

    expect(entry?.taskCount).toBe(0);
    expect(entry?.hasSyllabus).toBe(false);
  });

  test("does not include tasks from another user in taskCount", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { userId: otherUserId } = await createTestUser(t, { email: "other@example.com" });

    const courseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    const FUTURE = Date.now() + 86_400_000;
    await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: otherUserId as never,
        title: "Other user task",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        courseId,
        status: "not_started",
      })
    );

    const metadata = await withAuth.query(api.queries.userCourses.getCourseMetadata, {});
    const entry = metadata.find((m) => m.courseId === courseId);
    expect(entry?.taskCount).toBe(0);
  });
});

describe("getCourseMetadata – document read efficiency", () => {
  /**
   * Seeds a realistic dataset:
   *   5 courses
   *   5 syllabi (3 confirmed, 2 pending)
   *   50 tasks  (30 tagged to courses @ 6 each, 20 untagged)
   *
   * Old impl: 5 + 5 + 50 = 60 document reads (all syllabi + all tasks)
   * New impl: 5 + 3 + 30 = 38 document reads (only confirmed syllabi + only tagged tasks)
   *
   * The limit below (45) is between the two — new impl passes, old impl would throw.
   */
  async function seedLargeDataset(t: TestInstance) {
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Test User", email: "test@example.com" })
    );

    const FUTURE = Date.now() + 86_400_000;
    const courseIds: Id<"userCourses">[] = [];

    for (let i = 0; i < 5; i++) {
      const id = await t.run((ctx) =>
        ctx.db.insert("userCourses", {
          userId: userId as never,
          courseCode: `EN.601.${200 + i}`,
          title: `Course ${i}`,
          term: "Fall 2025",
        })
      );
      courseIds.push(id);
    }

    // 3 confirmed syllabi for courses 0-2
    for (let i = 0; i < 3; i++) {
      await t.run((ctx) =>
        ctx.db.insert("syllabi", {
          userId: userId as never,
          fileContents: "syllabus content",
          courseId: courseIds[i],
          status: "confirmed",
          createdAt: Date.now(),
        })
      );
    }

    // 2 pending syllabi for courses 3-4
    for (let i = 3; i < 5; i++) {
      await t.run((ctx) =>
        ctx.db.insert("syllabi", {
          userId: userId as never,
          fileContents: "syllabus content",
          courseId: courseIds[i],
          status: "pending",
          createdAt: Date.now(),
        })
      );
    }

    // 6 tagged tasks per course (30 total)
    for (const courseId of courseIds) {
      for (let j = 0; j < 6; j++) {
        await t.run((ctx) =>
          ctx.db.insert("tasks", {
            userId: userId as never,
            title: `Task ${j}`,
            description: "d",
            taskType: "Essay",
            dueDate: FUTURE,
            createdAt: Date.now(),
            courseId,
            status: "not_started",
          })
        );
      }
    }

    // 20 untagged tasks (no courseId) — old impl reads these, new impl does not
    for (let i = 0; i < 20; i++) {
      await t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId: userId as never,
          title: `Untagged ${i}`,
          description: "d",
          taskType: "Essay",
          dueDate: FUTURE,
          createdAt: Date.now(),
          status: "not_started",
        })
      );
    }

    return { userId };
  }

  test("new impl stays within a read budget that the old full-scan approach would exceed", async () => {
    // Limit set to 45: new impl reads ~38 docs (passes), old impl reads ~60 docs (would throw)
    const t = convexTest({
      schema,
      modules,
      transactionLimits: { documentsRead: 45 },
    }) as unknown as TestInstance;
    const { userId } = await seedLargeDataset(t);
    const withAuth = t.withIdentity({ subject: userId });

    // Should not throw — new impl reads only what it needs
    await expect(
      withAuth.query(api.queries.userCourses.getCourseMetadata, {})
    ).resolves.toHaveLength(5);
  });

  test("old full-scan approach would exceed the same budget", async () => {
    const t = convexTest({
      schema,
      modules,
      transactionLimits: { documentsRead: 45 },
    }) as unknown as TestInstance;
    const { userId } = await seedLargeDataset(t);
    const withAuth = t.withIdentity({ subject: userId });

    // Inline replica of the old impl — reads all syllabi + all tasks for the user
    await expect(
      withAuth.query(async (ctx) => {
        const courses = await ctx.db
          .query("userCourses")
          .withIndex("by_user", (q) => q.eq("userId", userId as never))
          .collect();

        const syllabi = await ctx.db
          .query("syllabi")
          .withIndex("by_userId", (q) => q.eq("userId", userId as never))
          .collect();

        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_userId", (q) => q.eq("userId", userId as never))
          .collect();

        return courses.length + syllabi.length + tasks.length;
      })
    ).rejects.toThrow();
  });
});
