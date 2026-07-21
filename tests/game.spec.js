import { test, expect } from "@playwright/test";

test.describe("TVRS Maps E2E Game Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the local development server homepage
    await page.goto("/");
    // Set guest mode in localStorage to bypass AuthModal
    await page.evaluate(() => localStorage.setItem("tvrs-guest-mode", "true"));
    // Reload page to apply changes
    await page.reload();
  });

  test("should load the homepage with correct title", async ({ page }) => {
    // Check the page title
    await expect(page).toHaveTitle(/tvrs maps/i);

    // Check that game mode buttons are present
    const countriesBtn = page.locator(".mode-countries");
    await expect(countriesBtn).toBeVisible();

    const capitalsBtn = page.locator(".mode-capitals");
    await expect(capitalsBtn).toBeVisible();
  });

  test("should start game in countries mode", async ({ page }) => {
    // Click on Countries game mode
    const countriesBtn = page.locator(".mode-countries");
    await countriesBtn.click();

    // Verify that the answer input field is now visible
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });

  test("should start game in us_states mode via regional category", async ({ page }) => {
    // Navigate to regional category in carousel
    const nextCategoryBtn = page.locator(".carousel-arrow").nth(1);
    await nextCategoryBtn.click();

    // Click US States mode button
    const usStatesBtn = page.locator(".mode-us_states");
    await expect(usStatesBtn).toBeVisible();
    await usStatesBtn.click();

    // Verify answer field is visible
    const inputField = page.locator("#q-resp-field");
    await expect(inputField).toBeVisible();
  });
});
