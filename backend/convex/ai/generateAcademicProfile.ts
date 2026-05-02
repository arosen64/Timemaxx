import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callGemini } from "../lib/gemini";
import { sanitizeUserInput } from "../lib/sanitize";
import {
  ACADEMIC_PROFILE_SYSTEM,
  buildAcademicProfilePrompt,
  academicProfileResponseSchema,
} from "../lib/prompts/generateAcademicProfile.prompt";

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

    const courseList = args.courses
      .map(
        (c) =>
          `${c.title}${c.grade ? ` (${c.grade})` : ""}${c.term ? ` — ${c.term}` : ""}${c.difficultyRating != null ? ` [difficulty: ${c.difficultyRating}/5]` : ""}`
      )
      .join("\n");

    const sanitizedCourseList = sanitizeUserInput(courseList, 50_000);

    const result = await callGemini({
      system: ACADEMIC_PROFILE_SYSTEM,
      prompt: buildAcademicProfilePrompt(sanitizedCourseList),
      schema: academicProfileResponseSchema,
      schemaName: "AcademicProfile",
      obs: {
        ctx,
        callSite: "generateAcademicProfile",
        userId,
        metadata: { courseCount: args.courses.length },
      },
    });

    return (result.insights ?? []).slice(0, 5);
  },
});
