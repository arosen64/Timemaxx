import { internal } from "../_generated/api";
import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { GRADE_SET, STUDY_GOAL_SET } from "../../../shared/courseEnums";
import { isPastTerm } from "./terms";
import type { ChatWorkflowOutput, SisResolvedPick } from "./chatWorkflowHttpTypes";

type SisRow = { OfferingName?: string; Title?: string; Credits?: string };

function isValidDifficultyRating(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

async function addCourseFromOutput(
  ctx: ActionCtx,
  output: ChatWorkflowOutput,
  resolvedSisPick: SisResolvedPick | undefined,
): Promise<void> {
  if (!output.sisQuery || !output.term || !output.school) {
    throw new Error("Missing required course fields (query, term, or school).");
  }

  let offeringName: string;
  let titleText: string;
  let credits: number | undefined;

  if (resolvedSisPick) {
    offeringName = resolvedSisPick.offeringName;
    titleText = resolvedSisPick.title;
  } else {
    const sisResults = (await ctx.runAction(api.actions.jhuCourses.getCoursesByTerm, {
      term: output.term,
      school: output.school,
      courseTitle: output.sisQuery,
    })) as SisRow[];
    if (!Array.isArray(sisResults) || sisResults.length === 0) {
      throw new Error("I could not find a matching SIS course. Please provide a more specific code or title.");
    }
    const normalizedQuery = output.sisQuery.trim().toLowerCase();
    const exact =
      sisResults.find((c) =>
        `${c.OfferingName ?? ""} ${c.Title ?? ""}`.toLowerCase().includes(normalizedQuery),
      ) ?? sisResults[0];
    const on = exact.OfferingName;
    const tt = exact.Title;
    if (!on || !tt) {
      throw new Error("SIS result is missing course code/title.");
    }
    offeringName = on;
    titleText = tt;
    credits = exact.Credits ? Number.parseFloat(exact.Credits) : undefined;
  }

  const isPast = isPastTerm(output.term);
  if (isPast) {
    if (!output.grade || !GRADE_SET.has(output.grade)) {
      throw new Error("For past terms, grade must be one of the app's allowed grade options.");
    }
    if (output.difficultyRating === null || !isValidDifficultyRating(output.difficultyRating)) {
      throw new Error("For past terms, difficulty rating must be a whole number from 1 to 5.");
    }
  } else if (!output.studyGoal || !STUDY_GOAL_SET.has(output.studyGoal)) {
    throw new Error("For current/future terms, study goal must be one of: Just pass, Do well, Ace it.");
  }

  let description: string | undefined;
  let prereqs: string[] | undefined;
  try {
    const details = (await ctx.runAction(api.actions.jhuCourses.getCourseDetails, {
      offeringName,
      term: output.term,
    })) as { description?: string; prereqs?: string[]; credits?: number } | null;
    if (details) {
      description = typeof details.description === "string" ? details.description : undefined;
      prereqs = Array.isArray(details.prereqs) ? details.prereqs : undefined;
      if (credits === undefined && typeof details.credits === "number" && !Number.isNaN(details.credits)) {
        credits = details.credits;
      }
    }
  } catch {
    // Best effort only: keep add flow resilient.
  }

  const fullTitle = `${offeringName}: ${titleText}`;
  await ctx.runMutation(api.mutations.userCourses.addUserCourse, {
    courseCode: offeringName,
    title: fullTitle,
    description,
    prereqs,
    credits,
    term: output.term,
    studyGoal: !isPast ? output.studyGoal ?? undefined : undefined,
    grade: isPast ? output.grade ?? undefined : undefined,
    difficultyRating: isPast ? output.difficultyRating ?? undefined : undefined,
  });
}

async function dropCourseFromOutput(
  ctx: ActionCtx,
  userId: Id<"users">,
  sessionId: string,
  activeCourseId: Id<"userCourses"> | undefined,
  output: ChatWorkflowOutput,
): Promise<{ aiText: string; clearedScope: boolean }> {
  if (activeCourseId === undefined) throw new Error("No class selected.");
  const existing = await ctx.runQuery(internal.queries.userCourses.getUserCoursesByIdsInternal, {
    courseIds: [activeCourseId],
  });
  const target = existing[0];
  await ctx.runMutation(api.mutations.userCourses.deleteUserCourse, {
    userCourseId: activeCourseId,
  });
  await ctx.runMutation(internal.mutations.chatSessions.setMessageScopeInternal, {
    userId,
    sessionId,
    clear: true,
  });
  return {
    aiText: target ? `Done! I removed **${target.title}** from your classes.` : output.reply,
    clearedScope: true,
  };
}

async function updateCourseFromOutput(
  ctx: ActionCtx,
  userId: Id<"users">,
  sessionId: string,
  activeCourseId: Id<"userCourses"> | undefined,
  output: ChatWorkflowOutput,
): Promise<{ clearedScope: boolean }> {
  if (activeCourseId === undefined) throw new Error("No class selected.");
  const patch: {
    userCourseId: Id<"userCourses">;
    studyGoal?: string;
    grade?: string;
    difficultyRating?: number;
  } = { userCourseId: activeCourseId };

  if (output.studyGoal !== null) {
    if (!STUDY_GOAL_SET.has(output.studyGoal)) {
      throw new Error("Study goal must be one of: Just pass, Do well, Ace it.");
    }
    patch.studyGoal = output.studyGoal;
  }
  if (output.grade !== null) {
    if (!GRADE_SET.has(output.grade)) {
      throw new Error("Grade must match one of the app's allowed grade options.");
    }
    patch.grade = output.grade;
  }
  if (output.difficultyRating !== null) {
    if (!isValidDifficultyRating(output.difficultyRating)) {
      throw new Error("Difficulty rating must be a whole number from 1 to 5.");
    }
    patch.difficultyRating = output.difficultyRating;
  }

  if (patch.studyGoal === undefined && patch.grade === undefined && patch.difficultyRating === undefined) {
    throw new Error("No supported course updates were provided.");
  }

  await ctx.runMutation(api.mutations.userCourses.updateUserCourse, patch);
  await ctx.runMutation(internal.mutations.chatSessions.setMessageScopeInternal, {
    userId,
    sessionId,
    clear: true,
  });
  return { clearedScope: true };
}

async function viewCoursesFromOutput(
  ctx: ActionCtx,
  userId: Id<"users">,
  sessionId: string,
  activeCourseId: Id<"userCourses"> | undefined,
  output: ChatWorkflowOutput,
): Promise<{ aiText: string; clearedScope: boolean }> {
  if (activeCourseId !== undefined) {
    const selected = await ctx.runQuery(internal.queries.userCourses.getUserCoursesByIdsInternal, {
      courseIds: [activeCourseId],
    });
    const c = selected[0];
    let aiText = output.reply;
    if (c) {
      const attrs: string[] = [];
      if (c.term) attrs.push(`Term: ${c.term}`);
      if (c.studyGoal) attrs.push(`Study goal: ${c.studyGoal}`);
      if (c.grade) attrs.push(`Grade: ${c.grade}`);
      if (c.difficultyRating !== undefined) attrs.push(`Difficulty: ${c.difficultyRating}/5`);
      aiText = [
        `Here are the details for **${c.title}**:`,
        attrs.length > 0 ? attrs.map((a) => `- ${a}`).join("\n") : "- No additional details recorded yet.",
      ].join("\n");
    }
    await ctx.runMutation(internal.mutations.chatSessions.setMessageScopeInternal, {
      userId,
      sessionId,
      clear: true,
    });
    return { aiText, clearedScope: true };
  }

  const courses = await ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, {
    userId,
  });
  let aiText: string;
  if (courses.length === 0) {
    aiText = "You don't have any classes added yet. Add one from the Classes page or ask me to add one.";
  } else {
    const current = courses.filter((c) => !isPastTerm(c.term ?? ""));
    const past = courses.filter((c) => isPastTerm(c.term ?? ""));
    const lines: string[] = [];
    if (current.length > 0) {
      lines.push("Current classes:");
      for (const c of current.slice(0, 8)) {
        lines.push(`- ${c.courseCode}: ${c.title}${c.term ? ` (${c.term})` : ""}`);
      }
    }
    if (past.length > 0) {
      lines.push(current.length > 0 ? "\nPast classes:" : "Past classes:");
      for (const c of past.slice(0, 8)) {
        lines.push(`- ${c.courseCode}: ${c.title}${c.term ? ` (${c.term})` : ""}`);
      }
    }
    const hidden = Math.max(0, courses.length - 16);
    if (hidden > 0) {
      lines.push(`\n...and ${hidden} more.`);
    }
    aiText = lines.join("\n");
  }
  return { aiText, clearedScope: false };
}

export async function executeCourseAction(
  ctx: ActionCtx,
  params: {
    userId: Id<"users">;
    sessionId: string;
    activeCourseId?: Id<"userCourses">;
    output: ChatWorkflowOutput;
    resolvedSisPick?: SisResolvedPick;
  },
): Promise<string> {
  const { userId, sessionId, activeCourseId, output } = params;
  const resolvedSisPick = params.resolvedSisPick;
  let aiText = output.reply;
  let clearedScopeAfterAction = false;

  try {
    if (output.actionType === "add_course") {
      await addCourseFromOutput(ctx, output, resolvedSisPick);
      clearedScopeAfterAction = true;
    } else if (output.actionType === "drop_course") {
      const r = await dropCourseFromOutput(ctx, userId, sessionId, activeCourseId, output);
      aiText = r.aiText;
      clearedScopeAfterAction = r.clearedScope;
    } else if (output.actionType === "update_course") {
      const r = await updateCourseFromOutput(ctx, userId, sessionId, activeCourseId, output);
      clearedScopeAfterAction = r.clearedScope;
    } else if (output.actionType === "view_courses") {
      const r = await viewCoursesFromOutput(ctx, userId, sessionId, activeCourseId, output);
      aiText = r.aiText;
      clearedScopeAfterAction = r.clearedScope;
    }
  } catch (err) {
    aiText = `Sorry, I ran into an issue: ${err instanceof Error ? err.message : "Please try again."}`;
  }

  await ctx.runMutation(internal.mutations.chatSessions.clearAgentStateInternal, {
    userId,
    sessionId,
  });
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: aiText,
    ...(activeCourseId !== undefined && !clearedScopeAfterAction ? { courseId: activeCourseId } : {}),
  });
  return aiText;
}
