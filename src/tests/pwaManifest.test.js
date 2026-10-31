/* eslint-disable security/detect-non-literal-fs-filename -- test reads fixed public/ asset paths from the manifest */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
const html = readFileSync(resolve(root, "index.html"), "utf8");

describe("manifest et icônes de raccourci (Android / iOS)", () => {
  it("référence le manifest et l'apple-touch-icon dans index.html", () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it("déclare des icônes PNG 192 et 512 (any) et maskable", () => {
    const has = (size, purpose) =>
      manifest.icons.some(
        (i) => i.sizes === `${size}x${size}` && i.type === "image/png" && i.purpose === purpose
      );
    expect(has(192, "any")).toBe(true);
    expect(has(512, "any")).toBe(true);
    expect(has(192, "maskable")).toBe(true);
    expect(has(512, "maskable")).toBe(true);
  });

  it("toutes les icônes référencées existent dans public/", () => {
    for (const icon of manifest.icons) {
      expect(existsSync(resolve(root, "public", icon.src.replace(/^\//, "")))).toBe(true);
    }
    for (const f of ["favicon.svg", "favicon.ico", "apple-touch-icon.png"]) {
      expect(existsSync(resolve(root, "public", f))).toBe(true);
    }
  });

  it("a un start_url, un nom et un mode d'affichage", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
  });
});
