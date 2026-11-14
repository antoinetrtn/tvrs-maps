import { expect, test } from "./helpers/fixtures.js";

const IPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const DOT = {
  countries: /Pays du/,
  departments: /Départements/,
  us_states: /États/,
};

async function clickModeDot(page, mode) {
  const buttons = page.locator(".deck-dots-row button");
  const n = await buttons.count();
  const re = DOT[mode];
  for (let i = 0; i < n; i++) {
    const title = ((await buttons.nth(i).getAttribute("title")) || "").replace(/\n/g, " ");
    if (re.test(title)) {
      await buttons.nth(i).click({ force: true });
      return;
    }
  }
  throw new Error("no dot for " + mode);
}

async function waitForGlobe(page) {
  await page.locator(".ui-card--mode-deck.is-top-card").waitFor({ timeout: 30_000 });
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
}

async function layerState(page) {
  return page.evaluate(() => globalThis.__TVRS_LAYER_TEST__ || null);
}

async function waitForMode(page, mode, timeout = 8_000) {
  await page.waitForFunction((m) => globalThis.__TVRS_LAYER_TEST__?.effectiveMode === m, mode, {
    timeout,
  });
}

async function startProgressLog(page, ms = 1500) {
  await page.evaluate((duration) => {
    window.__TVRS_PROGRESS_LOG__ = [];
    const t0 = performance.now();
    const id = setInterval(() => {
      const s = window.__TVRS_LAYER_TEST__;
      if (s && typeof s.transitionProgress === "number") {
        window.__TVRS_PROGRESS_LOG__.push(s.transitionProgress);
      }
      if (performance.now() - t0 > duration) clearInterval(id);
    }, 16);
  }, ms);
}

async function readProgressLog(page) {
  return page.evaluate(() => window.__TVRS_PROGRESS_LOG__ || []);
}

test.use(IPHONE);

test.describe("Homepage layer switch (iPhone viewport, touch)", () => {
  test("active regional layer is visible and the mode crossfade runs 0→1", async ({
    freshGuestPage: page,
  }) => {
    await waitForGlobe(page);
    await clickModeDot(page, "countries");
    await page.waitForTimeout(2000); // prefetch + prewarm

    // world → départements: click and sample transition progress immediately
    await startProgressLog(page, 1500);
    await clickModeDot(page, "departments");
    await page.waitForTimeout(1500);
    const deptProgress = await readProgressLog(page);

    await waitForMode(page, "departments");
    await page.waitForTimeout(200);
    const afterDept = await layerState(page);
    expect(afterDept, "test hook should be published").toBeTruthy();
    expect(afterDept.effectiveMode).toBe("departments");
    expect(afterDept.counts.departmentsActive).toBeGreaterThan(10);
    await page.waitForFunction(
      () => (globalThis.__TVRS_LAYER_TEST__?.visible?.departments || 0) > 5,
      null,
      { timeout: 8_000 }
    );
    expect((await layerState(page)).visible.departments).toBeGreaterThan(5);
    expect(
      deptProgress.filter((p) => p > 0 && p < 1).length,
      "crossfade should report progress between 0 and 1"
    ).toBeGreaterThan(0);

    await startProgressLog(page, 1500);
    await clickModeDot(page, "us_states");
    await page.waitForTimeout(1500);
    const usProgress = await readProgressLog(page);
    await waitForMode(page, "us_states");
    await page.waitForTimeout(200);
    await page.waitForFunction(() => (globalThis.__TVRS_LAYER_TEST__?.visible?.us || 0) > 3, null, {
      timeout: 8_000,
    });
    const afterUs = await layerState(page);
    expect(afterUs.effectiveMode).toBe("us_states");
    expect(afterUs.counts.usActive).toBeGreaterThan(10);
    expect(afterUs.visible.us).toBeGreaterThan(3);
    expect(usProgress.some((p) => p > 0 && p < 1)).toBe(true);

    await clickModeDot(page, "countries");
    await waitForMode(page, "world");
    await page.waitForTimeout(200);
    await page.waitForFunction(
      () => (globalThis.__TVRS_LAYER_TEST__?.visible?.world || 0) > 5,
      null,
      { timeout: 8_000 }
    );
    const afterWorld = await layerState(page);
    expect(afterWorld.effectiveMode).toBe("world");
    expect(afterWorld.visible.world).toBeGreaterThan(5);
  });
});
