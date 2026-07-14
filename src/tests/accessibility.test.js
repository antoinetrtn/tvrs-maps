/* eslint-disable security/detect-non-literal-fs-filename -- test scanner intentionally walks source for static checks */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Mobile Accessibility Checks", () => {
  it("should ensure no component uses onPointerDown to preventDefault (which blocks mobile touch/clicks)", () => {
    const dirs = [path.resolve(__dirname, ".."), path.resolve(__dirname, "../components")];

    dirs.forEach((dir) => {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        if (!file.endsWith(".jsx")) return;
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, "utf8");

        // Match onPointerDown containing preventDefault
        const hasBuggyPointerDown =
          /onPointerDown\s*=\s*\{\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*[^}]*preventDefault/i.test(
            content
          );

        expect(hasBuggyPointerDown).toBe(false);
      });
    });
  });
});
