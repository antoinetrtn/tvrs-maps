import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import XpBar from "../components/XpBar";

describe("XpBar component", () => {
  it("renders with role progressbar, correct range, and label", () => {
    render(<XpBar percent={50} label="Progression du niveau" />);
    const bar = screen.getByRole("progressbar", { name: "Progression du niveau" });
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
  });

  describe("clamping and sanitization of percent", () => {
    it("clamps negative percent to 0", () => {
      render(<XpBar percent={-5} label="Negative test" />);
      const bar = screen.getByRole("progressbar", { name: "Negative test" });
      expect(bar.getAttribute("aria-valuenow")).toBe("0");
    });

    it("clamps percent over 100 to 100", () => {
      render(<XpBar percent={150} label="Over 100 test" />);
      const bar = screen.getByRole("progressbar", { name: "Over 100 test" });
      expect(bar.getAttribute("aria-valuenow")).toBe("100");
    });

    it("treats NaN percent as 0", () => {
      render(<XpBar percent={NaN} label="NaN test" />);
      const bar = screen.getByRole("progressbar", { name: "NaN test" });
      expect(bar.getAttribute("aria-valuenow")).toBe("0");
    });

    it("rounds floating percent values for aria-valuenow", () => {
      render(<XpBar percent={33.7} label="Float test" />);
      const bar = screen.getByRole("progressbar", { name: "Float test" });
      expect(bar.getAttribute("aria-valuenow")).toBe("34");
    });
  });

  describe("cell clipping calculation", () => {
    it("shows at least one cell when percent > 0 but tiny", () => {
      const { container } = render(<XpBar percent={0.1} cells={20} />);
      const fill = container.querySelector(".xp-bar-fill");
      expect(fill).toBeTruthy();
      // 1 cell out of 20 = 5% revealed -> clip-path: inset(0 95% 0 0)
      expect(fill.style.clipPath).toBe("inset(0 95% 0 0)");
    });

    it("shows 0 cells when percent is 0", () => {
      const { container } = render(<XpBar percent={0} cells={20} />);
      const fill = container.querySelector(".xp-bar-fill");
      expect(fill).toBeTruthy();
      expect(fill.style.clipPath).toBe("inset(0 100% 0 0)");
    });

    it("shows all cells when percent is 100", () => {
      const { container } = render(<XpBar percent={100} cells={20} />);
      const fill = container.querySelector(".xp-bar-fill");
      expect(fill).toBeTruthy();
      expect(fill.style.clipPath).toBe("inset(0 0% 0 0)");
    });

    it("supports custom cell counts such as mini default 8 cells", () => {
      const { container } = render(<XpBar variant="mini" percent={0.01} />);
      const fill = container.querySelector(".xp-bar-fill");
      expect(fill).toBeTruthy();
      // 1 cell out of 8 = 12.5% revealed -> clip-path: inset(0 87.5% 0 0)
      expect(fill.style.clipPath).toBe("inset(0 87.5% 0 0)");
    });
  });

  describe("variant class names", () => {
    it("applies bar variant by default", () => {
      const { container } = render(<XpBar percent={25} />);
      const root = container.querySelector(".xp-bar");
      expect(root.classList.contains("xp-bar-bar")).toBe(true);
      expect(root.classList.contains("xp-bar-mini")).toBe(false);
    });

    it("applies mini variant and preserves custom className", () => {
      const { container } = render(
        <XpBar variant="mini" percent={25} className="custom-test-bar" />
      );
      const root = container.querySelector(".xp-bar");
      expect(root.classList.contains("xp-bar-mini")).toBe(true);
      expect(root.classList.contains("xp-bar-bar")).toBe(false);
      expect(root.classList.contains("custom-test-bar")).toBe(true);
    });
  });
});
