import { test, expect } from "@playwright/test";
import { LandingPage } from "../fixtures/landing";

test.describe("Landing page", () => {
  test("renders the marketing hero and login card", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();

    await expect(landing.heroHeading).toBeVisible();
    await expect(landing.welcomeHeading).toBeVisible();
    await expect(landing.googleSignInButton).toBeVisible();
    await expect(landing.googleSignInButton).toBeEnabled();
  });

  test("includes the JHU branding line", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Johns Hopkins University/i)).toBeVisible();
    await expect(page.getByText(/Timemaxx/i).first()).toBeVisible();
  });

  test("has the expected document title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Timemaxx/i);
  });
});
