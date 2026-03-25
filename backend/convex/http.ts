import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { calendarOAuthCallback } from "./calendarOAuthCallback";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/api/calendar/callback",
  method: "GET",
  handler: calendarOAuthCallback,
});

export default http;