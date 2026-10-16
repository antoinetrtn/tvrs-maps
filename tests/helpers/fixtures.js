import { test as base } from "@playwright/test";

// Accueil invité tel quel : la carte Conquête est la première du carrousel et celle affichée par défaut.
async function openGuestHome(page) {
  await page.addInitScript(() => {
    localStorage.setItem("tvrs-guest-mode", "true");
  });
  await page.goto("/");
}

export const test = base.extend({
  freshGuestPage: async ({ page }, use) => {
    await openGuestHome(page);
    await use(page);
  },
  // Même accueil, mais sur la carte « Pays du Monde » (2e carte) : les scénarios solo historiques partent de là.
  guestPage: async ({ page }, use) => {
    await openGuestHome(page);
    await page.locator(".deck-dots-row .deck-dot").nth(1).click();
    await page.locator('.deck-mode-card.is-top-card[data-mode="countries"]').waitFor();
    await use(page);
  },
});

export { expect } from "@playwright/test";
