import { Hono } from "hono";
import { MastraClient } from "@mastra/client-js";
import { internal } from "./_generated/api";
import type { HonoEnv } from "./lib/httpTypes";

const chatApp = new Hono<HonoEnv>();

chatApp.post("/api/chat", async (c) => {
  const { ctx, userId } = c.env;

  const body = await c.req.json<{ message?: string; sessionId?: string }>();
  const message = body.message?.trim();
  const sessionId = body.sessionId?.trim();
  if (!message || !sessionId) {
    return c.json({ error: "Bad Request" }, 400);
  }

  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "user",
    content: message,
  });

  const mastraUrl = process.env.MASTRA_URL;
  if (!mastraUrl) return c.json({ error: "MASTRA_URL not configured" }, 503);
  const client = new MastraClient({ baseUrl: mastraUrl });

  // Run supervisor workflow to clarify and route the query
  const workflow = client.getWorkflow("supervisor-workflow");
  const run = await workflow.startAsync({ inputData: { query: message } });

  // Check if any step failed (e.g. quota exceeded — Mastra swallows step errors instead of throwing)
  for (const step of Object.values(run.steps ?? {})) {
    if (!("output" in step)) {
      const errMsg = (step as { error?: string }).error ?? "";
      if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
        return c.json({ error: "quota_exceeded" }, 429);
      }
    }
  }

  const respondStep = run.steps?.["respond"];
  const output = (respondStep && "output" in respondStep ? respondStep.output : null) as {
    status: string;
    clarifyingQuestion: string | null;
    route: string | null;
    cannedResponse: string | null;
  } | null;

  // Clarification needed
  if (output?.status === "needs_clarification" && output.clarifyingQuestion) {
    const aiText = output.clarifyingQuestion;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId, sessionId, role: "assistant", content: aiText,
    });
    return c.json({ text: aiText, status: "needs_clarification" });
  }

  // Canned response for page-specific routes (classes, schedule)
  if (output?.cannedResponse) {
    const aiText = output.cannedResponse;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId, sessionId, role: "assistant", content: aiText,
    });
    return c.json({ text: aiText, status: "routed", route: output.route });
  }

  const route = output?.route ?? null;
  const routeLabel = route ? `Routed to: **${route}**` : "";
  return c.json({ text: routeLabel, status: "routed", route });

});

export default chatApp;
