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
    let userId;
    try {
      userId = await getAuthUserId(ctx);
    } catch {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders(req) });
    }
    if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders(req) });

    const { message } = await req.json() as { message: string };
    if (!message?.trim()) return new Response("Bad Request", { status: 400, headers: corsHeaders(req) });

    // Save user message
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      role: "user",
      content: message,
    });

    // Run the Mastra agent inside Convex (no external server needed)
    const aiText = await ctx.runAction(internal.chatAgent.chat, { message });

    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      role: "assistant",
      content: aiText ?? "",
    });

    return new Response(JSON.stringify({ text: aiText }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(req),
      },
    });
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