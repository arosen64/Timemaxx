import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { calendarOAuthCallback } from "./calendarOAuthCallback";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { MastraClient } from "@mastra/client-js";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/api/calendar/callback",
  method: "GET",
  handler: calendarOAuthCallback,
});

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? process.env.SITE_URL ?? "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
  };
}

http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const cors = corsHeaders(req);
    try {
      let userId;
      try {
        userId = await getAuthUserId(ctx);
      } catch {
        return new Response("Unauthorized", { status: 401, headers: cors });
      }
      if (!userId) return new Response("Unauthorized", { status: 401, headers: cors });

      const { message } = await req.json() as { message: string };
      if (!message?.trim()) return new Response("Bad Request", { status: 400, headers: cors });

      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        role: "user",
        content: message,
      });

      const mastraUrl = process.env.MASTRA_URL ?? "http://localhost:4112";
      const client = new MastraClient({ baseUrl: mastraUrl });
      const agent = client.getAgent("chat-agent");
      const result = await agent.generate({ messages: [{ role: "user", content: message }] });
      const aiText = result.text ?? "";

      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        role: "assistant",
        content: aiText,
      });

      return new Response(JSON.stringify({ text: aiText }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[/api/chat] error:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
  }),
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, req) => {
    return new Response(null, {
      headers: {
        ...corsHeaders(req),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

export default http;