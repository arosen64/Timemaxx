import { httpRouter } from "convex/server";
import type { Hono } from "hono";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { calendarOAuthCallback } from "./calendarOAuthCallback";
import chatApp from "./http_chat";
import type { HonoEnv } from "./lib/httpTypes";

const http = httpRouter();

// ── Auth routes (required by @convex-dev/auth) ──────────────────
auth.addHttpRoutes(http);

// ── Shared handler factory ──────────────────────────────────────

function makeApiHandler(app: Hono<HonoEnv>, path: string) {
  const handler = httpAction(async (ctx, request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    let userId: Id<"users"> | null = null;
    try {
      userId = await getAuthUserId(ctx) as Id<"users"> | null;
    } catch {
      // invalid token — fall through to 401
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const env = { ctx, userId };

    const url = new URL(request.url);
    url.pathname = path;
    const rewritten = new Request(url.toString(), request);

    try {
      const response = await app.fetch(rewritten, env);

      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders())) {
        headers.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${path}] error:`, msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
  });

  http.route({ path, method: "POST", handler });
  http.route({ path, method: "OPTIONS", handler });
}

// ── API endpoints ───────────────────────────────────────────────

http.route({
  path: "/api/calendar/callback",
  method: "GET",
  handler: calendarOAuthCallback,
});

makeApiHandler(chatApp, "/api/chat");

// ── CORS helpers ────────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
  const origin = process.env.SITE_URL ?? "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export default http;
