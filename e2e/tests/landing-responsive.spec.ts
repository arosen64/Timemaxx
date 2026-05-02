import { test, expect, devices } from "@playwright/test";

test.describe("Landing page responsive behavior", () => {
  test("renders the hero panel and login card on a mobile viewport", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /study smarter/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();

    await context.close();
  });

  test("renders both panels side by side on a desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const hero = page.getByRole("heading", { name: /study smarter/i });
    const welcome = page.getByRole("heading", { name: /welcome back/i });

    const heroBox = await hero.boundingBox();
    const welcomeBox = await welcome.boundingBox();

    expect(heroBox, "hero heading must be visible").not.toBeNull();
    expect(welcomeBox, "welcome heading must be visible").not.toBeNull();

    // On md+ breakpoints the layout is row-based, so the two headings
    // share a similar y position and are horizontally separated.
    expect(welcomeBox!.x).toBeGreaterThan(heroBox!.x + heroBox!.width / 2);
  });

  test("stacks the panels vertically on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const hero = page.getByRole("heading", { name: /study smarter/i });
    const welcome = page.getByRole("heading", { name: /welcome back/i });

    const heroBox = await hero.boundingBox();
    const welcomeBox = await welcome.boundingBox();

    expect(heroBox).not.toBeNull();
    expect(welcomeBox).not.toBeNull();
    // On a narrow viewport the "Welcome back" card sits below the hero.
    expect(welcomeBox!.y).toBeGreaterThan(heroBox!.y);
  });
});
