import { expect, test } from "./helpers/fixtures.js";

test.describe("Tier 4: Real-World Scenarios (4 Tests)", () => {
  // 1. Complete Desktop Round Simulation (1280x800)
  test("T4-SCEN-01: Complete Desktop Round Simulation (1280x800)", async ({ guestPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Verify Homepage title & top card
    await expect(page).toHaveTitle(/tvrs maps/i);
    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "countries");

    // Launch Game
    await topCard.locator(".card-play-btn").click();
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();

    // Submit valid answers
    const validAnswers = ["France", "Espagne", "Italie"];
    for (const ans of validAnswers) {
      await inputField.fill(ans);
      await inputField.press("Enter");
      await page.waitForTimeout(100);
    }

    // Submit wrong answer
    await inputField.fill("Atlantis123");
    await inputField.press("Enter");
    const inputIsland = page.locator(".input-island");
    await expect(inputIsland).toHaveClass(/error/);

    // Stop round via HUD Stop button
    const stopBtn = page.locator(".hud-top-right .hud-btn-circular, .hud-top-right button").first();
    await stopBtn.click();

    // Verify EndScreen modal
    const endScreen = page.locator(".end-screen-overlay");
    await expect(endScreen).toBeVisible();

    // Test minimize to explore globe chip
    const exploreBtn = page.locator(".end-screen-actions .btn-secondary");
    await exploreBtn.click();

    const restoreChip = page.locator(".end-screen-restore-chip");
    await expect(restoreChip).toBeVisible();

    // Restore EndScreen
    await restoreChip.click();
    await expect(endScreen).toHaveClass(/end-screen-overlay/);

    // Return to Home screen
    const homeBtn = page.locator(".end-screen-actions .btn-primary");
    await homeBtn.click();

    await expect(page.locator(".deck-mode-card.is-top-card")).toBeVisible();
  });

  // 2. Complete Desktop Learn Mode Exploration (1280x800)
  test("T4-SCEN-02: Complete Desktop Learn Mode Exploration (1280x800)", async ({
    guestPage: page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Launch Learn mode from top card
    const topCard = page.locator(".deck-mode-card.is-top-card");
    await topCard.locator(".card-learn-btn").click();

    // Verify Learn Mode data panel & carousel
    const dataPanel = page.locator(".game-data-panel");
    await expect(dataPanel).toBeVisible();

    const learnControl = page.locator(".learn-carousel-control");
    await expect(learnControl).toBeVisible();

    // Cycle learn sub-modes
    const nextArrow = learnControl.locator(".learn-carousel-arrow").nth(1);
    for (let i = 0; i < 3; i++) {
      await nextArrow.click();
      await page.waitForTimeout(100);
    }

    // Search query input in Learn mode
    const inputField = page.locator("#q-resp-field");
    await inputField.fill("France");
    await expect(inputField).toHaveValue("France");

    // Return Home via logo
    const homeLogo = page.locator(".hud-logo-clickable, .hud-top-left .hud-btn-circular").first();
    await homeLogo.click();

    await expect(page.locator(".deck-mode-card.is-top-card")).toBeVisible();
  });

  // 3. Complete Mobile Round Simulation (375x812 iPhone 13)
  test("T4-SCEN-03: Complete Mobile Round Simulation (375x812)", async ({ guestPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    // Select Departments card via dots
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(2).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "departments");
    await topCard.locator(".card-play-btn").click();

    // Mobile input field check
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();

    // Submit department code "75"
    await inputField.fill("75");
    await inputField.press("Enter");
    await expect(inputField).toHaveValue("");

    // Submit department code "13"
    await inputField.fill("13");
    await inputField.press("Enter");
    await expect(inputField).toHaveValue("");

    // Return Home via mobile Home button
    const homeBtn = page.locator(".hud-top-left .hud-btn-circular").first();
    await homeBtn.click();

    await expect(page.locator(".deck-mode-card.is-top-card")).toBeVisible();
  });

  // 4. Complete Mobile Landscape Simulation (667x375)
  test("T4-SCEN-04: Complete Mobile Landscape Simulation (667x375)", async ({
    guestPage: page,
  }) => {
    await page.setViewportSize({ width: 667, height: 375 });

    // Select US States card via dots
    const dots = page.locator(".deck-dots-row .deck-dot");
    await dots.nth(3).click();
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "us_states");
    await topCard.locator(".card-play-btn").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();

    // Submit valid answer "California"
    await inputField.fill("California");
    await inputField.press("Enter");
    await expect(inputField).toHaveValue("");

    // Stop round via HUD stop button
    const stopBtn = page.locator(".hud-top-right .hud-btn-circular, .hud-top-right button").first();
    await stopBtn.click();

    const endScreen = page.locator(".end-screen-overlay");
    await expect(endScreen).toBeVisible();

    // Return Home from EndScreen
    const homeBtn = page.locator(".end-screen-actions .btn-primary");
    await homeBtn.click();

    await expect(page.locator(".deck-mode-card.is-top-card")).toBeVisible();
  });
});
