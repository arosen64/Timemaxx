import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";
import { TASK_TYPES } from "../lib/taskValidators";
import { buildClassTag } from "../lib/classTagUtils";

const FUTURE_DATE = Date.now() + 86_400_000;

async function createTestSyllabus(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  opts: { courseId?: string } = {}
) {
  return await t.run((ctx) =>
    ctx.db.insert("syllabi", {
      userId: userId as never,
      fileContents: "syllabus text",
      courseId: opts.courseId as never,
      status: "confirmed",
      createdAt: Date.now(),
    })
  );
}

describe("mutations/syllabi – confirmSyllabusTasks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    await expect(
      t.mutation(api.mutations.syllabi.confirmSyllabusTasks, {
        syllabusId,
        tasks: [],
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when syllabus does not exist", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    await t.run((ctx) => ctx.db.delete(syllabusId));

    await expect(
      withAuth.mutation(api.mutations.syllabi.confirmSyllabusTasks, {
        syllabusId,
        tasks: [],
      })
    ).rejects.toThrow("Syllabus not found");
  });

  test("throws when syllabus belongs to a different user", async () => {
    const t = makeTestCtx();
    const { userId: otherUserId } = await createTestUser(t, {
      email: "other@example.com",
    });
    const syllabusId = await createTestSyllabus(t, otherUserId);

    const { withAuth } = await createTestUser(t, { email: "me@example.com" });

    await expect(
      withAuth.mutation(api.mutations.syllabi.confirmSyllabusTasks, {
        syllabusId,
        tasks: [],
      })
    ).rejects.toThrow("Syllabus not found");
  });

  test("inserts tasks with correct fields and returns their IDs", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    const taskIds = await withAuth.mutation(
      api.mutations.syllabi.confirmSyllabusTasks,
      {
        syllabusId,
        tasks: [
          {
            title: "Problem Set 1",
            description: "Solve exercises 1-10.",
            dueDate: FUTURE_DATE,
            taskType: "Problem Set",
          },
          {
            title: "Midterm Essay",
            description: "Write a 5-page essay on the topic.",
            dueDate: FUTURE_DATE,
            taskType: "Essay",
          },
        ],
      }
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers.bind(vi));

    expect(taskIds).toHaveLength(2);

    const tasks = await t.run((ctx) =>
      Promise.all(taskIds.map((id) => ctx.db.get(id)))
    );

    expect(tasks[0]).toMatchObject({
      userId,
      title: "Problem Set 1",
      description: "Solve exercises 1-10.",
      taskType: "Problem Set",
    });
    expect(tasks[1]).toMatchObject({
      userId,
      title: "Midterm Essay",
      taskType: "Essay",
    });
  });

  test("stores courseId on the syllabus when provided", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    const courseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    const syllabusId = await createTestSyllabus(t, userId, { courseId: courseId as string });

    const syllabus = await t.run((ctx) => ctx.db.get(syllabusId));
    expect(syllabus?.courseId).toBe(courseId);
  });

  test("returns an empty array when no tasks are passed", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    const taskIds = await withAuth.mutation(
      api.mutations.syllabi.confirmSyllabusTasks,
      { syllabusId, tasks: [] }
    );

    expect(taskIds).toEqual([]);
  });

  test("sets courseId from the syllabus on every inserted task", async () => {
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

    const syllabusId = await createTestSyllabus(t, userId, { courseId: courseId as string });

    const taskIds = await withAuth.mutation(
      api.mutations.syllabi.confirmSyllabusTasks,
      {
        syllabusId,
        tasks: [
          {
            title: "Homework 1",
            description: "Complete chapter 3 exercises.",
            dueDate: FUTURE_DATE,
            taskType: "Problem Set",
          },
          {
            title: "Final Project",
            description: "Build a full-stack app.",
            dueDate: FUTURE_DATE,
            taskType: "Coding",
          },
        ],
      }
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers.bind(vi));

    const tasks = await t.run((ctx) =>
      Promise.all(taskIds.map((id) => ctx.db.get(id)))
    );

    const expectedTag = buildClassTag("EN.601.226", "Data Structures");
    for (const task of tasks) {
      expect(task?.courseId).toEqual(courseId);
      expect(task?.classTag).toBe(expectedTag);
    }
  });

  test("does not set classTag when the syllabus has no course", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    const [taskId] = await withAuth.mutation(
      api.mutations.syllabi.confirmSyllabusTasks,
      {
        syllabusId,
        tasks: [
          {
            title: "Reading 1",
            description: "Read chapter 1.",
            dueDate: FUTURE_DATE,
            taskType: "Reading",
          },
        ],
      }
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers.bind(vi));

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task?.courseId).toBeUndefined();
    expect(task?.classTag).toBeUndefined();
  });

  test("accepts all valid task types", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    const tasks = TASK_TYPES.map((taskType) => ({
      title: taskType,
      description: "desc",
      dueDate: FUTURE_DATE,
      taskType,
    }));

    const taskIds = await withAuth.mutation(
      api.mutations.syllabi.confirmSyllabusTasks,
      { syllabusId, tasks }
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers.bind(vi));

    expect(taskIds).toHaveLength(TASK_TYPES.length);

    const inserted = await t.run((ctx) =>
      Promise.all(taskIds.map((id) => ctx.db.get(id)))
    );

    expect(inserted.map((task) => task?.taskType)).toEqual([...TASK_TYPES]);
  });

  test("persists dueDate exactly as provided", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    const specificDate = 1_800_000_000_000;

    const [taskId] = await withAuth.mutation(
      api.mutations.syllabi.confirmSyllabusTasks,
      {
        syllabusId,
        tasks: [
          {
            title: "Midterm",
            description: "Covers chapters 1-5.",
            dueDate: specificDate,
            taskType: "Exam Prep",
          },
        ],
      }
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers.bind(vi));

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task?.dueDate).toEqual(specificDate);
  });

  test("assigns the authenticated user's id to every inserted task", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    const taskIds = await withAuth.mutation(
      api.mutations.syllabi.confirmSyllabusTasks,
      {
        syllabusId,
        tasks: [
          {
            title: "Quiz 1",
            description: "Short answer questions.",
            dueDate: FUTURE_DATE,
            taskType: "Exam Prep",
          },
        ],
      }
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers.bind(vi));

    const task = await t.run((ctx) => ctx.db.get(taskIds[0]));
    expect(task?.userId).toEqual(userId);
  });

  test("schedules time estimation for each confirmed task", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    await withAuth.mutation(api.mutations.syllabi.confirmSyllabusTasks, {
      syllabusId,
      tasks: [
        {
          title: "Task A",
          description: "Description A",
          dueDate: FUTURE_DATE,
          taskType: "Essay",
        },
        {
          title: "Task B",
          description: "Description B",
          dueDate: FUTURE_DATE,
          taskType: "Problem Set",
        },
      ],
    });

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(scheduled).toHaveLength(2);
    expect(scheduled.every((fn) => fn.name.includes("estimateTaskTime"))).toBe(true);

    await t.finishAllScheduledFunctions(vi.runAllTimers.bind(vi));
    vi.unstubAllEnvs();
  });

  test("schedules task embeddings for confirmed tasks when GEMINI_API_KEY is set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-api-key");
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const syllabusId = await createTestSyllabus(t, userId);

    await withAuth.mutation(api.mutations.syllabi.confirmSyllabusTasks, {
      syllabusId,
      tasks: [
        {
          title: "Task A",
          description: "Description A",
          dueDate: FUTURE_DATE,
          taskType: "Essay",
        },
      ],
    });

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(scheduled).toHaveLength(2);
    expect(scheduled.some((fn) => fn.name.includes("estimateTaskTime"))).toBe(true);
    expect(scheduled.some((fn) => fn.name.includes("generateTaskEmbedding"))).toBe(true);
    vi.unstubAllEnvs();
  });
});
