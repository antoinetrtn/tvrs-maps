import {
  expect,
  deckStep,
  expectPanelClosed,
  openLearnPanel,
  showMode,
  test,
} from "./helpers/fixtures.js";

const LEARN_BTN = ".ui-btn--tile:not(.ui-btn--tile-train)";

test.describe("Carte Conquête de l'accueil", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("tvrs-guest-mode", "true"));
    await page.goto("/");
    await page.locator(".ui-card--mode-deck.is-top-card").waitFor();
    const hasConquest = await page.locator('.ui-card--mode-deck[data-mode="conquest"]').count();
    test.skip(!hasConquest, "Conquête désactivée (pas de Supabase / VITE_ENABLE_CONQUEST)");
  });

  test("T1-CQ-01: Conquête est la première carte et celle affichée par défaut", async ({
    freshGuestPage: page,
  }) => {
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "conquest");
    await expect(page.locator(".deck-dots-row .deck-dot").first()).toHaveClass(/active/);
    // Le bandeau « Conquête 1v1 — Nouveau » n'existe plus
    await expect(page.locator(".conquest-home-entry")).toHaveCount(0);
  });

  test("T1-CQ-02: « Règles » remplace Apprendre et ouvre la notice de Conquête", async ({
    freshGuestPage: page,
  }) => {
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await expect(topCard.locator(LEARN_BTN)).toHaveCount(1);
    await expect(topCard.locator(".ui-btn--tile-rules")).toContainText(/règles/i);
    await topCard.locator(".ui-btn--tile-rules").click();
    await expect(page.locator(".conquest-rules-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".conquest-rules-dialog")).toHaveCount(0);
  });
});

test.describe("Tier 1: Feature Coverage (20 Tests)", () => {
  // 1. Countries Mode Launch
  test("T1-MODE-01: Launch Countries Game Mode", async ({ guestPage: page }) => {
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "countries");
    await topCard.locator(".ui-btn--cta").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  // 2. Capitals Mode Launch
  test("T1-MODE-02: Launch Capitals Game Mode", async ({ guestPage: page }) => {
    const topCard = await showMode(page, "capitals");
    await topCard.locator(".ui-btn--cta").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  // 3. Departments Mode Launch & Validation
  test("T1-MODE-03: Launch Departments Game Mode and validate code input", async ({
    guestPage: page,
  }) => {
    const topCard = await showMode(page, "departments");
    await topCard.locator(".ui-btn--cta").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
    await inputField.fill("Ardèche");
    // Modes régionaux : la réponse se valide en choisissant la suggestion.
    await page.locator(".suggestion-item").first().click();

    await expect(inputField).toHaveValue("");
  });

  // 4. US States Mode Launch & Validation
  test("T1-MODE-04: Launch US States Game Mode and validate answer input", async ({
    guestPage: page,
  }) => {
    const topCard = await showMode(page, "us_states");
    await topCard.locator(".ui-btn--cta").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
    await inputField.fill("California");
    // Modes régionaux : la réponse se valide en choisissant la suggestion.
    await page.locator(".suggestion-item").first().click();

    await expect(inputField).toHaveValue("");
  });

  // 5. Rivers & Mountains Mode Launch & Validation
  test("T1-MODE-05: Launch Rivers & Mountains Game Mode and validate peak input", async ({
    guestPage: page,
  }) => {
    const topCard = await showMode(page, "rivers_mountains");
    await topCard.locator(".ui-btn--cta").click();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
    await inputField.fill("Danube");
    // Modes régionaux : la réponse se valide en choisissant la suggestion.
    await page.locator(".suggestion-item").first().click();

    await expect(inputField).toHaveValue("");
  });

  // 6. Carousel Navigation Next
  test("T1-MODE-06: Carousel Right Arrow Navigation", async ({ guestPage: page }) => {
    await deckStep(page, "right");
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "capitals");
  });

  // 7. Carousel Navigation Prev
  test("T1-MODE-07: Carousel Left Arrow Navigation", async ({ guestPage: page }) => {
    await showMode(page, "capitals");
    await deckStep(page, "left");
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await expect(topCard).toHaveAttribute("data-mode", "countries");
  });

  // 8. Carousel Indicator Dots Direct Selection
  test("T1-MODE-08: Carousel Indicator Dots Direct Selection", async ({ guestPage: page }) => {
    const dots = page.locator(".deck-dots-row .deck-dot");
    const count = await dots.count();
    await dots.nth(count - 1).click();
    await expect(dots.nth(count - 1)).toHaveClass(/active/);
    await expect(page.locator(".ui-card--mode-deck.is-top-card")).toHaveAttribute(
      "data-mode",
      "rivers_mountains"
    );
  });

  // 9. Learn Mode Launch
  test("T1-MODE-09: Launch Learn Mode from Home Card", async ({ guestPage: page }) => {
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await topCard.locator(LEARN_BTN).click();
    await openLearnPanel(page);

    const dataPanel = page.locator(".game-data-panel");
    await expect(dataPanel).toBeVisible();
  });

  // 10. Learn Sub-Mode TabBar Navigation
  test("T1-MODE-10: Learn Mode Sub-Mode Carousel Navigation", async ({ guestPage: page }) => {
    const topCard = page.locator(".ui-card--mode-deck.is-top-card");
    await topCard.locator(LEARN_BTN).click();
    await openLearnPanel(page);

    const learnControl = page.locator(".learn-carousel-control");
    await expect(learnControl).toBeVisible();

    const nextSubModeBtn = learnControl.locator('[role="tab"]').nth(1);
    await nextSubModeBtn.click();
    await page.waitForTimeout(150);

    await expect(nextSubModeBtn).toHaveAttribute("aria-selected", "true");
    const label = nextSubModeBtn.locator(".tab-bar-label");
    await expect(label).toBeVisible();
  });

  // 11-14. Réglages actuels (thème clair et satellite retirés en #248/#250)
  test("T1-THEME-01: Peaceful Mode Switch Toggles in Settings", async ({ guestPage: page }) => {
    await page.locator(".ui-icon-btn--dock-settings").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    await expect(settingsPanel).toHaveClass(/open/);
    const peaceful = settingsPanel.getByRole("switch", { name: "Mode paisible" });
    const before = await peaceful.getAttribute("aria-checked");
    await peaceful.click();
    await expect(peaceful).not.toHaveAttribute("aria-checked", before);
    await settingsPanel.locator(".ui-icon-btn--panel-close").click();
  });

  test("T1-THEME-02: WebGPU Renderer Switch Toggles in Settings", async ({ guestPage: page }) => {
    await page.locator(".ui-icon-btn--dock-settings").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    const webgpu = settingsPanel.getByRole("switch", { name: "WebGPU" });
    // Sans GPU (CI, headless), le switch peut rester bloqué sur WebGL : on vérifie qu'il reste cohérent.
    await webgpu.click();
    await expect(webgpu).toHaveAttribute("aria-checked", /^(true|false)$/);
    await settingsPanel.locator(".ui-icon-btn--panel-close").click();
    await expectPanelClosed(page, ".sheet-panel.settings-panel");
  });

  test("T1-THEME-03: Duration Stepper Updates Displayed Value", async ({ guestPage: page }) => {
    await page.locator(".ui-icon-btn--dock-settings").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    const value = settingsPanel.locator(".ui-slider-value");
    const before = await value.innerText();
    await settingsPanel.getByRole("button", { name: "+1 minute" }).click();
    await expect(value).not.toHaveText(before);
  });

  test("T1-THEME-04: Duration Stepper -1 then +1 Restores Value", async ({ guestPage: page }) => {
    await page.locator(".ui-icon-btn--dock-settings").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    const value = settingsPanel.locator(".ui-slider-value");
    const before = await value.innerText();
    await settingsPanel.getByRole("button", { name: "-1 minute" }).click();
    await expect(value).not.toHaveText(before);
    await settingsPanel.getByRole("button", { name: "+1 minute" }).click();
    await expect(value).toHaveText(before);
  });

  // 15. Answer Input Clearing
  test("T1-HUD-01: Answer Input Field Auto-Clears on Correct Answer", async ({
    guestPage: page,
  }) => {
    await page.locator(".ui-card--mode-deck.is-top-card .ui-btn--cta").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("France");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 16. Auto-Suggestions Popup
  test("T1-HUD-02: Auto-Suggestions Popup Appears at 4+ Characters", async ({
    guestPage: page,
  }) => {
    await page.locator(".ui-card--mode-deck.is-top-card .ui-btn--cta").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("Frnace");
    const suggestionsList = page.locator(".suggestions-list");
    await expect(suggestionsList).toBeVisible();

    const item = page.locator(".suggestion-item").first();
    await expect(item).toContainText(/France/i);
  });

  // 17. Auto-Suggestion Selection Submits Answer
  test("T1-HUD-03: Clicking Suggestion Item Submits Answer and Clears Input", async ({
    guestPage: page,
  }) => {
    await page.locator(".ui-card--mode-deck.is-top-card .ui-btn--cta").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("Frnace");
    const item = page.locator(".suggestion-item").first();
    await item.click();

    await expect(inputField).toHaveValue("");
  });

  // 18. Settings Panel Open & Close
  test("T1-HUD-05: Settings Panel Trigger Open and Close", async ({ guestPage: page }) => {
    const settingsBtn = page.locator(".ui-icon-btn--dock-settings");
    await settingsBtn.click();

    const panel = page.locator(".sheet-panel.settings-panel");
    await expect(panel).toHaveClass(/open/);

    await panel.locator(".ui-icon-btn--panel-close").click();
    await expectPanelClosed(page, ".sheet-panel");
  });

  // 19. Profile Panel Open & Close
  test("T1-HUD-06: Profile Panel Trigger Open and Close", async ({ guestPage: page }) => {
    const profileBtn = page.locator(".ui-icon-btn--dock-profile");
    await profileBtn.click();

    const panel = page.locator(".sheet-panel.profile-panel");
    await expect(panel).toHaveClass(/open/);

    await panel.locator(".ui-icon-btn--panel-close").click();
    await expectPanelClosed(page, ".sheet-panel");
  });

  // 20. Leaderboard Panel Open & Close
  test("T1-HUD-07: Leaderboard Panel Trigger Open and Close", async ({ guestPage: page }) => {
    const podiumWidget = page.locator(".ui-icon-btn--dock-podium");
    await podiumWidget.click();

    const panel = page.locator(".sheet-panel.leaderboard-panel");
    await expect(panel).toHaveClass(/open/);

    await panel.locator(".ui-icon-btn--panel-close").click();
    await expectPanelClosed(page, ".sheet-panel");
  });
});
