import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

// ---------------------------------------------------------------------------
// Mock @google/genai so tests never hit the real Gemini API.
// Each test can override `mockGenerateContent` to control the response.
// ---------------------------------------------------------------------------
const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING",
  },
}));

const SYLLABUS_TEXT = `
CS 101 – Introduction to Computer Science
Assignment 1: Problem Set due 2025-09-15
Midterm Exam: due 2025-10-20
Final Project (coding): due 2025-12-10
Essay on algorithms: due 2025-11-05
`;

function makeGeminiResponse(
  tasks: Array<{
    title: string;
    description: string;
    dueDate: string;
    taskType: string;
  }>
) {
  return { text: JSON.stringify({ tasks }) };
}

describe("actions/uploadSyllabus", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-api-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();

    await expect(
      t.action(api.actions.uploadSyllabus.uploadSyllabus, {
        fileName: "syllabus.pdf",
        fileText: SYLLABUS_TEXT,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when GEMINI_API_KEY is not set", async () => {
    vi.unstubAllEnvs(); // clear the key set in beforeEach
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.action(api.actions.uploadSyllabus.uploadSyllabus, {
        fileName: "syllabus.pdf",
        fileText: SYLLABUS_TEXT,
      })
    ).rejects.toThrow("GEMINI_API_KEY is not set");
  });

  test("marks the syllabus as failed when GEMINI_API_KEY is missing", async () => {
    vi.unstubAllEnvs();
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.action(api.actions.uploadSyllabus.uploadSyllabus, {
        fileName: "syllabus.pdf",
        fileText: SYLLABUS_TEXT,
      })
    ).rejects.toThrow();

    const syllabi = await t.run((ctx) => ctx.db.query("syllabi").collect());
    expect(syllabi).toHaveLength(1);
    expect(syllabi[0].status).toBe("failed");
  });

  test("returns syllabusId and extracted tasks on success", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse([
        {
          title: "Problem Set 1",
          description: "Solve exercises 1-10 from chapter 3.",
          dueDate: "2025-09-15",
          taskType: "Problem Set",
        },
        {
          title: "Midterm Exam",
          description: "Covers all topics from weeks 1-7.",
          dueDate: "2025-10-20",
          taskType: "Exam Prep",
        },
      ])
    );

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const result = await withAuth.action(
      api.actions.uploadSyllabus.uploadSyllabus,
      { fileName: "syllabus.pdf", fileText: SYLLABUS_TEXT }
    );

    expect(result.syllabusId).toBeDefined();
    expect(result.extractedTasks).toHaveLength(2);
    expect(result.extractedTasks[0]).toMatchObject({
      title: "Problem Set 1",
      description: "Solve exercises 1-10 from chapter 3.",
      taskType: "Problem Set",
    });
    expect(typeof result.extractedTasks[0].dueDate).toBe("number");
  });

  test("converts ISO dueDate strings to millisecond timestamps", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse([
        {
          title: "Final Project",
          description: "Build a full-stack application.",
          dueDate: "2025-12-10",
          taskType: "Coding",
        },
      ])
    );

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { extractedTasks } = await withAuth.action(
      api.actions.uploadSyllabus.uploadSyllabus,
      { fileName: "s.pdf", fileText: SYLLABUS_TEXT }
    );

    expect(extractedTasks[0].dueDate).toBe(new Date("2025-12-10").getTime());
  });

  test("filters out tasks with an unrecognised taskType", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse([
        {
          title: "Valid Task",
          description: "Should be kept.",
          dueDate: "2025-11-01",
          taskType: "Essay",
        },
        {
          title: "Bad Task",
          description: "Should be dropped.",
          dueDate: "2025-11-15",
          taskType: "Presentation", // not in TASK_TYPES
        },
      ])
    );

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { extractedTasks } = await withAuth.action(
      api.actions.uploadSyllabus.uploadSyllabus,
      { fileName: "s.pdf", fileText: SYLLABUS_TEXT }
    );

    expect(extractedTasks).toHaveLength(1);
    expect(extractedTasks[0].title).toBe("Valid Task");
  });

  test("marks syllabus as confirmed after successful extraction", async () => {
    mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { syllabusId } = await withAuth.action(
      api.actions.uploadSyllabus.uploadSyllabus,
      { fileName: "s.pdf", fileText: SYLLABUS_TEXT }
    );

    const syllabus = await t.run((ctx) => ctx.db.get(syllabusId));
    expect(syllabus?.status).toBe("confirmed");
  });

  test("marks syllabus as failed when Gemini throws", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("Gemini unavailable"));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.action(api.actions.uploadSyllabus.uploadSyllabus, {
        fileName: "s.pdf",
        fileText: SYLLABUS_TEXT,
      })
    ).rejects.toThrow("Gemini unavailable");

    const syllabi = await t.run((ctx) => ctx.db.query("syllabi").collect());
    expect(syllabi[0].status).toBe("failed");
  });

  test("returns an empty extractedTasks array when Gemini finds no tasks", async () => {
    mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { extractedTasks } = await withAuth.action(
      api.actions.uploadSyllabus.uploadSyllabus,
      { fileName: "s.pdf", fileText: "No assignments here." }
    );

    expect(extractedTasks).toEqual([]);
  });

  test("stores the correct fileName on the created syllabus row", async () => {
    mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { syllabusId } = await withAuth.action(
      api.actions.uploadSyllabus.uploadSyllabus,
      {
        fileName: "spring2025.pdf",
        fileText: SYLLABUS_TEXT,
      }
    );

    const syllabus = await t.run((ctx) => ctx.db.get(syllabusId));
    expect(syllabus?.fileName).toBe("spring2025.pdf");
  });
});

