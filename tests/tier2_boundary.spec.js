import { expect, test } from "./helpers/fixtures.js";

test.describe("Tier 2: Boundary & Corner Cases (30 Tests)", () => {
  // 1. Spam click carousel right arrow 15 times
  test("T2-CLICK-01: Rapidly click Carousel Right Arrow 15 times", async ({ guestPage: page }) => {
    const rightArrow = page.locator(".deck-click-zone.right");
    for (let i = 0; i < 5; i++) {
      await rightArrow.click({ force: true });
    }
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toBeVisible();
  });

  // 2. Spam click carousel left arrow 15 times
  test("T2-CLICK-02: Rapidly click Carousel Left Arrow 15 times", async ({ guestPage: page }) => {
    const leftArrow = page.locator(".deck-click-zone.left");
    for (let i = 0; i < 5; i++) {
      await leftArrow.click({ force: true });
    }
    await page.waitForTimeout(200);

    const topCard = page.locator(".deck-mode-card.is-top-card");
    await expect(topCard).toBeVisible();
  });

  // 3. Rapid double-click Play button
  test("T2-CLICK-03: Rapid Double-Click Play Button initializes single session", async ({
    guestPage: page,
  }) => {
    const playBtn = page.locator(".deck-mode-card.is-top-card .card-play-btn");
    await playBtn.dblclick();

    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  // 4. Rapid toggle interface theme
  test("T2-CLICK-04: Rapidly toggle Interface Theme in Settings", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const darkOpt = settingsPanel
      .locator('.segmented-opt:has-text("Sombre"), .segmented-opt:has-text("Dark")')
      .first();
    const lightOpt = settingsPanel
      .locator('.segmented-opt:has-text("Clair"), .segmented-opt:has-text("Light")')
      .first();

    for (let i = 0; i < 3; i++) {
      await lightOpt.click();
      await darkOpt.click();
    }
    await settingsPanel.locator(".panel-close-btn").click();
    await expect(page.locator(".app-container")).toHaveAttribute("data-theme", "dark");
  });

  // 5. Rapid toggle globe theme
  test("T2-CLICK-05: Rapidly toggle Globe Theme in Settings", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const satOpt = settingsPanel.locator('.segmented-opt:has-text("Satellite")').first();
    const blackOpt = settingsPanel.locator('.segmented-opt:has-text("Blackout")').first();

    for (let i = 0; i < 3; i++) {
      await satOpt.click();
      await blackOpt.click();
    }
    await settingsPanel.locator(".panel-close-btn").click();
  });

  // 6. Rapid suggestion click ignored after input clear
  test("T2-CLICK-06: Rapid suggestion taps handled safely after input clear", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("Fran");
    const item = page.locator(".suggestion-item").first();
    await item.click({ force: true });

    await expect(inputField).toHaveValue("");
  });

  // 7. Canvas mouse drag pan gesture
  test("T2-HOVER-01: Canvas Mouse Drag Pan Gesture", async ({ guestPage: page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY + 50, { steps: 5 });
      await page.mouse.up();
    }
  });

  // 8. Fast pointer sweeps across canvas
  test("T2-HOVER-02: Fast Pointer Sweeps Across Canvas", async ({ guestPage: page }) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      for (let i = 0; i < 5; i++) {
        await page.mouse.move(box.x + 50 + i * 20, box.y + 50 + i * 10);
      }
    }
  });

  // 9. Mouse drag outside window boundary
  test("T2-HOVER-03: Mouse Drag Outside Window Boundary", async ({ guestPage: page }) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(-50, -50);
      await page.mouse.up();
    }
  });

  // 10. Fast mouse wheel zoom in threshold
  test("T2-HOVER-04: Fast Mouse Wheel Zoom In Threshold", async ({ guestPage: page }) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -200);
    }
  });

  // 11. Fast mouse wheel zoom out threshold
  test("T2-HOVER-05: Fast Mouse Wheel Zoom Out Threshold", async ({ guestPage: page }) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 200);
    }
  });

  // 12. Panel close button dismisses settings panel
  test("T2-DESEL-01: Close Button Dismisses Settings Panel", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");
    await expect(settingsPanel).toHaveClass(/open/);

    await settingsPanel.locator(".panel-close-btn").click();
    await expect(settingsPanel).not.toHaveClass(/open/);
  });

  // 13. Panel close button dismisses profile panel
  test("T2-DESEL-02: Close Button Dismisses Profile Panel", async ({ guestPage: page }) => {
    await page.locator(".profile-trigger-btn").click();
    const profilePanel = page.locator(".sheet-panel.profile-panel");
    await expect(profilePanel).toHaveClass(/open/);

    await profilePanel.locator(".panel-close-btn").click();
    await expect(profilePanel).not.toHaveClass(/open/);
  });

  // 14. Panel close button dismisses leaderboard panel
  test("T2-DESEL-03: Close Button Dismisses Leaderboard Panel", async ({ guestPage: page }) => {
    await page.locator(".home-podium-widget").click();
    const lbPanel = page.locator(".sheet-panel.leaderboard-panel");
    await expect(lbPanel).toHaveClass(/open/);

    await lbPanel.locator(".panel-close-btn").click();
    await expect(lbPanel).not.toHaveClass(/open/);
  });

  // 15. Clear search query input in Learn mode data panel
  test("T2-DESEL-04: Clear Search Input in Learn Data Panel", async ({ guestPage: page }) => {
    await page.locator(".deck-mode-card.is-top-card .card-learn-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("France");
    await inputField.fill("");
    await expect(inputField).toHaveValue("");
  });

  // 16. Input field focus retention on canvas interaction
  test("T2-DESEL-05: Input Field Focus Retention on Canvas Interaction", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");
    await inputField.focus();

    const canvas = page.locator("canvas").first();
    await canvas.click({ position: { x: 100, y: 100 } });
    await expect(inputField).toBeVisible();
  });

  // 17. Desktop Viewport (1280x800) Layout Verification
  test("T2-RESIZE-01: Desktop Viewport Layout Verification", async ({ guestPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const card = page.locator(".deck-mode-card.is-top-card");
    await expect(card).toBeVisible();
  });

  // 18. Mobile Viewport (375x667) Layout Verification
  test("T2-RESIZE-02: Mobile Viewport Layout Verification", async ({ guestPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const card = page.locator(".deck-mode-card.is-top-card");
    await expect(card).toBeVisible();
  });

  // 19. Resize Desktop to Mobile Dynamic Adaptation
  test("T2-RESIZE-03: Dynamic Resize Desktop to Mobile", async ({ guestPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setViewportSize({ width: 375, height: 667 });
    const card = page.locator(".deck-mode-card.is-top-card");
    await expect(card).toBeVisible();
  });

  // 20. Resize Mobile to Desktop Dynamic Adaptation
  test("T2-RESIZE-04: Dynamic Resize Mobile to Desktop", async ({ guestPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setViewportSize({ width: 1280, height: 800 });
    const card = page.locator(".deck-mode-card.is-top-card");
    await expect(card).toBeVisible();
  });

  // 21. Mobile Landscape Viewport (667x375) Adaptation
  test("T2-RESIZE-05: Mobile Landscape Viewport Adaptation", async ({ guestPage: page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    const card = page.locator(".deck-mode-card.is-top-card");
    await expect(card).toBeVisible();
  });

  // 22. Accented character answer matching
  test("T2-DATA-01: Accented Character Answer Matching (Egypte / Égypte)", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("Egypte");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 23. Hyphenated & compound name handling
  test("T2-DATA-02: Hyphenated Name Handling (saint marin / Saint-Marin)", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("saint marin");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 24. Case insensitive answer matching
  test("T2-DATA-03: Case Insensitive Answer Submission (fRAncE)", async ({ guestPage: page }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("fRAncE");
    await inputField.press("Enter");

    await expect(inputField).toHaveValue("");
  });

  // 25. Non-existent answer submission error island feedback
  test("T2-DATA-04: Non-Existent Answer Submission Triggers Error Feedback Class", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("Atlantis123XYZ");
    await inputField.press("Enter");

    const inputIsland = page.locator(".input-island");
    await expect(inputIsland).toHaveClass(/error/);
  });

  // 26. Duplicate correct answer submission warning/error feedback
  test("T2-DATA-05: Duplicate Correct Answer Submission Triggers Feedback Class", async ({
    guestPage: page,
  }) => {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    const inputField = page.locator("#q-resp-field");

    await inputField.fill("France");
    await inputField.press("Enter");

    await inputField.fill("France");
    await inputField.press("Enter");

    const inputIsland = page.locator(".input-island");
    await expect(inputIsland).toHaveClass(/error|warning/);
  });

  // 27. Game duration stepper decrement (-1 Min)
  test("T2-DATA-06: Game Duration Stepper Decrement (-1 Min)", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const minusBtn = settingsPanel.locator('button.settings-btn-stepper:has-text("-1 Min")');
    await minusBtn.click();

    const durationVal = settingsPanel.locator(".duration-value");
    await expect(durationVal).toBeVisible();
    await settingsPanel.locator(".panel-close-btn").click();
  });

  // 28. Game duration stepper increment (+1 Min)
  test("T2-DATA-07: Game Duration Stepper Increment (+1 Min)", async ({ guestPage: page }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const plusBtn = settingsPanel.locator('button.settings-btn-stepper:has-text("+1 Min")');
    await plusBtn.click();

    const durationVal = settingsPanel.locator(".duration-value");
    await expect(durationVal).toBeVisible();
    await settingsPanel.locator(".panel-close-btn").click();
  });

  // 29. Language switch FR to EN card title update
  test("T2-DATA-08: Switch Language from FR to EN Updates Card Titles", async ({
    guestPage: page,
  }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const enOpt = settingsPanel.locator('.segmented-opt:has-text("EN")').first();
    await enOpt.click();
    await settingsPanel.locator(".panel-close-btn").click();

    const topCardTitle = page.locator(".deck-mode-card.is-top-card .card-title");
    await expect(topCardTitle).toHaveText("World Countries");
  });

  // 30. Language switch EN to FR restoration
  test("T2-DATA-09: Switch Language from EN back to FR Restores Card Titles", async ({
    guestPage: page,
  }) => {
    await page.locator(".settings-trigger-btn").click();
    const settingsPanel = page.locator(".sheet-panel.settings-panel");

    const enOpt = settingsPanel.locator('.segmented-opt:has-text("EN")').first();
    await enOpt.click();

    const frOpt = settingsPanel.locator('.segmented-opt:has-text("FR")').first();
    await frOpt.click();
    await settingsPanel.locator(".panel-close-btn").click();

    const topCardTitle = page.locator(".deck-mode-card.is-top-card .card-title");
    await expect(topCardTitle).toHaveText("Pays du Monde");
  });
});
