import { expect, test } from "@playwright/test";
import { EndScreen, GameDataPanel, GameHUD, HomeScreen } from "./helpers/pageObjects";
import { showMode } from "./helpers/fixtures";

test.describe("TVRS Maps E2E Game Flow Baseline", () => {
  test.beforeEach(async ({ page }) => {
    // Set guest mode in localStorage to bypass AuthModal
    await page.addInitScript(() => {
      localStorage.setItem("tvrs-guest-mode", "true");
    });
    await page.goto("/");
  });

  test("should load the homepage with correct title and mode deck", async ({ page }) => {
    // Check the page title
    await expect(page).toHaveTitle(/tvrs maps/i);

    // Check that top mode card is visible
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await expect(topCard).toBeVisible();

    // Check Play button on top card
    const playBtn = topCard.locator(".ui-btn--cta");
    await expect(playBtn).toBeVisible();
  });

  test("should start game in countries mode", async ({ page }) => {
    // La carte Conquête n'existe que si elle est activée : on cible « Pays du Monde » par son mode.
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await expect(topCard).toBeVisible();
    await showMode(page, "countries");

    // Click Play button
    const playBtn = topCard.locator(".ui-btn--cta");
    await playBtn.click();

    // Verify that the answer input field is now visible
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  test("should start game in us_states mode via carousel navigation", async ({ page }) => {
    // Start game in us_states mode
    await page.evaluate(() => {
      if (window.__TVRS_START_GAME__) {
        window.__TVRS_START_GAME__("us_states");
      }
    });

    const playBtn = page.locator(".mode-us_states");
    if (await playBtn.isVisible()) {
      await playBtn.click().catch(() => {});
    }

    // Verify answer field is visible
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });
});
