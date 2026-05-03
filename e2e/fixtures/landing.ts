import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the public landing page (`/`).
 *
 * Authenticated flows are covered separately; this object only exposes
 * elements that are visible to anonymous visitors.
 */
export class LandingPage {
  readonly page: Page;
  readonly heroHeading: Locator;
  readonly welcomeHeading: Locator;
  readonly googleSignInButton: Locator;
  readonly guestSignInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroHeading = page.getByRole("heading", { name: /study smarter/i });
    this.welcomeHeading = page.getByRole("heading", { name: /welcome back/i });
    this.googleSignInButton = page.getByRole("button", { name: /sign in with google/i });
    this.guestSignInButton = page.getByRole("button", { name: /continue as guest/i });
  }

  async goto() {
    await this.page.goto("/");
  }
}
