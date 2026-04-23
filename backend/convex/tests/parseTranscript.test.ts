import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

// ---------------------------------------------------------------------------
// Mock MastraClient so tests never hit the real Mastra server.
// ---------------------------------------------------------------------------
const mockStartAsync = vi.fn();
const mockGetWorkflow = vi.fn((_name: string) => ({ startAsync: mockStartAsync }));
vi.mock("@mastra/client-js", () => ({
  MastraClient: vi.fn(() => ({
    getWorkflow: mockGetWorkflow,
  })),
}));

function makeOcrResponse(extractedText: string) {
  return { steps: { ocr: { status: "success", output: { extractedText } } } };
}

function makeParseResponse(isJhuTranscript: boolean, courses: object[]) {
  return { steps: { parse: { status: "success", output: { isJhuTranscript, courses } } } };
}

const SAMPLE_COURSES = [
  {
    courseCode: "EN.601.226",
    title: "Data Structures",
    credits: 3,
    term: "Fall 2022",
    grade: "A",
  },
  {
    courseCode: "AS.110.201",
    title: "Linear Algebra",
    credits: 4,
    term: "Fall 2022",
    grade: "A-",
  },
];

// Simulated base64 PDF payload (not a real PDF — mock intercepts before Mistral is called)
const FAKE_PDF_BASE64 = btoa("fake pdf bytes");

const TRANSCRIPT_TEXT =
  "Johns Hopkins University\nFall 2022\nEN.601.226 Data Structures A";

describe("actions/parseTranscript", () => {
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
      t.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: FAKE_PDF_BASE64,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when PDF exceeds 10 MB", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: "x".repeat(10_000_001),
      })
    ).rejects.toThrow("PDF exceeds maximum upload size of 10 MB");
  });

  test("throws when MASTRA_URL is not set", async () => {
    vi.stubEnv("MASTRA_URL", "");
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: FAKE_PDF_BASE64,
      })
    ).rejects.toThrow("MASTRA_URL not configured");
  });

  test("runs OCR workflow then parse workflow in sequence", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce(makeParseResponse(true, SAMPLE_COURSES));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileContents: FAKE_PDF_BASE64,
    });
    expect(mockGetWorkflow).toHaveBeenCalledWith("transcript-ocr-workflow");
    expect(mockGetWorkflow).toHaveBeenCalledWith("transcript-parse-workflow");
    expect(mockStartAsync).toHaveBeenCalledTimes(2);
    expect(mockStartAsync.mock.calls[0][0].inputData).toHaveProperty("fileContents", FAKE_PDF_BASE64);
    expect(mockStartAsync.mock.calls[1][0].inputData).toHaveProperty("sanitizedText");
  });

  test("throws when OCR step returns no text", async () => {
    mockStartAsync.mockResolvedValueOnce({ steps: { ocr: { status: "success", output: { extractedText: "" } } } });
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: FAKE_PDF_BASE64,
      })
    ).rejects.toThrow("Transcript OCR did not return any text");
  });

  test("throws when OCR step fails with an error", async () => {
    mockStartAsync.mockResolvedValueOnce({ steps: { ocr: { status: "failed", error: "Status 401 Unauthorized" } } });
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: FAKE_PDF_BASE64,
      })
    ).rejects.toThrow("Transcript OCR failed: Status 401 Unauthorized");
  });

  test("throws when OCR step is missing from workflow result", async () => {
    mockStartAsync.mockResolvedValueOnce({ steps: {} });
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: FAKE_PDF_BASE64,
      })
    ).rejects.toThrow("Transcript OCR failed: step did not complete");
  });

  test("throws NOT_JHU_TRANSCRIPT when Claude identifies a non-JHU document", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse("Some random document"))
      .mockResolvedValueOnce(makeParseResponse(false, []));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: FAKE_PDF_BASE64,
      })
    ).rejects.toThrow("NOT_JHU_TRANSCRIPT");
  });

  test("returns parsed courses on a valid JHU transcript", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce(makeParseResponse(true, SAMPLE_COURSES));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileContents: FAKE_PDF_BASE64,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      courseCode: "EN.601.226",
      title: "Data Structures",
      credits: 3,
      term: "Fall 2022",
      grade: "A",
    });
  });

  test("returns an empty array when Claude finds no courses", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce(makeParseResponse(true, []));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileContents: FAKE_PDF_BASE64,
    });
    expect(result).toEqual([]);
  });

  test("filters out courses with a blank courseCode", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce(
        makeParseResponse(true, [
          { courseCode: "", title: "Missing Code", credits: 3, term: "Fall 2022", grade: "A" },
          ...SAMPLE_COURSES,
        ])
      );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileContents: FAKE_PDF_BASE64,
    });
    expect(result.find((c) => c.title === "Missing Code")).toBeUndefined();
    expect(result).toHaveLength(2);
  });

  test("filters out courses with a blank grade", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce(
        makeParseResponse(true, [
          { courseCode: "EN.601.226", title: "Data Structures", credits: 3, term: "Fall 2022", grade: "" },
          SAMPLE_COURSES[1],
        ])
      );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileContents: FAKE_PDF_BASE64,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe("AS.110.201");
  });

  test("filters out courses with a blank title", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce(
        makeParseResponse(true, [
          { courseCode: "EN.601.226", title: "   ", credits: 3, term: "Fall 2022", grade: "A" },
          SAMPLE_COURSES[1],
        ])
      );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileContents: FAKE_PDF_BASE64,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe("AS.110.201");
  });

  test("filters out courses with a blank term", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce(
        makeParseResponse(true, [
          { courseCode: "EN.601.226", title: "Data Structures", credits: 3, term: "", grade: "A" },
          SAMPLE_COURSES[1],
        ])
      );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileContents: FAKE_PDF_BASE64,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe("AS.110.201");
  });

  test("throws when parse workflow step does not succeed", async () => {
    mockStartAsync
      .mockResolvedValueOnce(makeOcrResponse(TRANSCRIPT_TEXT))
      .mockResolvedValueOnce({ steps: { parse: { status: "failed" } } });
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileContents: FAKE_PDF_BASE64,
      })
    ).rejects.toThrow("Transcript parse workflow did not complete successfully");
  });
});
