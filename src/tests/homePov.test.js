import { describe, expect, it } from "vitest";

import {
  getHomeDesktopPov,
  HOME_DESKTOP_ALT_MAX,
  HOME_DESKTOP_ALT_MIN,
  HOME_DESKTOP_LAT,
  HOME_DESKTOP_LNG,
} from "../globe/hooks/homePov";

describe("getHomeDesktopPov", () => {
  it("keeps latitude and longitude stable at (16, 28)", () => {
    const pov = getHomeDesktopPov({ width: 1440, height: 900 });
    expect(pov.lat).toBe(HOME_DESKTOP_LAT);
    expect(pov.lng).toBe(HOME_DESKTOP_LNG);
  });

  it("respects altitude bounds strictly between 1.45 and 1.9", () => {
    const square = getHomeDesktopPov({ width: 700, height: 700 });
    const standard = getHomeDesktopPov({ width: 1440, height: 900 });
    const ultrawide = getHomeDesktopPov({ width: 3440, height: 1440 });

    expect(square.altitude).toBeLessThanOrEqual(HOME_DESKTOP_ALT_MAX);
    expect(square.altitude).toBeGreaterThanOrEqual(HOME_DESKTOP_ALT_MIN);

    expect(standard.altitude).toBeLessThanOrEqual(HOME_DESKTOP_ALT_MAX);
    expect(standard.altitude).toBeGreaterThanOrEqual(HOME_DESKTOP_ALT_MIN);

    expect(ultrawide.altitude).toBeLessThanOrEqual(HOME_DESKTOP_ALT_MAX);
    expect(ultrawide.altitude).toBeGreaterThanOrEqual(HOME_DESKTOP_ALT_MIN);
  });

  it("is monotonically decreasing with aspect ratio (wider viewport -> lower altitude)", () => {
    const aspect1 = getHomeDesktopPov({ width: 1024, height: 768 }); // aspect 1.333
    const aspect2 = getHomeDesktopPov({ width: 1440, height: 900 }); // aspect 1.6
    const aspect3 = getHomeDesktopPov({ width: 1920, height: 1080 }); // aspect 1.777
    const aspect4 = getHomeDesktopPov({ width: 2560, height: 1080 }); // aspect 2.370

    expect(aspect1.altitude).toBeGreaterThan(aspect2.altitude);
    expect(aspect2.altitude).toBeGreaterThan(aspect3.altitude);
    expect(aspect3.altitude).toBeGreaterThanOrEqual(aspect4.altitude);
  });

  it("handles missing or zero-height viewport safely", () => {
    const fallback = getHomeDesktopPov();
    expect(fallback.altitude).toBeGreaterThanOrEqual(HOME_DESKTOP_ALT_MIN);
    expect(fallback.altitude).toBeLessThanOrEqual(HOME_DESKTOP_ALT_MAX);

    const zeroHeight = getHomeDesktopPov({ width: 1000, height: 0 });
    expect(zeroHeight.altitude).toBeGreaterThanOrEqual(HOME_DESKTOP_ALT_MIN);
    expect(zeroHeight.altitude).toBeLessThanOrEqual(HOME_DESKTOP_ALT_MAX);
  });
});
