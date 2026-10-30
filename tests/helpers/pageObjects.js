import { expect } from "@playwright/test";

export class HomeScreen {
  constructor(page) {
    this.page = page;
    this.logo = page.locator(".home-logo");
    this.deckWrapper = page.locator(".cards-deck-wrapper");
    this.topCard = page.locator(".ui-card--mode-deck.is-top-card");
    this.leftArrow = page.locator(".deck-click-zone.left");
    this.rightArrow = page.locator(".deck-click-zone.right");
    this.dots = page.locator(".deck-dots-row .deck-dot");
    this.settingsBtn = page.locator(".ui-icon-btn--dock-settings");
    this.profileBtn = page.locator(".ui-icon-btn--dock-profile");
    this.podiumWidget = page.locator(".home-podium-widget");
    this.settingsPanel = page.locator(".sheet-panel.settings-panel");
    this.profilePanel = page.locator(".sheet-panel.profile-panel");
    this.leaderboardPanel = page.locator(".sheet-panel.leaderboard-panel");
    this.panelCloseBtn = page.locator(".ui-icon-btn--panel-close");
  }

  async selectMode(modeKey) {
    const card = this.page.locator(`.ui-card--mode-deck[data-mode="${modeKey}"]`);
    if (await card.evaluate((el) => el.classList.contains("is-top-card"))) {
      return;
    }
    // Click next arrow until mode card is top card
    for (let i = 0; i < 5; i++) {
      if (await card.evaluate((el) => el.classList.contains("is-top-card"))) break;
      await this.rightArrow.click();
      await this.page.waitForTimeout(220);
    }
  }

  async startTopModePlay() {
    const playBtn = this.topCard.locator(".ui-btn--cta");
    await playBtn.click();
  }

  async startTopModeLearn() {
    const learnBtn = this.topCard.locator(".ui-btn--tile");
    await learnBtn.click();
  }

  async openSettings() {
    await this.settingsBtn.click();
    await expect(this.settingsPanel).toHaveClass(/open/);
  }

  async closeSettings() {
    await this.settingsPanel.locator(".ui-icon-btn--panel-close").click();
    await expect(this.settingsPanel).not.toHaveClass(/open/);
  }

  async setInterfaceTheme(themeName) {
    // themeName: 'dark' | 'light'
    await this.openSettings();
    const opt = this.settingsPanel.locator(
      `.segmented-opt:has-text("${themeName === "dark" ? "Sombre" : "Clair"}"), .segmented-opt:has-text("${themeName === "dark" ? "Dark" : "Light"}")`
    );
    await opt.first().click();
    await this.closeSettings();
  }
}

export class GameHUD {
  constructor(page) {
    this.page = page;
    this.topHudBar = page.locator(".top-hud-bar");
    this.inputField = page.locator("#q-resp-field");
    this.inputIsland = page.locator(".input-island");
    this.scorePill = page.locator(".score-pill, .island-font");
    this.timerPill = page.locator(".timer-pill, .island-font");
    this.heartsContainer = page.locator(".hud-hearts");
    this.fullHearts = page.locator(".PixelHeart.heart-full");
    this.lostHearts = page.locator(".PixelHeart.heart-lost");
    this.suggestionsList = page.locator(".suggestions-list");
    this.suggestionItems = page.locator("[role=option]");
    this.prevBtn = page.locator(".ui-icon-btn--hud.prev-btn");
    this.nextBtn = page.locator(".ui-icon-btn--hud.next-btn");
    this.homeLogo = page.locator(".hud-logo-clickable");
    this.stopBtn = page.locator(".hud-top-right .ui-icon-btn--hud");
  }

  async enterAnswer(answerText) {
    await this.inputField.fill(answerText);
    try {
      await this.page
        .locator(".suggestion-item")
        .first()
        .waitFor({ state: "visible", timeout: 250 });
      await this.inputField.press("ArrowDown");
    } catch {
      // Pas de suggestion apparue
    }
    await this.inputField.press("Enter");
  }
}

export class EndScreen {
  constructor(page) {
    this.page = page;
    this.overlay = page.locator(".end-screen-overlay");
    this.headerTitle = page.locator(".end-screen-header h1");
    this.scoreDisplay = page.locator(".final-score-inline");
    this.exploreGlobeBtn = page.locator(".end-screen-actions .ui-btn--secondary");
    this.homeBtn = page.locator(".end-screen-actions .ui-btn--primary");
    this.restoreChip = page.locator(".end-screen-restore-chip");
  }
}

export class GameDataPanel {
  constructor(page) {
    this.page = page;
    this.panel = page.locator(".game-data-panel");
    this.searchInput = page.locator(".data-panel-search-input");
    this.learnCarousel = page.locator(".learn-carousel-control");
    this.learnTabs = this.learnCarousel.locator('[role="tab"]');
    this.learnNextArrow = this.learnTabs.nth(1);
    this.learnPrevArrow = this.learnTabs.nth(0);
    this.dataRows = page.locator(".data-panel-table [data-country-key]");
  }
}
