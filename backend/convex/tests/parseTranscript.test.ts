import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

// ---------------------------------------------------------------------------
// Mock the Vercel AI SDK so tests never hit the real Gemini API.
// ---------------------------------------------------------------------------
const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  generateText: mockGenerateText,
  Output: {
    object: vi.fn((opts: { schema: unknown }) => opts.schema),
  },
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "mock-model")),
}));

function makeGeminiResponse(isJhuTranscript: boolean, courses: object[]) {
  return { output: { isJhuTranscript, courses } };
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

const TRANSCRIPT_TEXT =
  "Johns Hopkins University\nFall 2022\nEN.601.226 Data Structures A";

describe("actions/parseTranscript", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.action(api.ai.parseTranscript.parseTranscript, {
        fileText: TRANSCRIPT_TEXT,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when fileText exceeds 100,000 characters", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileText: "x".repeat(100_001),
      })
    ).rejects.toThrow("fileText exceeds maximum length of 100000 characters");
  });

  test("does not throw for text exactly at the 100,000 character limit", async () => {
    mockGenerateText.mockResolvedValueOnce(makeGeminiResponse(true, SAMPLE_COURSES));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileText: "x".repeat(100_000),
      })
    ).resolves.toBeDefined();
  });

  test("throws when GEMINI_API_KEY is not set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileText: TRANSCRIPT_TEXT,
      })
    ).rejects.toThrow("GEMINI_API_KEY is not set");
  });

  test("throws NOT_JHU_TRANSCRIPT when Gemini identifies a non-JHU document", async () => {
    mockGenerateText.mockResolvedValueOnce(makeGeminiResponse(false, []));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    await expect(
      withAuth.action(api.ai.parseTranscript.parseTranscript, {
        fileText: "Some random document",
      })
    ).rejects.toThrow("NOT_JHU_TRANSCRIPT");
  });

  test("returns parsed courses on a valid JHU transcript", async () => {
    mockGenerateText.mockResolvedValueOnce(makeGeminiResponse(true, SAMPLE_COURSES));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileText: TRANSCRIPT_TEXT,
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

  test("returns an empty array when Gemini finds no courses", async () => {
    mockGenerateText.mockResolvedValueOnce(makeGeminiResponse(true, []));
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileText: TRANSCRIPT_TEXT,
    });
    expect(result).toEqual([]);
  });

  test("filters out courses with a blank courseCode", async () => {
    mockGenerateText.mockResolvedValueOnce(
      makeGeminiResponse(true, [
        { courseCode: "", title: "Missing Code", credits: 3, term: "Fall 2022", grade: "A" },
        ...SAMPLE_COURSES,
      ])
    );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileText: TRANSCRIPT_TEXT,
    });
    expect(result.find((c) => c.title === "Missing Code")).toBeUndefined();
    expect(result).toHaveLength(2);
  });

  test("filters out courses with a blank grade", async () => {
    mockGenerateText.mockResolvedValueOnce(
      makeGeminiResponse(true, [
        {
          courseCode: "EN.601.226",
          title: "Data Structures",
          credits: 3,
          term: "Fall 2022",
          grade: "",
        },
        SAMPLE_COURSES[1],
      ])
    );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileText: TRANSCRIPT_TEXT,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe("AS.110.201");
  });

  test("filters out courses with a blank title", async () => {
    mockGenerateText.mockResolvedValueOnce(
      makeGeminiResponse(true, [
        {
          courseCode: "EN.601.226",
          title: "   ",
          credits: 3,
          term: "Fall 2022",
          grade: "A",
        },
        SAMPLE_COURSES[1],
      ])
    );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileText: TRANSCRIPT_TEXT,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe("AS.110.201");
  });

  test("filters out courses with a blank term", async () => {
    mockGenerateText.mockResolvedValueOnce(
      makeGeminiResponse(true, [
        {
          courseCode: "EN.601.226",
          title: "Data Structures",
          credits: 3,
          term: "",
          grade: "A",
        },
        SAMPLE_COURSES[1],
      ])
    );
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const result = await withAuth.action(api.ai.parseTranscript.parseTranscript, {
      fileText: TRANSCRIPT_TEXT,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe("AS.110.201");
  });
});
