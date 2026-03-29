import { describe, expect, test } from "vitest";
import { auth, signIn, signOut, store } from "../auth";
import http from "../http";

/**
 * Backend surface for the landing page: Google sign-in via @convex-dev/auth
 * and HTTP routes for OAuth. The landing UI does not call Convex queries; after
 * sign-in, `getCurrUser` / `isOnboardingComplete` are covered in users.queries.test.ts.
 */

describe("auth config (landing — Sign in with Google)", () => {
  test("exports Convex Auth bindings used by the client", () => {
    expect(auth).toBeDefined();
    expect(typeof signIn).toBe("function");
    expect(typeof signOut).toBe("function");
    expect(store).toBeDefined();
  });
});

describe("HTTP router (auth OAuth + calendar callback)", () => {
  test("registers Convex Auth routes for sign-in and OAuth callback", () => {
    const routes = http.getRoutes();
    const paths = routes.map(([path]) => path).join(" ");
    expect(paths).toMatch(/\/api\/auth\/signin\//);
    expect(paths).toMatch(/\/api\/auth\/callback\//);
  });

  test("registers Google Calendar OAuth callback used after onboarding", () => {
    const routes = http.getRoutes();
    const match = routes.find(
      ([path, method]) => path === "/api/calendar/callback" && method === "GET"
    );
    expect(match).toBeDefined();
  });
});
