import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getHomeCardPointOfView } from "../globe/hooks/cameraTargetBuilder";
import { CAMERA_MS } from "../globe/hooks/cameraTiming";
import { getHomeDesktopPov } from "../globe/hooks/homePov";
import { useGlobeCamera } from "../globe/hooks/useGlobeCamera";

const createMockGlobe = (initialPov = { lat: 16, lng: 28, altitude: 1.6 }) => {
  let currentPov = { ...initialPov };
  const pointOfView = vi.fn((pov, _ms) => {
    if (pov) {
      currentPov = { ...pov };
      return undefined;
    }
    return currentPov;
  });
  return {
    current: {
      pointOfView,
      controls: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      renderer: () => ({
        getPixelRatio: () => 1,
        setPixelRatio: vi.fn(),
        debug: {},
      }),
    },
  };
};

describe("useGlobeCamera home mode transitions", () => {
  const viewport = { width: 1440, height: 900 };

  it("targets world home desktop POV when idle in world mode on home screen", () => {
    const globeEl = createMockGlobe();
    renderHook(() =>
      useGlobeCamera({
        globeEl,
        selectedCountry: null,
        shouldAutoRotate: false,
        viewport,
        isHomeScreen: true,
        mode: "capitals",
        gameDataMap: {},
      })
    );

    const expectedWorldPov = getHomeDesktopPov(viewport);
    expect(globeEl.current.pointOfView).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: expectedWorldPov.lat,
        lng: expectedWorldPov.lng,
      }),
      expect.any(Number)
    );
  });

  it("targets France customPOV when idle in departments mode on home screen, not world POV", () => {
    const globeEl = createMockGlobe();
    renderHook(() =>
      useGlobeCamera({
        globeEl,
        selectedCountry: null,
        shouldAutoRotate: false,
        viewport,
        isHomeScreen: true,
        mode: "departments",
        gameDataMap: {},
      })
    );

    // Targets France bounds centroid (lat: 46.2, lng: 2.2)
    expect(globeEl.current.pointOfView).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: expect.closeTo(46.2, 1),
        lng: expect.closeTo(2.2, 1),
      }),
      expect.any(Number)
    );

    // Must NEVER send the camera to the zoomed out world desktop view
    const worldPov = getHomeDesktopPov(viewport);
    expect(globeEl.current.pointOfView).not.toHaveBeenCalledWith(
      expect.objectContaining({
        lat: worldPov.lat,
        lng: worldPov.lng,
      }),
      expect.any(Number)
    );
  });

  it("targets USA customPOV when idle in US states mode on home screen, not world POV", () => {
    const globeEl = createMockGlobe();
    renderHook(() =>
      useGlobeCamera({
        globeEl,
        selectedCountry: null,
        shouldAutoRotate: false,
        viewport,
        isHomeScreen: true,
        mode: "us_states",
        gameDataMap: {},
      })
    );

    // Targets USA bounds centroid (lat: 36.95, lng: -95.85)
    expect(globeEl.current.pointOfView).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: expect.closeTo(36.95, 1),
        lng: expect.closeTo(-95.85, 1),
      }),
      expect.any(Number)
    );
  });

  it("targets regional customPOV directly when switching modes with an old unmapped selectedCountry", () => {
    const globeEl = createMockGlobe();
    let mode = "capitals";
    const selectedCountry = "Japan";
    let gameDataMap = {
      Japan: { lat: 36.2, lng: 138.25 },
    };

    const { rerender } = renderHook(() =>
      useGlobeCamera({
        globeEl,
        selectedCountry,
        shouldAutoRotate: false,
        viewport,
        isHomeScreen: true,
        mode,
        gameDataMap,
      })
    );

    // Switch to departments before selectedCountry state updates to a department.
    // gameDataMap is now departmentsDataMap where "Japan" does not exist.
    mode = "departments";
    gameDataMap = {
      "01": { lat: 46.2, lng: 5.2 },
    };
    rerender();

    // Must target France directly instead of falling back to zoomed-out world POV
    expect(globeEl.current.pointOfView).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: expect.closeTo(46.2, 1),
        lng: expect.closeTo(2.2, 1),
      }),
      CAMERA_MS.home
    );
  });
});

describe("getHomeCardPointOfView", () => {
  it("returns France / USA / world framing for each home mode", () => {
    const desktop = { width: 1440, height: 900 };
    const mobile = { width: 390, height: 844 };
    const frDesktop = getHomeCardPointOfView({
      mode: "departments",
      learnSubMode: "departments",
      viewport: desktop,
      isPanelOpen: false,
    });
    expect(frDesktop.lat).toBeCloseTo(46.2, 1);
    expect(frDesktop.lng).toBeCloseTo(2.2, 1);

    const frMobile = getHomeCardPointOfView({
      mode: "departments",
      learnSubMode: "departments",
      viewport: mobile,
      isPanelOpen: false,
    });
    expect(frMobile.lat).toBeCloseTo(45.0, 0);
    expect(frMobile.lng).toBeCloseTo(2.2, 1);

    const us = getHomeCardPointOfView({
      mode: "us_states",
      learnSubMode: "us_states",
      viewport: desktop,
      isPanelOpen: false,
    });
    expect(us.lat).toBeCloseTo(36.95, 1);
    expect(us.lng).toBeCloseTo(-95.85, 1);

    const worldDesktop = getHomeCardPointOfView({
      mode: "countries",
      learnSubMode: "countries",
      viewport: desktop,
      isPanelOpen: false,
    });
    expect(worldDesktop).toEqual(getHomeDesktopPov(desktop));

    const worldMobile = getHomeCardPointOfView({
      mode: "capitals",
      learnSubMode: "countries",
      viewport: mobile,
      isPanelOpen: false,
    });
    expect(worldMobile).toEqual({ lat: 18, lng: 20, altitude: 2.2 });
  });
});

describe("home card camera fly duration and interruption", () => {
  const viewport = { width: 1440, height: 900 };

  const createTweenGlobe = (initialPov = { lat: 16, lng: 28, altitude: 1.6 }) => {
    let currentPov = { ...initialPov };
    const pointOfView = vi.fn((pov, ms) => {
      if (!pov) return { ...currentPov };
      if (!ms) {
        currentPov = { ...pov };
        return undefined;
      }
      // In-flight tween: do not snap current to the target.
      return undefined;
    });
    return { current: { pointOfView }, _setCurrent: (p) => (currentPov = { ...p }) };
  };

  it("flies to France with a non-zero home duration when switching from world", () => {
    const globeEl = createMockGlobe({ lat: 16, lng: 28, altitude: 1.6 });
    let mode = "countries";
    const { rerender } = renderHook(() =>
      useGlobeCamera({
        globeEl,
        selectedCountry: null,
        shouldAutoRotate: false,
        viewport,
        isHomeScreen: true,
        mode,
        gameDataMap: {},
      })
    );
    globeEl.current.pointOfView.mockClear();
    mode = "departments";
    rerender();
    expect(globeEl.current.pointOfView).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: expect.closeTo(46.2, 1),
        lng: expect.closeTo(2.2, 1),
      }),
      CAMERA_MS.home
    );
  });

  it("retargets from the current pose when a second card change interrupts the fly", () => {
    const globeEl = createTweenGlobe({ lat: 16, lng: 28, altitude: 1.6 });
    let mode = "countries";
    const { rerender } = renderHook(() =>
      useGlobeCamera({
        globeEl,
        selectedCountry: null,
        shouldAutoRotate: false,
        viewport,
        isHomeScreen: true,
        mode,
        gameDataMap: {},
      })
    );
    mode = "departments";
    rerender();
    // Mid-fly pose (still over the Atlantic, not yet France).
    const mid = { lat: 30, lng: -20, altitude: 1.2 };
    globeEl._setCurrent(mid);
    // Mark a tween as active so cancel writes the current pose at duration 0.
    // animateGlobePov records povTweenEndsAt; call it the way the hook does.
    globeEl.current.pointOfView.mockClear();
    mode = "us_states";
    rerender();

    const calls = globeEl.current.pointOfView.mock.calls.filter((c) => c[0]);
    const snappedToUsa = calls.some(
      ([pov, ms]) =>
        Math.abs((pov.lat ?? 0) - 36.95) < 1 && Math.abs((pov.lng ?? 0) + 95.85) < 1 && ms === 0
    );
    expect(snappedToUsa, "must not snap to the USA framing").toBe(false);

    const usaFly = calls.find(
      ([pov, ms]) =>
        Math.abs((pov.lat ?? 0) - 36.95) < 1 && Math.abs((pov.lng ?? 0) + 95.85) < 1 && ms > 0
    );
    expect(usaFly, "should retarget to the USA with a positive duration").toBeTruthy();
    expect(usaFly[1]).toBe(CAMERA_MS.home);

    // Cancel (if a tween was active) writes the mid pose at 0, never a jump.
    const zeroCalls = calls.filter(([, ms]) => ms === 0);
    for (const [pov] of zeroCalls) {
      expect(pov.lat).toBeCloseTo(mid.lat, 5);
      expect(pov.lng).toBeCloseTo(mid.lng, 5);
    }
  });
});
