import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

const mockFetch = vi.fn();

function makeOkResponse(data: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => data };
}

function makeErrorResponse(status: number, statusText: string) {
  return { ok: false, status, statusText, json: async () => ({}) };
}

describe("actions/jhuCourses", () => {
  beforeEach(() => {
    vi.stubEnv("JHU_SIS_API_KEY", "test-sis-key");
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // ---------------------------------------------------------------------------
  // getAvailableTerms
  // ---------------------------------------------------------------------------
  describe("getAvailableTerms", () => {
    test("throws when unauthenticated", async () => {
      const t = makeTestCtx();
      await expect(t.action(api.functions.jhuCourses.getAvailableTerms, {})).rejects.toThrow(
        "Unauthenticated"
      );
    });

    test("throws when JHU_SIS_API_KEY is not set", async () => {
      vi.stubEnv("JHU_SIS_API_KEY", "");
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(withAuth.action(api.functions.jhuCourses.getAvailableTerms, {})).rejects.toThrow(
        "JHU_SIS_API_KEY"
      );
    });

    test("throws when SIS API returns a non-ok status", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(503, "Service Unavailable"));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(withAuth.action(api.functions.jhuCourses.getAvailableTerms, {})).rejects.toThrow(
        "503"
      );
    });

    test("throws when fetch throws (network error)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(withAuth.action(api.functions.jhuCourses.getAvailableTerms, {})).rejects.toThrow(
        "JHU SIS API request failed for terms"
      );
    });

    test("returns terms on success", async () => {
      const terms = [{ Name: "Fall 2025" }, { Name: "Spring 2026" }];
      mockFetch.mockResolvedValueOnce(makeOkResponse(terms));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      const result = await withAuth.action(api.functions.jhuCourses.getAvailableTerms, {});
      expect(result).toEqual(terms);
    });

    test("includes the API key in the request URL", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([]));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await withAuth.action(api.functions.jhuCourses.getAvailableTerms, {});
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("key=test-sis-key");
    });
  });

  // ---------------------------------------------------------------------------
  // getAvailableSchools
  // ---------------------------------------------------------------------------
  describe("getAvailableSchools", () => {
    test("throws when unauthenticated", async () => {
      const t = makeTestCtx();
      await expect(t.action(api.functions.jhuCourses.getAvailableSchools, {})).rejects.toThrow(
        "Unauthenticated"
      );
    });

    test("throws when JHU_SIS_API_KEY is not set", async () => {
      vi.stubEnv("JHU_SIS_API_KEY", "");
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(
        withAuth.action(api.functions.jhuCourses.getAvailableSchools, {})
      ).rejects.toThrow("JHU_SIS_API_KEY");
    });

    test("throws when SIS API returns a non-ok status", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(
        withAuth.action(api.functions.jhuCourses.getAvailableSchools, {})
      ).rejects.toThrow("500");
    });

    test("throws when fetch throws (network error)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(
        withAuth.action(api.functions.jhuCourses.getAvailableSchools, {})
      ).rejects.toThrow("JHU SIS API request failed for schools");
    });

    test("returns schools on success", async () => {
      const schools = [
        { Name: "Krieger School of Arts and Sciences" },
        { Name: "Whiting School of Engineering" },
      ];
      mockFetch.mockResolvedValueOnce(makeOkResponse(schools));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      const result = await withAuth.action(api.functions.jhuCourses.getAvailableSchools, {});
      expect(result).toEqual(schools);
    });

    test("includes the API key in the request URL", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([]));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await withAuth.action(api.functions.jhuCourses.getAvailableSchools, {});
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("key=test-sis-key");
    });
  });

  // ---------------------------------------------------------------------------
  // getCoursesByTerm
  // ---------------------------------------------------------------------------
  describe("getCoursesByTerm", () => {
    test("throws when unauthenticated", async () => {
      const t = makeTestCtx();
      await expect(
        t.action(api.functions.jhuCourses.getCoursesByTerm, { term: "Fall 2025" })
      ).rejects.toThrow("Unauthenticated");
    });

    test("throws when JHU_SIS_API_KEY is not set", async () => {
      vi.stubEnv("JHU_SIS_API_KEY", "");
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(
        withAuth.action(api.functions.jhuCourses.getCoursesByTerm, { term: "Fall 2025" })
      ).rejects.toThrow("JHU_SIS_API_KEY");
    });

    test("throws when SIS API returns a non-ok status", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(404, "Not Found"));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(
        withAuth.action(api.functions.jhuCourses.getCoursesByTerm, { term: "Fall 2025" })
      ).rejects.toThrow("404");
    });

    test("throws when fetch throws (network error)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(
        withAuth.action(api.functions.jhuCourses.getCoursesByTerm, { term: "Fall 2025" })
      ).rejects.toThrow("JHU SIS API request failed for courses");
    });

    test("throws Too many results when response exceeds 8000 items", async () => {
      const bigList = Array.from({ length: 8001 }, (_, i) => ({ id: i }));
      mockFetch.mockResolvedValueOnce(makeOkResponse(bigList));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await expect(
        withAuth.action(api.functions.jhuCourses.getCoursesByTerm, { term: "Fall 2025" })
      ).rejects.toThrow("Too many results");
    });

    test("returns exactly 8000 results without throwing", async () => {
      const list = Array.from({ length: 8000 }, (_, i) => ({ id: i }));
      mockFetch.mockResolvedValueOnce(makeOkResponse(list));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      const result = await withAuth.action(api.functions.jhuCourses.getCoursesByTerm, {
        term: "Fall 2025",
      });
      expect((result as object[]).length).toBe(8000);
    });

    test("returns courses on success", async () => {
      const courses = [{ OfferingName: "EN.601.226", Title: "Data Structures" }];
      mockFetch.mockResolvedValueOnce(makeOkResponse(courses));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      const result = await withAuth.action(api.functions.jhuCourses.getCoursesByTerm, {
        term: "Fall 2025",
        school: "EN",
      });
      expect(result).toEqual(courses);
    });

    test("includes term and school in the request URL", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([]));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await withAuth.action(api.functions.jhuCourses.getCoursesByTerm, {
        term: "Fall 2025",
        school: "EN",
      });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("Term=Fall%202025");
      expect(url).toContain("School=EN");
    });

    test("encodes department '/' as '_' (not %2F) in the URL", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([]));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await withAuth.action(api.functions.jhuCourses.getCoursesByTerm, {
        term: "Fall 2025",
        department: "Computer Science/Electrical Engineering",
      });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("Computer%20Science_Electrical%20Engineering");
      expect(url).not.toContain("%2F");
    });

    test("omits optional params when not provided", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([]));
      const t = makeTestCtx();
      const { withAuth } = await createTestUser(t);
      await withAuth.action(api.functions.jhuCourses.getCoursesByTerm, { term: "Fall 2025" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("School=");
      expect(url).not.toContain("Department=");
    });
  });
});
