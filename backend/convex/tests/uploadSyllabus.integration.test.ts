// ---------------------------------------------------------------------------
// Manual integration test — hits the real Gemini API. No mocks.
//
// How to use:
//   1. Paste your syllabus text into:
//        backend/convex/tests/__fixtures__/syllabus.txt
//   2. Pass your Gemini key inline (it lives in Convex cloud, not .env.local):
//        GEMINI_API_KEY=your-key npm test -- --reporter=verbose backend/convex/tests/uploadSyllabus.integration.test.ts
// ---------------------------------------------------------------------------
import { describe, expect, test } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

const FIXTURE_PATH = resolve(import.meta.dirname, "__fixtures__/syllabus.txt");

describe("actions/uploadSyllabus - integration (real Gemini API)", () => {
  test("extracts tasks from fixture syllabus and prints results", async () => {
    const fixtureText = existsSync(FIXTURE_PATH)
      ? readFileSync(FIXTURE_PATH, "utf8")
      : "";
    const isPlaceholder = fixtureText.startsWith("Paste or type");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.log(
        "\n[integration] Skipped: set GEMINI_API_KEY=your-key before the npm test command."
      );
      return;
    }
    if (!fixtureText || isPlaceholder) {
      console.log(
        "\n[integration] Skipped: replace the placeholder in backend/convex/tests/__fixtures__/syllabus.txt with real syllabus text."
      );
      return;
    }

    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const result = await withAuth.action(
      api.actions.uploadSyllabus.uploadSyllabus,
      { fileContents: fixtureText }
    );

    console.log("\n=== Gemini extraction result ===");
    console.log("syllabusId:", result.syllabusId);
    console.log("extractedTasks:", JSON.stringify(result.extractedTasks, null, 2));

    expect(result.syllabusId).toBeDefined();
    expect(Array.isArray(result.extractedTasks)).toBe(true);
  }, 60_000);
});
