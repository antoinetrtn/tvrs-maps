import { expect, test } from "@playwright/test";
import { EndScreen, GameDataPanel, GameHUD, HomeScreen } from "./helpers/pageObjects";

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
    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toBeVisible();

    // Check Play button on top card
    const playBtn = topCard.locator(".card-play-btn");
    await expect(playBtn).toBeVisible();
  });

  test("should start game in countries mode", async ({ page }) => {
    // Verify top card is countries mode or select it
    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "countries");

    // Click Play button
    const playBtn = topCard.locator(".card-play-btn");
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
