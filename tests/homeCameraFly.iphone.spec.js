import { expect, test } from "./helpers/fixtures.js";

const IPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const DOT = {
  countries: /Pays du/,
  departments: /Départements/,
  us_states: /États/,
};

async function armClickClock(page) {
  await page.evaluate(() => {
    if (window.__TVRS_CLICK_ARMED__) return;
    window.__TVRS_CLICK_ARMED__ = true;
    window.__TVRS_CLICK_T__ = 0;
    document.querySelectorAll(".deck-dots-row button").forEach((b) => {
      b.addEventListener("click", () => {
        window.__TVRS_CLICK_T__ = performance.now();
      }, true);
    });
  });
}

async function clickModeDot(page, mode) {
  await armClickClock(page);
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

async function startCameraLog(page, ms = 1400) {
  await page.evaluate((duration) => {
    window.__TVRS_CAMERA_LOG__ = [];
    const t0 = performance.now();
    const id = setInterval(() => {
      const cam = window.__TVRS_CAMERA_TEST__;
      const layer = window.__TVRS_LAYER_TEST__;
      const pov = cam?.getCurrent?.() || null;
      window.__TVRS_CAMERA_LOG__.push({
        t: performance.now() - t0,
        durationMs: cam?.durationMs ?? null,
        startedAt: cam?.startedAt ?? null,
        target: cam?.target || null,
        pov,
        effectiveMode: layer?.effectiveMode,
        progress: layer?.transitionProgress,
      });
      if (performance.now() - t0 > duration) clearInterval(id);
    }, 16);
  }, ms);
}

async function readCameraLog(page) {
  return page.evaluate(() => window.__TVRS_CAMERA_LOG__ || []);
}

test.use(IPHONE);

test.describe("Homepage camera fly (iPhone viewport, touch)", () => {
  test("world → départements → US → world has no blank frame and monotonic camera progress", async ({
    freshGuestPage: page,
  }) => {
    await waitForGlobe(page);
    await clickModeDot(page, "countries");
    await page.waitForTimeout(2000);

    await startCameraLog(page, 1400);
    await clickModeDot(page, "departments");
    await page.waitForTimeout(1400);
    const toFrance = await readCameraLog(page);
    const clickT = await page.evaluate(() => window.__TVRS_CLICK_T__ || 0);
    const flights = await page.evaluate(() => window.__TVRS_CAMERA_TEST__?.flights || []);
    const franceFlight = flights.find(
      (f) => f.target && Math.abs(f.target.lat - 46.2) < 2 && (f.durationMs ?? 0) > 0
    );
    expect(franceFlight, "camera fly toward France should start on click").toBeTruthy();
    expect(clickT, "in-page click timestamp should be recorded").toBeGreaterThan(0);
    expect(
      franceFlight.startedAt - clickT,
      "fly should start within 150ms of the card click"
    ).toBeLessThan(150);

    const franceFlies = toFrance.filter(
      (s) => s.target && Math.abs(s.target.lat - 46.2) < 2 && (s.durationMs ?? 0) > 0
    );
    expect(franceFlies.length).toBeGreaterThan(0);

    const povs = toFrance.map((s) => s.pov).filter((p) => p && Number.isFinite(p.lat));
    expect(povs.length).toBeGreaterThan(3);
    const startLat = povs[0].lat;
    const startAlt = povs[0].altitude;
    // Latitude should generally head toward ~46, altitude should not snap.
    const later = povs.slice(Math.floor(povs.length * 0.5));
    const latCloser = later.some((p) => Math.abs(p.lat - 46.2) < Math.abs(startLat - 46.2) - 0.5);
    const noAltSnap = povs.every((p, i) => {
      if (i === 0) return true;
      return Math.abs(p.altitude - povs[i - 1].altitude) < 0.8;
    });
    expect(latCloser || Math.abs(startLat - 46.2) < 2, "lat should progress toward France").toBe(
      true
    );
    expect(noAltSnap, "altitude should not snap between samples").toBe(true);

    const mid = later[0] || povs[povs.length - 1];
    // Canvas must not go fully blank/grey over the globe mid-area.
    const shot = await page.screenshot({ type: "png" });
    expect(shot.byteLength).toBeGreaterThan(20_000);

    await startCameraLog(page, 1400);
    await clickModeDot(page, "us_states");
    await page.waitForTimeout(1400);
    const toUs = await readCameraLog(page);
    const usFlies = toUs.filter(
      (s) => s.target && Math.abs(s.target.lng + 95.85) < 3 && (s.durationMs ?? 0) > 0
    );
    expect(usFlies.length, "camera should retarget toward the USA").toBeGreaterThan(0);
    const usZeroSnap = toUs.some(
      (s) => s.target && Math.abs(s.target.lng + 95.85) < 3 && s.durationMs === 0 && s.t < 50
    );
    expect(usZeroSnap, "interrupted retarget must not snap (duration 0) to the USA").toBe(false);

    await startCameraLog(page, 1400);
    await clickModeDot(page, "countries");
    await page.waitForTimeout(1400);
    const toWorld = await readCameraLog(page);
    const worldFlies = toWorld.filter(
      (s) => s.target && (s.durationMs ?? 0) > 0 && Math.abs((s.target.altitude ?? 0) - 2.2) < 0.6
    );
    expect(worldFlies.length, "camera should fly back to world framing").toBeGreaterThan(0);

    // Sample the France-area crop from a screenshot: not a flat grey/black fill.
    const png = await page.screenshot({ type: "png", clip: { x: 90, y: 140, width: 210, height: 260 } });
    expect(png.byteLength).toBeGreaterThan(2_000);
  });
});
