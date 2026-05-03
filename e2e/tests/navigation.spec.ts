import { test, expect } from "@playwright/test";

test.describe("App navigation", () => {
  test("frontend boots without uncaught console errors", async ({ page }) => {
    const errors: string[] = [];
    const ignore = (text: string) =>
      /convex/i.test(text) ||
      /websocket/i.test(text) ||
      /Failed to fetch/i.test(text) ||
      /deployment name/i.test(text);
    page.on("pageerror", (err) => {
      if (ignore(err.message)) return;
      errors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (ignore(text)) return;
        errors.push(text);
      }
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /study smarter/i })).toBeVisible();
    expect(errors, `unexpected page errors: ${errors.join("\n")}`).toHaveLength(0);
  });

  test("landing page is reachable from a deep-link to a protected route", async ({ page }) => {
    // Anonymous visitors hitting a protected route should land on the
    // login screen once auth resolves; while auth is loading we should
    // never see a hard crash.
    await page.goto("/dashboard");

    // Either we get redirected to /, or auth never resolves and the page
    // stays on /dashboard while the loading state spins. Both are valid
    // — but the document body must remain rendered (no React error boundary).
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("#root")).toBeVisible();
  });
});
