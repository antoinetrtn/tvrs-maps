import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGlobeInteractions } from "../globe/hooks/useGlobeInteractions";
import { pickMicroTerritory, pickNearestByPixels, setMicroAdmins } from "../globe/microSnap";

// Flat test projection: 10 px per degree.
const project = (lat, lng) => ({ x: lng * 10, y: -lat * 10 });
const gameDataMap = {
  Italy: { lat: 42.8, lng: 12.5 },
  Vatican: { lat: 41.9, lng: 12.45 },
  "San Marino": { lat: 43.94, lng: 12.46 },
  Grenada: { lat: 12.1, lng: -61.7 },
  "Saint Vincent and the Grenadines": { lat: 13.2, lng: -61.2 },
  Barbados: { lat: 13.17, lng: -59.55 },
};
const admins = new Set([
  "Vatican",
  "San Marino",
  "Grenada",
  "Saint Vincent and the Grenadines",
  "Barbados",
]);
const at = (lng, lat) => ({ lng, lat, click: project(lat, lng) });

describe("pickMicroTerritory", () => {
  it("Vatican wins inside Italy when within the mouse radius", () => {
    const r = pickMicroTerritory({
      admins,
      gameDataMap,
      project,
      ...at(12.5, 41.95),
      pointerType: "mouse",
      altitude: 0.5,
      insideOther: true,
    });
    expect(r.admin).toBe("Vatican");
  });
  it("does not steal a click far from the micro", () => {
    expect(
      pickMicroTerritory({
        admins,
        gameDataMap,
        project,
        ...at(16, 41),
        pointerType: "mouse",
        altitude: 0.5,
        insideOther: true,
      })
    ).toBeNull();
  });
  it("touch radius is larger than mouse", () => {
    const base = { admins, gameDataMap, project, ...at(12.45, 41.9 - 2.8), altitude: 0.5 };
    expect(pickMicroTerritory({ ...base, pointerType: "mouse" })).toBeNull();
    expect(pickMicroTerritory({ ...base, pointerType: "touch" }).admin).toBe("Vatican");
  });
  it("zoomed out halves the steal radius inside another country", () => {
    const base = { admins, gameDataMap, project, ...at(12.45, 41.9 - 1.8), pointerType: "mouse" };
    expect(pickMicroTerritory({ ...base, altitude: 2, insideOther: true })).toBeNull();
    expect(pickMicroTerritory({ ...base, altitude: 2, insideOther: false }).admin).toBe("Vatican");
  });
  it("picks the nearest when several are in range and reports the count", () => {
    const r = pickMicroTerritory({
      admins,
      gameDataMap,
      project,
      ...at(-61.5, 12.5),
      pointerType: "touch",
    });
    expect(r.admin).toBe("Grenada");
    expect(r.count).toBe(3);
  });
  it("ignores micros on the far side of the globe", () => {
    const back = () => ({ x: 0, y: 0 });
    expect(
      pickMicroTerritory({
        admins,
        gameDataMap,
        project: back,
        click: { x: 0, y: 0 },
        lng: -168,
        lat: -42,
        pointerType: "mouse",
      })
    ).toBeNull();
  });
});

describe("pickNearestByPixels", () => {
  it("uses a pixel radius instead of degrees", () => {
    expect(
      pickNearestByPixels({ gameDataMap, project, ...at(-59.6, 13), radiusPx: 48 }).admin
    ).toBe("Barbados");
    expect(pickNearestByPixels({ gameDataMap, project, ...at(-50, 13), radiusPx: 48 })).toBeNull();
  });
});

describe("selectCountryAtLngLat with screen projection", () => {
  afterEach(() => setMicroAdmins(null));
  it("selects Vatican from a click inside Italy's polygon", () => {
    setMicroAdmins([...admins]);
    const onCountrySelect = vi.fn();
    const globeEl = {
      current: { getScreenCoords: project, pointOfView: () => ({ altitude: 0.4 }) },
    };
    const italy = {
      admin: "Italy",
      bounds: { minLng: 6, maxLng: 19, minLat: 36, maxLat: 47 },
      polygons: [
        [
          [
            [6, 36],
            [19, 36],
            [19, 47],
            [6, 47],
            [6, 36],
          ],
        ],
      ],
    };
    const { result } = renderHook(() =>
      useGlobeInteractions({
        globeEl,
        globeContentWrapperRef: { current: null },
        isHomeScreen: true,
        isKeyboardMode: false,
        viewport: { width: 1024, height: 768 },
        perfProfile: {},
        onCountrySelect,
        mode: "countries",
        gameDataMap,
        selectableFeatureIndex: [italy],
        isDepartmentMode: false,
        isRiversMountainsMode: false,
      })
    );
    result.current.selectCountryAtLngLat(12.5, 41.95, {
      ...project(41.95, 12.5),
      pointerType: "mouse",
    });
    expect(onCountrySelect).toHaveBeenLastCalledWith("Vatican");
  });
});
