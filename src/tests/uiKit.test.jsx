import { fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import OptionGroup from "../components/ui/OptionGroup";
import { SettingsRow, SettingsSection } from "../components/ui/Settings";
import Slider from "../components/ui/Slider";
import Switch from "../components/ui/Switch";

const ControlledSlider = (props) => {
  const [v, setV] = useState(props.initial ?? 15);
  return <Slider {...props} value={v} onChange={setV} formatValue={(m) => `${m} min`} />;
};

describe("Slider", () => {
  it("shows the formatted value and exposes a range input", () => {
    render(<ControlledSlider label="Durée" min={1} max={60} />);
    const input = screen.getByRole("slider", { name: "Durée" });
    expect(input).toHaveProperty("value", "15");
    expect(input.getAttribute("aria-valuetext")).toBe("15 min");
    expect(screen.getByText("15 min")).toBeTruthy();
  });

  it("steps with the −/+ icon buttons (no redundant text)", () => {
    render(
      <ControlledSlider
        label="Durée"
        min={1}
        max={60}
        decrementLabel="-1 minute"
        incrementLabel="+1 minute"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "+1 minute" }));
    expect(screen.getByText("16 min")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "-1 minute" }));
    fireEvent.click(screen.getByRole("button", { name: "-1 minute" }));
    expect(screen.getByText("14 min")).toBeTruthy();
    expect(screen.getByRole("button", { name: "+1 minute" }).textContent).toBe("");
  });

  it("clamps to min/max and disables steppers at the bounds", () => {
    render(<ControlledSlider label="Durée" min={1} max={3} initial={3} incrementLabel="plus" />);
    const plus = screen.getByRole("button", { name: "plus" });
    expect(plus.disabled).toBe(true);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "99" } });
    expect(screen.getByText("3 min")).toBeTruthy();
  });

  it("forwards native input changes (keyboard / touch drag)", () => {
    const onChange = vi.fn();
    render(<Slider label="X" value={5} min={0} max={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith(7);
  });
});

describe("Switch", () => {
  it("toggles and reflects aria-checked", () => {
    const Wrapped = () => {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onChange={setOn} label="Mode paisible" />;
    };
    render(<Wrapped />);
    const sw = screen.getByRole("switch", { name: "Mode paisible" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("does nothing when disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="x" disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("OptionGroup", () => {
  const options = [
    { value: "fr", label: "Français" },
    { value: "en", label: "English" },
  ];
  const Wrapped = () => {
    const [v, setV] = useState("fr");
    return <OptionGroup label="Langue" options={options} value={v} onChange={setV} />;
  };

  it("renders a radiogroup with one checked radio", () => {
    render(<Wrapped />);
    expect(screen.getByRole("radiogroup", { name: "Langue" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Français" }).getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(screen.getByRole("radio", { name: "English" }).tabIndex).toBe(-1);
  });

  it("selects on click and with arrow keys (roving focus)", () => {
    render(<Wrapped />);
    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe(
      "true"
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "English" }), { key: "ArrowRight" });
    const fr = screen.getByRole("radio", { name: "Français" });
    expect(fr.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(fr);
  });
});

describe("SettingsSection / SettingsRow", () => {
  it("labels the section with its title and renders row text + control", () => {
    render(
      <SettingsSection title="Partie">
        <SettingsRow label="Mode paisible" description="Vies infinies">
          <button type="button">ctl</button>
        </SettingsRow>
      </SettingsSection>
    );
    expect(screen.getByRole("region", { name: "Partie" })).toBeTruthy();
    expect(screen.getByText("Mode paisible")).toBeTruthy();
    expect(screen.getByText("Vies infinies")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ctl" })).toBeTruthy();
  });

  it("supports the stacked layout", () => {
    const { container } = render(
      <SettingsRow label="Langue" layout="stacked">
        <span>x</span>
      </SettingsRow>
    );
    expect(container.querySelector(".ui-settings-row--stacked")).toBeTruthy();
  });

  it("hides title visually when hideTitle is true", () => {
    render(
      <SettingsSection title="Partie" hideTitle>
        <span>content</span>
      </SettingsSection>
    );
    expect(screen.getByRole("region", { name: "Partie" })).toBeTruthy();
    const heading = screen.getByRole("heading", { name: "Partie" });
    expect(heading.className).toContain("sr-only");
  });

  it("supports srDescription with aria-describedby", () => {
    render(
      <SettingsRow label="Mode paisible" srDescription="Vies infinies">
        <button type="button">ctl</button>
      </SettingsRow>
    );
    const desc = screen.getByText("Vies infinies");
    expect(desc.className).toContain("sr-only");
    const ctl = screen.getByRole("button", { name: "ctl" }).parentElement;
    expect(ctl.getAttribute("aria-describedby")).toBe(desc.id);
  });
});
