import { fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import TabBar from "../components/ui/TabBar";

const OPTIONS = [
  { value: "profile", label: "Profil" },
  { value: "stats", label: "Stats" },
  { value: "disabled", label: "Désactivé", disabled: true },
  { value: "extra", label: "Extra" },
];

const ControlledTabBar = ({ initial = "profile", level = 1, options = OPTIONS, ...props }) => {
  const [value, setValue] = useState(initial);
  return (
    <TabBar
      level={level}
      label="Navigation"
      options={options}
      value={value}
      onChange={setValue}
      {...props}
    />
  );
};

describe("TabBar", () => {
  it("renders tablist role and tabs with roving tabindex and aria-selected", () => {
    render(<ControlledTabBar />);
    const tablist = screen.getByRole("tablist", { name: "Navigation" });
    expect(tablist).toBeTruthy();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);

    const activeTab = screen.getByRole("tab", { name: "Profil" });
    expect(activeTab.getAttribute("aria-selected")).toBe("true");
    expect(activeTab.tabIndex).toBe(0);

    const inactiveTab = screen.getByRole("tab", { name: "Stats" });
    expect(inactiveTab.getAttribute("aria-selected")).toBe("false");
    expect(inactiveTab.tabIndex).toBe(-1);
  });

  it("calls onChange on click and ignores disabled tabs", () => {
    const onChange = vi.fn();
    render(<TabBar options={OPTIONS} value="profile" onChange={onChange} label="Navigation" />);

    fireEvent.click(screen.getByRole("tab", { name: "Stats" }));
    expect(onChange).toHaveBeenCalledWith("stats");

    onChange.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Désactivé" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("navigates with ArrowRight, ArrowLeft, Home, and End with automatic activation", () => {
    render(<ControlledTabBar initial="profile" />);
    const activeTab = screen.getByRole("tab", { name: "Profil" });
    activeTab.focus();

    // ArrowRight: profile -> stats
    fireEvent.keyDown(activeTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Stats" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Stats" }));

    // ArrowRight: stats -> skips disabled -> extra
    fireEvent.keyDown(screen.getByRole("tab", { name: "Stats" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Extra" }).getAttribute("aria-selected")).toBe("true");

    // ArrowRight wraps around: extra -> profile
    fireEvent.keyDown(screen.getByRole("tab", { name: "Extra" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Profil" }).getAttribute("aria-selected")).toBe("true");

    // ArrowLeft wraps around: profile -> extra
    fireEvent.keyDown(screen.getByRole("tab", { name: "Profil" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Extra" }).getAttribute("aria-selected")).toBe("true");

    // Home: moves to first enabled (profile)
    fireEvent.keyDown(screen.getByRole("tab", { name: "Extra" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "Profil" }).getAttribute("aria-selected")).toBe("true");

    // End: moves to last enabled (extra)
    fireEvent.keyDown(screen.getByRole("tab", { name: "Profil" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Extra" }).getAttribute("aria-selected")).toBe("true");
  });

  it("level 1 renders .tab-bar-indicator only when a width is measured, and level 2 never renders it", () => {
    // In jsdom without layout: no indicator
    const { container: unmeasuredContainer } = render(
      <TabBar options={OPTIONS} value="profile" onChange={() => {}} level={1} />
    );
    expect(unmeasuredContainer.querySelector(".tab-bar-indicator")).toBeNull();
    expect(unmeasuredContainer.querySelector(".tab-bar-track.has-indicator")).toBeNull();

    // When offsetWidth is spied: indicator appears for level 1
    const widthSpy = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(90);
    const { container: level1Container } = render(
      <TabBar options={OPTIONS} value="stats" onChange={() => {}} level={1} />
    );
    const track1 = level1Container.querySelector(".tab-bar-track");
    expect(track1.className).toContain("has-indicator");
    expect(level1Container.querySelectorAll(".tab-bar-indicator")).toHaveLength(1);
    expect(track1.style.getPropertyValue("--tab-w")).toBe("90px");

    // Level 2 NEVER renders the indicator even with layout
    const { container: level2Container } = render(
      <TabBar options={OPTIONS} value="stats" onChange={() => {}} level={2} />
    );
    expect(level2Container.querySelector(".tab-bar-indicator")).toBeNull();
    expect(level2Container.querySelector(".tab-bar-track.has-indicator")).toBeNull();

    widthSpy.mockRestore();
  });

  it("sets data-overflow attributes when scrollWidth > clientWidth", () => {
    const { container } = render(
      <TabBar options={OPTIONS} value="profile" onChange={() => {}} level={2} />
    );
    const root = container.querySelector(".tab-bar");
    const track = container.querySelector(".tab-bar-track");

    Object.defineProperty(track, "clientWidth", { value: 200, configurable: true });
    Object.defineProperty(track, "scrollWidth", { value: 500, configurable: true });
    Object.defineProperty(track, "scrollLeft", { value: 0, writable: true, configurable: true });

    // Initial scroll position: overflow at end
    fireEvent.scroll(track);
    expect(root.getAttribute("data-overflow-end")).toBe("true");
    expect(root.getAttribute("data-overflow-start")).toBeNull();

    // Middle scroll: overflow at both start and end
    track.scrollLeft = 100;
    fireEvent.scroll(track);
    expect(root.getAttribute("data-overflow-start")).toBe("true");
    expect(root.getAttribute("data-overflow-end")).toBe("true");

    // Scrolled to end: overflow only at start
    track.scrollLeft = 300;
    fireEvent.scroll(track);
    expect(root.getAttribute("data-overflow-start")).toBe("true");
    expect(root.getAttribute("data-overflow-end")).toBeNull();
  });

  it("auto-scrolls the active tab into view by centering it", () => {
    const { container, rerender } = render(
      <TabBar options={OPTIONS} value="profile" onChange={() => {}} level={2} />
    );
    const track = container.querySelector(".tab-bar-track");

    Object.defineProperty(track, "clientWidth", { value: 200, configurable: true });
    Object.defineProperty(track, "scrollWidth", { value: 600, configurable: true });
    Object.defineProperty(track, "scrollLeft", { value: 0, writable: true, configurable: true });

    // Mock active element offsets on stats tab
    const statsTab = screen.getByRole("tab", { name: "Stats" });
    Object.defineProperty(statsTab, "offsetLeft", { value: 300, configurable: true });
    Object.defineProperty(statsTab, "offsetWidth", { value: 80, configurable: true });

    // Rerender with value="stats"
    rerender(<TabBar options={OPTIONS} value="stats" onChange={() => {}} level={2} />);

    // Target = 300 + 40 - 100 = 240
    expect(track.scrollLeft).toBe(240);
  });
});
