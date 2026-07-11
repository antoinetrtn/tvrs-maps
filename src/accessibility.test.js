import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Mobile Accessibility Checks", () => {
  it("should ensure no component uses onPointerDown to preventDefault (which blocks mobile touch/clicks)", () => {
    const srcDir = path.resolve(__dirname, ".");
    const files = fs.readdirSync(srcDir);
    
    files.forEach(file => {
      if (!file.endsWith(".jsx")) return;
      const filePath = path.join(srcDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      
      // Match onPointerDown containing preventDefault
      const hasBuggyPointerDown = /onPointerDown\s*=\s*\{\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*[^}]*preventDefault/i.test(content);
      
      expect(hasBuggyPointerDown).toBe(false);
    });
  });
});
