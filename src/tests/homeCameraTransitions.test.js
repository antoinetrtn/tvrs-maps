import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getHomeDesktopPov } from "../globe/hooks/homePov";
import { useGlobeCamera } from "../globe/hooks/useGlobeCamera";

describe("useGlobeCamera home mode transitions", () => {
  const viewport = { width: 1440, height: 900 };

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
    expect(globeEl.current.pointOfView).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lat: expect.closeTo(46.2, 1),
        lng: expect.closeTo(2.2, 1),
      }),
      expect.any(Number)
    );
  });
});
