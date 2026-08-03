import { test as base } from "@playwright/test";

export const test = base.extend({
  guestPage: async ({ page }, use) => {
    // Inject guest mode setting before page scripts load
    await page.addInitScript(() => {
      localStorage.setItem("tvrs-guest-mode", "true");
    });
    await page.goto("/");
    await use(page);
  },
});

export { expect } from "@playwright/test";
