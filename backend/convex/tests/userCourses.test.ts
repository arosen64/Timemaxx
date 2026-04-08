import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";
import { COURSE_COLOR_PALETTE } from "../lib/courseColors";

const FUTURE = Date.now() + 86_400_000;

describe("mutations/userCourses – addUserCourse", () => {
  test("assigns a color from the palette when a course is created", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const userCourseId = await withAuth.mutation(
      api.mutations.userCourses.addUserCourse,
      {
        courseCode: "EN.601.226",
        title: "Data Structures",
        term: "Fall 2025",
      }
    );

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
        courseId: userCourseId,
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
        courseId: otherCourseId,
      })
    );

    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskToRemove as never,
        title: "Block",
        studyBlockLength: 60,
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
        classTag: "EN.500.112.FA25: Gateway Computing",
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

    const legacyTag =
      "EN.601.423.SP26: EN.601.423: AI-Enabled Software Engineering";

    const taskLegacy = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "Essay",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        classTag: legacyTag,
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

    const canonicalTag =
      "EN.601.423.SP26: AI-Enabled Software Engineering";

    const task = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "Essay",
        description: "d",
        taskType: "Essay",
        dueDate: FUTURE,
        createdAt: Date.now(),
        classTag: canonicalTag,
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
