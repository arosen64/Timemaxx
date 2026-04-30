import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

const mockCallGemini = vi.fn();

vi.mock("../lib/gemini", () => ({
  callGemini: mockCallGemini,
}));

const FUTURE = Date.now() + 86_400_000 * 14;

async function seedTask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  description = "Write a 5-page essay analyzing the causes of World War I."
) {
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as never,
      title: "History Essay",
      description,
      taskType: "Essay",
      dueDate: FUTURE,
      createdAt: Date.now(),
      isManualEstimate: false,
    })
  );
}

function makeGeminiSubtaskResponse(
  subtasks: Array<{
    title: string;
    description: string;
    taskType: string;
  }>
) {
  return { subtasks };
}

const MOCK_SUBTASKS = [
  {
    title: "Research causes of WWI",
    description: "Read chapters 3–4 and take notes on key causes.",
    taskType: "Reading",
  },
  {
    title: "Draft outline",
    description: "Create a structured outline with thesis and main arguments.",
    taskType: "Essay",
  },
  {
    title: "Write and revise essay",
    description: "Write the full 5-page draft and revise for clarity.",
    taskType: "Essay",
  },
];

describe("actions/requestGenerateSubtasks", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-api-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("returns error object (without calling Gemini) when description is empty and no fileContent", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, "");

    const result = await withAuth.action(
      api.actions.requestGenerateSubtasks.requestGenerateSubtasks,
      { taskId }
    );

    expect(result).toEqual({
      error:
        "Please provide a description or upload an assignment file before generating subtasks.",
    });
    expect(mockCallGemini).not.toHaveBeenCalled();
  });

  test("returns error object when description is whitespace-only and no fileContent", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, "   ");

    const result = await withAuth.action(
      api.actions.requestGenerateSubtasks.requestGenerateSubtasks,
      { taskId }
    );

    expect(result).toHaveProperty("error");
    expect(mockCallGemini).not.toHaveBeenCalled();
  });

  test("returns subtasks array on successful generation with description", async () => {
    mockCallGemini.mockResolvedValueOnce(makeGeminiSubtaskResponse(MOCK_SUBTASKS));

    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const result = await withAuth.action(
      api.actions.requestGenerateSubtasks.requestGenerateSubtasks,
      { taskId }
    );

    expect(result).toHaveProperty("subtasks");
    if (!("subtasks" in result)) throw new Error("expected subtasks");
    expect(result.subtasks).toHaveLength(3);
    expect(result.subtasks[0]).toMatchObject({
      title: "Research causes of WWI",
      taskType: "Reading",
    });
    expect(typeof result.subtasks[0].suggestedCompletionAt).toBe("string");
  });

  test("calls Gemini and returns subtasks when only fileContent is provided", async () => {
    mockCallGemini.mockResolvedValueOnce(makeGeminiSubtaskResponse(MOCK_SUBTASKS));

    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, "");

    const result = await withAuth.action(
      api.actions.requestGenerateSubtasks.requestGenerateSubtasks,
      {
        taskId,
        fileContent:
          "Assignment: Write a 5-page essay on WWI. Due in 2 weeks. Must cite 5 sources.",
      }
    );

    expect(mockCallGemini).toHaveBeenCalledOnce();
    expect(result).toHaveProperty("subtasks");
  });

  test("throws when task does not belong to the user", async () => {
    const t = makeTestCtx();
    const { userId: ownerUserId } = await createTestUser(t);
    const { withAuth: attackerAuth } = await createTestUser(t);
    const taskId = await seedTask(t, ownerUserId);

    await expect(
      attackerAuth.action(api.actions.requestGenerateSubtasks.requestGenerateSubtasks, { taskId })
    ).rejects.toThrow("Task not found or access denied");
    expect(mockCallGemini).not.toHaveBeenCalled();
  });

  test("throws when GEMINI_API_KEY is not set and description is present", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const result = await withAuth.action(
      api.actions.requestGenerateSubtasks.requestGenerateSubtasks,
      { taskId }
    );

    expect(result).toHaveProperty("error");
  });
});
