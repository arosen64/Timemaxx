import { test, expect } from "@playwright/test";

test.describe("Landing page content & accessibility", () => {
  test("lists the three product feature bullets", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/AI-powered time estimation/i)).toBeVisible();
    await expect(page.getByText(/Personalized daily study windows/i)).toBeVisible();
    await expect(page.getByText(/Smart scheduling around your life/i)).toBeVisible();
  });

  test("shows the Terms / Privacy disclosure", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/By signing in, you agree to our Terms of Service and Privacy Policy/i)
    ).toBeVisible();
  });

  test("the Google sign-in button is keyboard-focusable", async ({ page }) => {
    await page.goto("/");

    const googleButton = page.getByRole("button", { name: /sign in with google/i });
    await googleButton.focus();
    await expect(googleButton).toBeFocused();
  });

  test("has exactly one h1 heading on the page", async ({ page }) => {
    await page.goto("/");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("renders the brand logo wordmark in the hero", async ({ page }) => {
    await page.goto("/");
    // Logo + wordmark live inside the hero panel.
    const wordmark = page.getByText("Timemaxx", { exact: true }).first();
    await expect(wordmark).toBeVisible();
  });
});
