import { test as base, expect } from "@playwright/test";

// Accueil invité tel quel : la carte « Pays du Monde » est la première du carrousel et celle affichée par défaut.
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
  // Même accueil, en attendant la carte « Pays du Monde » (1re carte) : les scénarios solo partent de là.
  // Conquête n'apparaît en 1re carte que si le mode est activé (Supabase + VITE_ENABLE_CONQUEST).
  guestPage: async ({ page }, use) => {
    await openGuestHome(page);
    await page.locator(".ui-card--mode-deck.is-top-card").waitFor();
    await showMode(page, "countries");
    await use(page);
  },
});

/** Fait défiler le carrousel (flèche droite) jusqu'à la carte `modeKey`, quel que soit l'ordre. */
export async function showMode(page, modeKey) {
  const topCard = page.locator(".ui-card--mode-deck.is-top-card");
  for (let i = 0; i < 8; i++) {
    if ((await topCard.getAttribute("data-mode")) === modeKey) return topCard;
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(250);
  }
  await expect(topCard).toHaveAttribute("data-mode", modeKey);
  return topCard;
}

/** Les panneaux (profil…) peuvent se démonter à la fermeture : on vérifie qu'aucun n'est ouvert. */
export async function expectPanelClosed(page, panelSelector) {
  await expect(page.locator(`${panelSelector}.open`)).toHaveCount(0);
}

export { expect };
