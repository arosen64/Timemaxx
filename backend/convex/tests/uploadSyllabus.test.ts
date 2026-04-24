import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

// ---------------------------------------------------------------------------
// Mock MastraClient so tests never hit the real Mastra server.
// mockGetWorkflow tracks which workflow names were requested.
// ---------------------------------------------------------------------------
const mockStartAsync = vi.fn();
const mockGetWorkflow = vi.fn((_name: string) => ({ startAsync: mockStartAsync }));
vi.mock("@mastra/client-js", () => ({
  MastraClient: vi.fn(() => ({
    getWorkflow: mockGetWorkflow,
  })),
}));

/** Returns an ISO 8601 date string (YYYY-MM-DD) for N days from now. */
function futureDateISO(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

const SYLLABUS_TEXT = `
CS 101 – Introduction to Computer Science
Assignment 1: Problem Set due ${futureDateISO(30)}
Midterm Exam: due ${futureDateISO(60)}
Final Project (coding): due ${futureDateISO(90)}
Essay on algorithms: due ${futureDateISO(75)}
`;

function makeParseResponse(
  tasks: Array<{
    title: string;
    description: string;
    dueDate: string;
    taskType: string;
  }>
) {
  return { steps: { parse: { status: "success", output: { tasks } } } };
}

describe("actions/uploadSyllabus", () => {
  beforeEach(() => {
    vi.stubEnv("MASTRA_URL", "http://localhost:4111/mastra");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mockGetWorkflow.mockImplementation((_name: string) => ({ startAsync: mockStartAsync }));
  });

  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();

    await expect(
      t.action(api.ai.uploadSyllabus.uploadSyllabus, {
        fileContents: SYLLABUS_TEXT,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when MASTRA_URL is not set", async () => {
    vi.stubEnv("MASTRA_URL", "");
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.action(api.ai.uploadSyllabus.uploadSyllabus, {
        fileContents: SYLLABUS_TEXT,
      })
    ).rejects.toThrow("MASTRA_URL not configured");
  });

  test("marks the syllabus as failed when MASTRA_URL is missing", async () => {
    vi.stubEnv("MASTRA_URL", "");
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.action(api.ai.uploadSyllabus.uploadSyllabus, {
        fileContents: SYLLABUS_TEXT,
      })
    ).rejects.toThrow();

    const syllabi = await t.run((ctx) => ctx.db.query("syllabi").collect());
    expect(syllabi).toHaveLength(1);
    expect(syllabi[0].status).toBe("failed");
  });

  test("returns syllabusId and extracted tasks on success", async () => {
    mockStartAsync.mockResolvedValueOnce(
      makeParseResponse([
        {
          title: "Problem Set 1",
          description: "Solve exercises 1-10 from chapter 3.",
          dueDate: futureDateISO(30),
          taskType: "Problem Set",
        },
        {
          title: "Midterm Exam",
          description: "Covers all topics from weeks 1-7.",
          dueDate: futureDateISO(60),
          taskType: "Exam Prep",
        },
      ])
    );

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const result = await withAuth.action(
      api.ai.uploadSyllabus.uploadSyllabus,
      { fileContents: SYLLABUS_TEXT }
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
    const dateStr = futureDateISO(90);
    mockStartAsync.mockResolvedValueOnce(
      makeParseResponse([
        {
          title: "Final Project",
          description: "Build a full-stack application.",
          dueDate: dateStr,
          taskType: "Coding",
        },
      ])
    );

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { extractedTasks } = await withAuth.action(
      api.ai.uploadSyllabus.uploadSyllabus,
      { fileContents: SYLLABUS_TEXT }
    );

    expect(extractedTasks[0].dueDate).toBe(new Date(dateStr).getTime());
  });

  test("filters out tasks with an unrecognised taskType", async () => {
    mockStartAsync.mockResolvedValueOnce(
      makeParseResponse([
        {
          title: "Valid Task",
          description: "Should be kept.",
          dueDate: futureDateISO(45),
          taskType: "Essay",
        },
        {
          title: "Bad Task",
          description: "Should be dropped.",
          dueDate: futureDateISO(60),
          taskType: "Unrecognized Type",
        },
      ])
    );

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { extractedTasks } = await withAuth.action(
      api.ai.uploadSyllabus.uploadSyllabus,
      { fileContents: SYLLABUS_TEXT }
    );

    expect(extractedTasks).toHaveLength(1);
    expect(extractedTasks[0].title).toBe("Valid Task");
  });

  test("filters out tasks with a past due date", async () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    mockStartAsync.mockResolvedValueOnce(
      makeParseResponse([
        {
          title: "Past Task",
          description: "Should be dropped because it is overdue.",
          dueDate: pastDate,
          taskType: "Essay",
        },
        {
          title: "Future Task",
          description: "Should be kept.",
          dueDate: futureDateISO(30),
          taskType: "Essay",
        },
      ])
    );

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { extractedTasks } = await withAuth.action(
      api.ai.uploadSyllabus.uploadSyllabus,
      { fileContents: SYLLABUS_TEXT }
    );

    expect(extractedTasks).toHaveLength(1);
    expect(extractedTasks[0].title).toBe("Future Task");
  });

  test("marks syllabus as confirmed after successful extraction", async () => {
    mockStartAsync.mockResolvedValueOnce(makeParseResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { syllabusId } = await withAuth.action(
      api.ai.uploadSyllabus.uploadSyllabus,
      { fileContents: SYLLABUS_TEXT }
    );

    const syllabus = await t.run((ctx) => ctx.db.get(syllabusId));
    expect(syllabus?.status).toBe("confirmed");
  });

  test("marks syllabus as failed when Mastra parse workflow throws", async () => {
    mockStartAsync.mockRejectedValueOnce(new Error("Mastra unavailable"));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.action(api.ai.uploadSyllabus.uploadSyllabus, {
        fileContents: SYLLABUS_TEXT,
      })
    ).rejects.toThrow("Mastra unavailable");

    const syllabi = await t.run((ctx) => ctx.db.query("syllabi").collect());
    expect(syllabi[0].status).toBe("failed");
  });

  test("returns an empty extractedTasks array when parse finds no tasks", async () => {
    mockStartAsync.mockResolvedValueOnce(makeParseResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { extractedTasks } = await withAuth.action(
      api.ai.uploadSyllabus.uploadSyllabus,
      { fileContents: "No assignments here." }
    );

    expect(extractedTasks).toEqual([]);
  });

  test("stores the correct fileContents on the created syllabus row", async () => {
    mockStartAsync.mockResolvedValueOnce(makeParseResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const { syllabusId } = await withAuth.action(
      api.ai.uploadSyllabus.uploadSyllabus,
      { fileContents: SYLLABUS_TEXT }
    );

    const syllabus = await t.run((ctx) => ctx.db.get(syllabusId));
    expect(syllabus?.fileContents).toBe(SYLLABUS_TEXT);
  });

  test("throws when fileContents exceeds 1,500,000 characters", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.action(api.ai.uploadSyllabus.uploadSyllabus, {
        fileContents: "x".repeat(1_500_001),
      })
    ).rejects.toThrow("fileContents exceeds maximum length of 1500000 characters");
  });

  test("PDF path calls OCR workflow then parse workflow", async () => {
    mockStartAsync
      .mockResolvedValueOnce({ steps: { ocr: { status: "success", output: { extractedText: "Extracted syllabus text" } } } })
      .mockResolvedValueOnce(makeParseResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await withAuth.action(api.ai.uploadSyllabus.uploadSyllabus, {
      fileContents: "base64pdfbytes==",
      mimeType: "application/pdf",
    });

    const workflowNames = mockGetWorkflow.mock.calls.map(([name]) => name);
    expect(workflowNames).toEqual(["syllabus-ocr-workflow", "syllabus-parse-workflow"]);
    expect(mockStartAsync).toHaveBeenCalledTimes(2);
    // OCR workflow receives the raw base64 bytes
    expect(mockStartAsync.mock.calls[0][0].inputData.fileContents).toBe("base64pdfbytes==");
  });

  test("text path skips OCR and calls only parse workflow", async () => {
    mockStartAsync.mockResolvedValueOnce(makeParseResponse([]));

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await withAuth.action(api.ai.uploadSyllabus.uploadSyllabus, {
      fileContents: "Plain syllabus text",
      mimeType: "text/plain",
    });

    const workflowNames = mockGetWorkflow.mock.calls.map(([name]) => name);
    expect(workflowNames).toEqual(["syllabus-parse-workflow"]);
    expect(mockStartAsync).toHaveBeenCalledTimes(1);
  });
});
