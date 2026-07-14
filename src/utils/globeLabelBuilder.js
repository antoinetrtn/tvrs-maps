import { shouldScrambleLabel } from "../config/gameConfig";
import { scrambleText } from "./utils";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";

/**
 * Scramble text dynamically with a ratio of random glyphs.
 */
function scrambleTextWithRatio(text, ratio) {
  if (!text) return "";
  const glyphs = "░▒▓█░▒▓█▲▼◆◇@#$%&?*¢¤§[]{}<>/=+_~^0123456789XØÆßΔΩΨΞ";
  return text
    .split("")
    .map((char) => {
      if (char === " " || char === "-" || char === "'") return char;
      if (Math.random() < ratio) {
        const glyphIndex = Math.floor(Math.random() * glyphs.length);
        return glyphs[glyphIndex];
      }
      return char;
    })
    .join("");
}

/**
 * Creates and configures a DOM element representing a label on the 3D globe.
 * Handles both the glitch/scrambling state and normal clean state, including 
 * the lifecycle intervals for active text animation.
 */
export function createGlobeLabelElement(d, {
  REGION_COLORS_LABELS,
  UI_COLORS,
  isHomeScreen,
  isEndScreen,
  isLight,
  gameDataMap,
  globeTheme,
  mode,
  t
}) {
  const el = document.createElement("div");

  let color;
  if (d.mode === "departments") {
    color = d.isFound
      ? UI_COLORS.success
      : d.isSelected
        ? UI_COLORS.accent
        : UI_COLORS.textMuted;
  } else if (isHomeScreen) {
    color = d.isSelected ? UI_COLORS.accent : UI_COLORS.textMuted;
  } else {
    const isHighlight = d.isFound || d.isSelected;
    const colorType = UI_COLORS.labelColorType || "regional";

    if (colorType === "paper") {
      color = isHighlight ? UI_COLORS.accent : UI_COLORS.textMuted;
    } else {
      // regional
      color = isHighlight
        ? REGION_COLORS_LABELS[d.region] || UI_COLORS.accent
        : UI_COLORS.textMuted;
    }
  }

  const labelText = UI_COLORS.globeLabelText || UI_COLORS.textMain;
  const labelDot = UI_COLORS.globeLabelDot || color;
  const labelStalk = UI_COLORS.globeLabelStalk || UI_COLORS.accent;

  // Set root to 0 size so its center is the exact lat/lng
  el.style.width = "0";
  el.style.height = "0";
  el.style.position = "relative";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";

  const isPlayMode =
    mode !== "learn" && d.mode !== "learn" && !isHomeScreen && !isEndScreen;
  const revealAll = !isPlayMode || d.isFound;

  // Uniform scramble across every guessable mode (countries, capitals, departments,
  // rivers/mountains) so no mode leaks its answer as readable text.
  const isGlitchMode = shouldScrambleLabel(d.mode, {
    isFound: d.isFound,
    isHomeScreen,
    isEndScreen,
    isSelected: d.isSelected,
    isLearn: mode === "learn",
  });

  if (isGlitchMode) {
    const isCapitalsMode = d.mode === "capitals";
    const isReliefMode = d.mode === "rivers_mountains";
    const isErrorLabel = d.isError;

    let glitchLine1Class = "glitch-country";
    let glitchLine1Raw = d.country;
    if (isErrorLabel) {
      glitchLine1Class = "glitch-error";
      glitchLine1Raw = `⚠ ${t("error")}`;
    } else if (isCapitalsMode) {
      glitchLine1Class = "glitch-capital";
      glitchLine1Raw = d.capital;
    } else if (isReliefMode) {
      glitchLine1Class = "glitch-relief";
      glitchLine1Raw = d.country;
    }

    const dotColor = isErrorLabel ? UI_COLORS.error : labelDot;
    const stalkColor = isErrorLabel ? UI_COLORS.error : labelStalk;
    const textColor = isErrorLabel ? UI_COLORS.error : labelText;

    el.innerHTML = `
      <div class="globe-label-element" style="position: relative; width: 0; height: 0; pointer-events: none;">
        <!-- Dot -->
        <div style="
          position: absolute;
          width: 6px;
          height: 6px;
          background: ${dotColor};
          border-radius: 50%;
          left: -3px;
          top: -3px;
          box-shadow: 0 0 8px ${dotColor};
          opacity: ${isHomeScreen ? 0.5 : 1};
        "></div>
        <!-- Stalk Line (Shortened to 15px) -->
        <div style="
          position: absolute;
          width: 1.2px;
          height: 15px;
          background: ${stalkColor};
          left: -0.6px;
          bottom: 3px;
          box-shadow: 0 1px 3px color-mix(in srgb, ${UI_COLORS.black} 85%, transparent);
          opacity: ${isHomeScreen ? 0.4 : 0.85};
        "></div>
        <!-- Centered Minimalist Label directly above the stalk (placed at bottom: 21px) -->
        <div class="scramble-callout" style="
          position: absolute;
          left: 50%;
          bottom: 21px;
          transform: translateX(-50%);
          animation: labelReveal 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: var(--font-display, monospace) !important;
          white-space: nowrap;
          color: ${textColor};
          text-shadow: 0 1px 2px color-mix(in srgb, ${UI_COLORS.black} 60%, transparent);
          opacity: ${isHomeScreen ? 0.6 : 1};
        ">
          ${
            d.iso2
              ? `<img src="/flags/${d.iso2.toLowerCase()}.svg" class="globe-label-flag" style="width: 48px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid var(--glass-border); box-shadow: var(--glass-shadow); margin-bottom: 5px;" alt="" />`
              : ""
          }
          <div style="font-weight: 700; font-size: calc(10px * var(--ui-scale, 1)); height: calc(12px * var(--ui-scale, 1)); line-height: calc(12px * var(--ui-scale, 1)); display: flex; align-items: center; gap: 4px; font-family: var(--font-display, monospace) !important;">
            <span class="${glitchLine1Class}" data-text="${glitchLine1Raw}" style="font-family: var(--font-display, monospace) !important;">${isErrorLabel ? glitchLine1Raw : scrambleText(glitchLine1Raw)}</span>
          </div>
          ${
            isCapitalsMode && !isErrorLabel
              ? `
            <div style="font-weight: 500; font-size: calc(8.5px * var(--ui-scale, 1)); height: calc(10px * var(--ui-scale, 1)); line-height: calc(10px * var(--ui-scale, 1)); color: color-mix(in srgb, ${UI_COLORS.textMuted} 80%, transparent); margin-top: 1px; font-family: var(--font-display, monospace) !important;">
              <span class="glitch-country" data-text="${d.country}" style="font-family: var(--font-display, monospace) !important;">${scrambleText(d.country)}</span>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;

    let hasBeenAttached = false;
    // Start dynamic scrambling interval
    const interval = setInterval(() => {
      const isAttached = document.body.contains(el);
      if (isAttached) {
        hasBeenAttached = true;
      }
      if (hasBeenAttached && !isAttached) {
        clearInterval(interval);
        return;
      }
      el.querySelectorAll(".glitch-country, .glitch-capital, .glitch-relief").forEach((node) => {
        const raw = node.getAttribute("data-text") || "";
        node.innerText = scrambleText(raw, Math.random());
      });
    }, 150);
  } else {
    const isMtn =
      countryDataMap[d.admin]?.type === "mountain_range" ||
      riversMountainsDataMap[d.admin]?.type === "mountain_range";
    const iconSymbol = d.mode === "rivers_mountains" ? (isMtn ? "🏔️ " : "💧 ") : "";

    const displayName = revealAll ? d.country : "???";
    const displayCapital = revealAll ? d.capital : "???";

    const hasCapitalLine = (d.mode === "capitals" || (mode === "learn" && d.learnShowCapitals)) && d.capital;
    const isDeptMode = d.mode === "departments";

    const getScrambledHtml = (ratio) => {
      let scrambledLine1;
      let scrambledLine2 = null;
      const scramble = (txt) => ratio <= 0.0 ? txt : scrambleTextWithRatio(txt, ratio);

      if (isDeptMode) {
        const rawCode = d.code ? `<span style="font-weight: 800; background: ${color}; color: ${UI_COLORS.textInverse}; padding: 0px 3px; border-radius: 3px; font-size: calc(8.5px * var(--ui-scale, 1)); line-height: 1.1; margin-right: 3px;">${d.code}</span>` : "";
        scrambledLine1 = `${rawCode}<span>${scramble(displayName)}</span>`;
        if (d.capital) scrambledLine2 = `(${scramble(displayCapital)})`;
      } else {
        const baseLine1Text = hasCapitalLine ? `${d.capital}` : `${d.country}`;
        const inlineFlag = d.iso2 ? "" : (d.flag || "");
        const prefix = hasCapitalLine ? `${inlineFlag}` : `${iconSymbol || inlineFlag}`;
        scrambledLine1 = `<span>${prefix} ${scramble(baseLine1Text)}</span>`;
        if (hasCapitalLine && !d.hideCountryLine) scrambledLine2 = scramble(d.country);
      }

      const flagAbove = d.iso2
        ? `<img src="/flags/${d.iso2.toLowerCase()}.svg" class="globe-label-flag" style="width: 48px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid var(--glass-border); box-shadow: var(--glass-shadow); margin-bottom: 5px;" alt="" />`
        : "";

      return `
        ${flagAbove}
        <div style="font-weight: 700; font-size: calc(10px * var(--ui-scale, 1)); height: calc(12px * var(--ui-scale, 1)); line-height: calc(12px * var(--ui-scale, 1)); display: flex; align-items: center; justify-content: center; gap: 4px; font-family: ${ratio > 0.0 ? "var(--font-display, monospace) !important" : "inherit"};">${scrambledLine1}</div>
        ${scrambledLine2 ? `<div style="font-weight: 500; font-size: calc(8.5px * var(--ui-scale, 1)); height: calc(10px * var(--ui-scale, 1)); line-height: calc(10px * var(--ui-scale, 1)); color: color-mix(in srgb, ${UI_COLORS.textMuted} 80%, transparent); margin-top: 1px; font-family: ${ratio > 0.0 ? "var(--font-display, monospace) !important" : "inherit"};">${scrambledLine2}</div>` : ""}
      `;
    };

    el.innerHTML = `
      <div class="globe-label-element" style="position: relative; width: 0; height: 0; pointer-events: none;">
        <!-- Dot -->
        <div style="
          position: absolute;
          width: 6px;
          height: 6px;
          background: ${labelDot};
          border-radius: 50%;
          left: -3px;
          top: -3px;
          box-shadow: 0 0 8px ${labelDot};
          opacity: ${isHomeScreen ? 0.5 : 1};
        "></div>
        <!-- Stalk Line (Shortened to 15px) -->
        <div style="
          position: absolute;
          width: 1.2px;
          height: 15px;
          background: ${labelStalk};
          left: -0.6px;
          bottom: 3px;
          box-shadow: 0 1px 3px color-mix(in srgb, ${UI_COLORS.black} 85%, transparent);
          opacity: ${isHomeScreen ? 0.4 : 0.85};
        "></div>
        <!-- Centered Minimalist Label directly above the stalk (placed at bottom: 21px) -->
        <div class="normal-text-container" style="
          position: absolute;
          left: 50%;
          bottom: 21px;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: var(--font-main);
          white-space: nowrap;
          color: ${labelText};
          text-shadow: 0 1px 2px color-mix(in srgb, ${UI_COLORS.black} 60%, transparent);
          opacity: ${isHomeScreen ? 0.6 : 1};
        ">
          ${getScrambledHtml(1.0)}
        </div>
      </div>
    `;

    let scrambleProgress = 0.0;
    let hasBeenAttached = false;
    
    const mountInterval = setInterval(() => {
      const isAttached = document.body.contains(el);
      if (isAttached) {
        hasBeenAttached = true;
      }
      if (hasBeenAttached && !isAttached) {
        clearInterval(mountInterval);
        return;
      }

      scrambleProgress += 0.08; // ~360ms total duration
      const textContainer = el.querySelector(".normal-text-container");
      if (!textContainer) return;

      if (scrambleProgress >= 1.0) {
        clearInterval(mountInterval);
        textContainer.innerHTML = getScrambledHtml(0.0);
        return;
      }

      textContainer.innerHTML = getScrambledHtml(1.0 - scrambleProgress);
    }, 30);
  }
  return el;
}
