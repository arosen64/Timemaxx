import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { MastraClient } from "@mastra/client-js";
import { sanitizeUserInput } from "../lib/sanitize";
import { withTimeout } from "../lib/withTimeout";

export interface AcademicInsight {
  label: string;
  text: string;
}

export const generateAcademicProfile = action({
  args: {
    courses: v.array(
      v.object({
        title: v.string(),
        grade: v.optional(v.string()),
        term: v.optional(v.string()),
        difficultyRating: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<AcademicInsight[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) throw new Error("MASTRA_URL not configured");

    const courseList = args.courses
      .map(
        (c) =>
          `${c.title}${c.grade ? ` (${c.grade})` : ""}${c.term ? ` — ${c.term}` : ""}${c.difficultyRating != null ? ` [difficulty: ${c.difficultyRating}/5]` : ""}`
      )
      .join("\n");

    const sanitizedCourseList = sanitizeUserInput(courseList, 50_000);

    const client = new MastraClient({ baseUrl: mastraUrl });
    const wf = client.getWorkflow("academic-profile-workflow");
    const run = await withTimeout(
      wf.startAsync({ inputData: { sanitizedCourseList } }),
      "Academic profile generation"
    );

    const profileStep = run.steps?.["generate-profile"] as
      | { status: string; output?: { insights?: AcademicInsight[] }; error?: string | Error }
      | undefined;

    if (!profileStep || profileStep.status !== "success") {
      const cause = profileStep?.error ? String(profileStep.error) : "step did not complete";
      throw new Error(`Academic profile generation failed: ${cause}`);
    }

    return (profileStep.output?.insights ?? []).slice(0, 5);
  },
});
