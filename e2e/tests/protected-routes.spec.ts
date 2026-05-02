import { test, expect } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/schedule",
  "/profile",
  "/preferences",
  "/classes",
  "/onboarding",
  "/syllabus-review",
];

test.describe("Protected routes (anonymous)", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`deep-linking to ${route} does not crash the app`, async ({ page }) => {
      await page.goto(route);
      // The React root should mount successfully — no error boundary, no blank page.
      await expect(page.locator("#root")).toBeVisible();
      await expect(page.locator("#root")).not.toBeEmpty();
    });
  }
});

test.describe("Unknown routes", () => {
  test("an unknown route renders something (catch-all behavior)", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.locator("#root")).toBeVisible();
    // Either the router catches it and shows the landing page elements, or the
    // app renders a not-found state — in both cases the body must be non-empty.
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
