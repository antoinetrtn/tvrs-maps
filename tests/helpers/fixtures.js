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

/**
 * Passe à la carte voisine du carrousel : flèche sur desktop, swipe sur écran tactile
 * (les flèches y sont masquées par design, cf. HomeScreenCategoryCarousel.css).
 */
export async function deckStep(page, dir = "right") {
  const arrow = page.locator(`.deck-click-zone.${dir} button`);
  if (await arrow.isVisible()) {
    await arrow.click({ force: true });
    return;
  }
  const box = await page.locator(".deck-stage").boundingBox();
  const y = box.y + box.height / 2;
  const [from, to] = dir === "right" ? [0.8, 0.2] : [0.2, 0.8];
  await page.mouse.move(box.x + box.width * from, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to, y, { steps: 8 });
  await page.mouse.up();
}

/** Sur mobile, le panneau de données du mode Apprendre s'ouvre via le bouton du HUD. */
export async function openLearnPanel(page) {
  const btn = page.getByRole("button", { name: "Tableau des données" });
  await page.waitForTimeout(400);
  if (await btn.isVisible()) await btn.click();
}

export { expect };
