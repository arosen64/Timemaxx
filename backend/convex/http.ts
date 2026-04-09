import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { calendarOAuthCallback } from "./calendarOAuthCallback";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/api/calendar/callback",
  method: "GET",
  handler: calendarOAuthCallback,
});

http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { message } = await req.json() as { message: string };
    if (!message?.trim()) return new Response("Bad Request", { status: 400 });

    // Save user message
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      role: "user",
      content: message,
    });

    const mastraUrl = process.env.MASTRA_URL ?? "http://localhost:4111";

    // Forward to Mastra and stream back
    const mastraRes = await fetch(
      `${mastraUrl}/api/agents/chatAgent/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: message }],
        }),
      }
    );

    if (!mastraRes.ok || !mastraRes.body) {
      return new Response("Agent error", { status: 502 });
    }

    // Buffer the full response so we can save it, then re-stream to client
    const reader = mastraRes.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      fullText += decoder.decode(value, { stream: true });
    }

    // Save assistant response - parse Mastra 1.x SSE format (text-delta events)
    const plainText = fullText
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => {
        try {
          const parsed = JSON.parse(line.slice(6));
          return parsed.type === "text-delta" ? (parsed.payload?.text ?? "") : "";
        } catch { return ""; }
      })
      .join("");

    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      role: "assistant",
      content: plainText || fullText,
    });

    // Re-stream the original bytes to the browser
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;