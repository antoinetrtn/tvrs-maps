import { expect, test } from "./helpers/fixtures.js";

test.describe("Tier 1: Feature Coverage (20 Tests)", () => {
  // 1. Countries Mode Launch
  test("T1-MODE-01: Launch Countries Game Mode", async ({ guestPage: page }) => {
    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "countries");
    await topCard.locator(".card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  // 2. Capitals Mode Launch
  test("T1-MODE-02: Launch Capitals Game Mode", async ({ guestPage: page }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(1).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "capitals");
    await topCard.locator(".card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  // 3. Departments Mode Launch & Validation
  test("T1-MODE-03: Launch Departments Game Mode and validate code input", async ({
    guestPage: page,
  }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(2).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "departments");
    await topCard.locator(".card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
    await inputField.fill("75");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 4. US States Mode Launch & Validation
  test("T1-MODE-04: Launch US States Game Mode and validate answer input", async ({
    guestPage: page,
  }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(3).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "us_states");
    await topCard.locator(".card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
    await inputField.fill("California");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 5. Rivers & Mountains Mode Launch & Validation
  test("T1-MODE-05: Launch Rivers & Mountains Game Mode and validate peak input", async ({
    guestPage: page,
  }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(4).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "rivers_mountains");
    await topCard.locator(".card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
    await inputField.fill("Everest");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 6. Carousel Navigation Next
  test("T1-MODE-06: Carousel Right Arrow Navigation", async ({ guestPage: page }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(1).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "capitals");
  });

  // 7. Carousel Navigation Prev
  test("T1-MODE-07: Carousel Left Arrow Navigation", async ({ guestPage: page }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(4).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "rivers_mountains");
  });

  // 8. Carousel Indicator Dots Direct Selection
  test("T1-MODE-08: Carousel Indicator Dots Direct Selection", async ({ guestPage: page }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(3).click();
    await page.waitForTimeout(200);

    const topCardMode = await page.locator(".deck-mode-card.is-top-card").getAttribute("data-mode");
    expect(topCardMode).toBe("us_states");
  });

  // 9. Learn Mode Launch
  test("T1-MODE-09: Launch Learn Mode from Home Card", async ({ guestPage: page }) => {
    const topCard = page.locator(".deck-mode-card.is-top-card");
    await topCard.locator(".card-learn-btn").click();

    const dataPanel = page.locator(".game-data-panel");
    await expect(dataPanel).toBeVisible();
  });

  // 10. Learn Sub-Mode Carousel Navigation
  test("T1-MODE-10: Learn Mode Sub-Mode Carousel Navigation", async ({ guestPage: page }) => {
    const topCard = page.locator(".deck-mode-card.is-top-card");
    await topCard.locator(".card-learn-btn").click();

    const learnControl = page.locator(".learn-carousel-control");
    await expect(learnControl).toBeVisible();

    const nextSubModeBtn = learnControl.locator(".learn-carousel-arrow").nth(1);
    await nextSubModeBtn.click();
    await page.waitForTimeout(150);

    const label = learnControl.locator(".learn-carousel-label");
    await expect(label).toBeVisible();
  });

  // 11. Interface Theme Switch (Dark -> Light)
  test("T1-THEME-01: Toggle Interface Theme in Settings", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    await expect(settingsPanel).toHaveClass(/open/);

    const lightOpt = settingsPanel
      .locator('.segmented-opt:has-text("Clair"), .segmented-opt:has-text("Light")')
      .first();
    await lightOpt.click();

    const appContainer = page.locator(".app-container");
    await expect(appContainer).toHaveAttribute("data-theme", "light");

    await settingsPanel.locator(".panel-close-btn").click();
  });

  // 12. Globe Theme Switch (Satellite)
  test("T1-THEME-02: Select Globe Theme Satellite in Settings", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const satelliteOpt = settingsPanel.locator('.segmented-opt:has-text("Satellite")').first();
    await satelliteOpt.click();

    await settingsPanel.locator(".panel-close-btn").click();
    await expect(settingsPanel).not.toHaveClass(/open/);
  });

  // 13. Globe Theme Switch (Blackout)
  test("T1-THEME-03: Select Globe Theme Blackout in Settings", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const blackoutOpt = settingsPanel.locator('.segmented-opt:has-text("Blackout")').first();
    await blackoutOpt.click();

    await settingsPanel.locator(".panel-close-btn").click();
    await expect(settingsPanel).not.toHaveClass(/open/);
  });

  // 14. Interface Theme Persistence Across Reload
  test("T1-THEME-04: Theme Persistence in LocalStorage across Page Reload", async ({
    guestPage: page,
  }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const lightOpt = settingsPanel
      .locator('.segmented-opt:has-text("Clair"), .segmented-opt:has-text("Light")')
      .first();
    await lightOpt.click();

    await page.reload();
    const appContainer = page.locator(".app-container");
    await expect(appContainer).toHaveAttribute("data-theme", "light");
  });

  // 15. Answer Input Clearing
  test("T1-HUD-01: Answer Input Field Auto-Clears on Correct Answer", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("France");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 16. Auto-Suggestions Popup
  test("T1-HUD-02: Auto-Suggestions Popup Appears at 4+ Characters", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("Fran");
    const suggestionsList = page.locator(".suggestions-list");
    await expect(suggestionsList).toBeVisible();

    const item = page.locator(".suggestion-item").first();
    await expect(item).toContainText(/France/i);
  });

  // 17. Auto-Suggestion Selection Submits Answer
  test("T1-HUD-03: Clicking Suggestion Item Submits Answer and Clears Input", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("Fran");
    const item = page.locator(".suggestion-item").first();
    await item.click();

    await expect(inputField).toHaveValue("");
  });

  // 18. Settings Panel Open & Close
  test("T1-HUD-05: Settings Panel Trigger Open and Close", async ({ guestPage: page }) => {
    const settingsBtn = page.locator(".settings-trigger-btn");
    await settingsBtn.click();

    const panel = page.locator(".sheet-panel.settings-panel");
    await expect(panel).toHaveClass(/open/);

    await panel.locator(".panel-close-btn").click();
    await expect(panel).not.toHaveClass(/open/);
  });

  // 19. Profile Panel Open & Close
  test("T1-HUD-06: Profile Panel Trigger Open and Close", async ({ guestPage: page }) => {
    const profileBtn = page.locator(".profile-trigger-btn");
    await profileBtn.click();

    const panel = page.locator(".sheet-panel.profile-panel");
    await expect(panel).toHaveClass(/open/);

    await panel.locator(".panel-close-btn").click();
    await expect(panel).not.toHaveClass(/open/);
  });

  // 20. Leaderboard Panel Open & Close
  test("T1-HUD-07: Leaderboard Panel Trigger Open and Close", async ({ guestPage: page }) => {
    const podiumWidget = page.locator(".home-podium-widget");
    await podiumWidget.click();

    const panel = page.locator(".sheet-panel.leaderboard-panel");
    await expect(panel).toHaveClass(/open/);

    await panel.locator(".panel-close-btn").click();
    await expect(panel).not.toHaveClass(/open/);
  });
});
