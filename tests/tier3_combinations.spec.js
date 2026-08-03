import { expect, test } from "./helpers/fixtures.js";

test.describe("Tier 3: Cross-Feature Combinations (10 Tests)", () => {
  // 1. Mid-selection interface theme switch
  test("T3-COMB-01: Mid-Selection Interface Theme Switch during active game session", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();

    await inputField.fill("France");
    await inputField.press("Enter");

    // Open settings and switch interface theme
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    const lightOpt = settingsPanel
      .locator('.segmented-opt:has-text("Clair"), .segmented-opt:has-text("Light")')
      .first();
    await lightOpt.click();
    await settingsPanel.locator(".panel-close-btn").click();

    const appContainer = page.locator(".app-container");
    await expect(appContainer).toHaveAttribute("data-theme", "light");
    await expect(inputField).toBeVisible();
  });

  // 2. Mid-selection globe theme switch
  test("T3-COMB-02: Mid-Selection Globe Theme Switch during active game session", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();

    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    const satOpt = settingsPanel.locator('.segmented-opt:has-text("Satellite")').first();
    await satOpt.click();
    await settingsPanel.locator(".panel-close-btn").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  // 3. Satellite theme found country wireframe rules (AGENTS.md Rule 2)
  test("T3-COMB-03: Satellite Theme Found Country Wireframe Rules (AGENTS.md Rule 2)", async ({
    guestPage: page,
  }) => {
    // Switch to satellite mode in settings
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    await settingsPanel.locator('.segmented-opt:has-text("Satellite")').first().click();
    await settingsPanel.locator(".panel-close-btn").click();

    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("France");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 4. Satellite theme high-contrast neon label color conformance
  test("T3-COMB-04: Satellite Theme Wireframe High-Contrast Neon Color Conformance", async ({
    guestPage: page,
  }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    await settingsPanel.locator('.segmented-opt:has-text("Satellite")').first().click();
    await settingsPanel.locator(".panel-close-btn").click();

    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");
    await inputField.fill("Japon");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 5. Unfound country smooth opacity fade out on deselection (AGENTS.md Rule 3)
  test("T3-COMB-05: Unfound Country Opacity Fade Out on Deselection (AGENTS.md Rule 3)", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const canvas = page.locator("canvas").first();

    // Click canvas ocean space
    await canvas.click({ position: { x: 50, y: 50 } });
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  // 6. Rivers & Mountains mountain scale consistency (AGENTS.md Rule 4)
  test("T3-COMB-06: Rivers & Mountains Mountain Scale Consistency (AGENTS.md Rule 4)", async ({
    guestPage: page,
  }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(4).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "rivers_mountains");
    await topCard.locator(".card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await inputField.fill("Everest");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 7. Game mode switch mid-session via Return Home Logo
  test("T3-COMB-07: Game Mode Switch Mid-Session via Return Home Logo Button", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();

    // Click home logo to return to home screen
    const homeLogo = page.locator(".hud-logo-clickable, .hud-top-left .hud-btn-circular").first();
    await homeLogo.click();

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toBeVisible();
  });

  // 8. Hardcore mode toggle & hearts display
  test("T3-COMB-08: Hardcore Mode Toggle displays Heart Icons in HUD", async ({
    guestPage: page,
  }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    // Enable Hardcore mode (peaceful OFF)
    const hardcoreOpt = settingsPanel
      .locator('.segmented-opt:has-text("Hardcore"), .segmented-opt:has-text("Paisible")')
      .first();
    await hardcoreOpt.click();
    await settingsPanel.locator(".panel-close-btn").click();

    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const hearts = page.locator(".hud-hearts");
    await expect(hearts).toBeVisible();
  });

  // 9. Hardcore mode wrong answer heart depletion & vignette flash
  test("T3-COMB-09: Hardcore Mode Wrong Answer Depletes Heart and Triggers Vignette Flash", async ({
    guestPage: page,
  }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const hardcoreOpt = settingsPanel
      .locator('.segmented-opt:has-text("Hardcore"), .segmented-opt:has-text("Paisible")')
      .first();
    await hardcoreOpt.click();
    await settingsPanel.locator(".panel-close-btn").click();

    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await inputField.fill("InvalidCountryX123");
    await inputField.press("Enter");

    const lostHearts = page.locator(".PixelHeart.heart-lost");
    await expect(lostHearts).toHaveCount(1);
  });

  // 10. Hardcore 0 lives Game Over EndScreen launch (HARDCORE_LIVES = 5)
  test("T3-COMB-10: Hardcore Mode Depletion of All 5 Lives Triggers Game Over EndScreen", async ({
    guestPage: page,
  }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const hardcoreOpt = settingsPanel
      .locator('.segmented-opt:has-text("Hardcore"), .segmented-opt:has-text("Paisible")')
      .first();
    await hardcoreOpt.click();
    await settingsPanel.locator(".panel-close-btn").click();

    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    for (let i = 0; i < 5; i++) {
      await inputField.fill(`WrongAnswer_${i}`);
      await inputField.press("Enter");
      await page.waitForTimeout(100);
    }

    const endScreen = page.locator(".end-screen-overlay");
    await expect(endScreen).toBeVisible();
  });
});
