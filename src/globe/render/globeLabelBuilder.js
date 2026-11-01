import { shouldScrambleLabel } from "../../config/gameConfig";
import { countryDataMap } from "../../data/gameData";
import { riversMountainsDataMap } from "../../data/riversMountainsData";
import { scrambleText } from "../../utils/utils";

function getFlagDimensions({ compact, minimized, prominent }) {
  if (minimized) return { w: 14, h: 10, flagClass: " compact minimized-found" };
  if (compact) return { w: 16, h: 12, flagClass: " compact" };
  if (prominent) return { w: 56, h: 42, flagClass: " prominent" };
  return { w: 44, h: 33, flagClass: "" };
}

function buildGlobeLabelFlagHtml(
  iso2,
  { compact = false, minimized = false, prominent = false } = {}
) {
  if (!iso2 || iso2.length < 2) return "";
  const { w, h, flagClass } = getFlagDimensions({ compact, minimized, prominent });
  const scaleVar = prominent
    ? "var(--globe-flag-scale, 1.15)"
    : "var(--globe-flag-scale, var(--ui-scale, 1))";
  return `<img src="/flags/${iso2.toLowerCase()}.svg" alt="" class="globe-label-flag${flagClass}" width="${w}" height="${h}" style="width:calc(${w}px * ${scaleVar});height:calc(${h}px * ${scaleVar});object-fit:cover;border-radius:var(--radius-sm);border:1px solid color-mix(in srgb, var(--text-main) 22%, transparent);flex-shrink:0;display:block;" />`;
}

function getLabelTextDimensions({ isFoundMinimized, isRegionalTag }) {
  if (isFoundMinimized) {
    return {
      mainSize: "10.5px",
      subSize: "9.5px",
      mainHeight: "13px",
      subHeight: "11px",
    };
  }
  if (isRegionalTag) {
    return {
      mainSize: "14px",
      subSize: "12px",
      mainHeight: "17px",
      subHeight: "15px",
    };
  }
  return {
    mainSize: "13px",
    subSize: "11px",
    mainHeight: "15px",
    subHeight: "13px",
  };
}

function resolveLabelColor(d, { REGION_COLORS_LABELS, UI_COLORS, isHomeScreen }) {
  if (d.mode === "departments") {
    if (d.isFound) return UI_COLORS.success;
    if (d.isSelected) return UI_COLORS.accent;
    return UI_COLORS.textMuted;
  }
  if (isHomeScreen) {
    return d.isSelected ? UI_COLORS.accent : UI_COLORS.textMuted;
  }
  const isHighlight = d.isFound || d.isSelected;
  const colorType = UI_COLORS.labelColorType || "regional";
  if (colorType === "paper") {
    return isHighlight ? UI_COLORS.accent : UI_COLORS.textMuted;
  }
  return isHighlight ? REGION_COLORS_LABELS[d.region] || UI_COLORS.accent : UI_COLORS.textMuted;
}

/**
 * Scramble text dynamically with a ratio of random glyphs.
 */
function scrambleTextWithRatio(text, ratio) {
  if (!text) return "";
  // ASCII-only: every glyph exists in the label font, so no tofu boxes (□) while scrambling.
  const glyphs = "@#$%?*[]{}/=+_~^0123456789X";
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

function getLabelBackground({ isFoundMinimized, isRegionalTag, labelShadow, labelStalk }) {
  if (isFoundMinimized) {
    return `background: color-mix(in srgb, ${labelShadow} 72%, transparent); padding: 2px 5px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, ${labelStalk} 38%, transparent);`;
  }
  if (isRegionalTag) {
    return `background: color-mix(in srgb, ${labelShadow} 68%, transparent); padding: 3px 7px; border-radius: var(--radius-sm);`;
  }
  return "";
}

function renderGlitchLabel(
  el,
  { d, t, UI_COLORS, labelDot, labelStalk, labelText, labelShadow, flagHtml, labelRowLayout }
) {
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
        border-radius: 0;
        left: -3px;
        top: -3px;
        box-shadow: 0 0 0 1px color-mix(in srgb, ${labelShadow} 75%, transparent);
        opacity: 1;
      "></div>
      <!-- Stalk Line (Shortened to 15px) -->
      <div style="
        position: absolute;
        width: 1.2px;
        height: 15px;
        background: ${stalkColor};
        left: -0.6px;
        bottom: 3px;
        opacity: 0.85;
      "></div>
      <!-- Centered Minimalist Label directly above the stalk (placed at bottom: 21px) -->
      <div class="scramble-callout" style="
        position: absolute;
        left: 50%;
        bottom: 21px;
        transform: translateX(-50%);
        animation: labelReveal 0.22s var(--ease-out) forwards;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: var(--font-display, monospace) !important;
        white-space: nowrap;
        color: ${textColor};
        opacity: 1;
      ">
        <div style="font-weight: 700; font-size: calc(13px * var(--ui-scale, 1)); min-height: calc(15px * var(--ui-scale, 1)); line-height: calc(15px * var(--ui-scale, 1)); display: flex; align-items: center; justify-content: center; gap: 4px; font-family: var(--font-display, monospace) !important; ${flagHtml ? labelRowLayout : ""}">
          ${flagHtml || ""}
          <span class="${glitchLine1Class}" data-text="${glitchLine1Raw}" style="font-family: var(--font-display, monospace) !important;">${isErrorLabel ? glitchLine1Raw : scrambleText(glitchLine1Raw)}</span>
        </div>
        ${
          isCapitalsMode && !isErrorLabel
            ? `
          <div style="font-weight: 500; font-size: calc(11px * var(--ui-scale, 1)); height: calc(13px * var(--ui-scale, 1)); line-height: calc(13px * var(--ui-scale, 1)); color: color-mix(in srgb, ${UI_COLORS.textMuted} 80%, transparent); margin-top: 1px; font-family: var(--font-display, monospace) !important;">
            <span class="glitch-country" data-text="${d.country}" style="font-family: var(--font-display, monospace) !important;">${scrambleText(d.country)}</span>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;

  let hasBeenAttached = false;
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
      const raw = node.dataset.text || "";
      node.innerText = scrambleText(raw, Math.random());
    });
  }, 150);
}

function buildDeptLabelContent(scramble, ctx) {
  const { d, revealAll, color, UI_COLORS } = ctx;
  const rawCode = d.code
    ? `<span style="font-weight: 800; background: ${color}; color: ${UI_COLORS.textInverse}; padding: 1px 4px; border-radius: 3px; font-size: calc(12px * var(--ui-scale, 1)); line-height: 1.1; margin-right: 4px;">${d.code}</span>`
    : "";
  const name = scramble(revealAll ? d.country : "???");
  const cap = d.capital && revealAll ? ` (${scramble(d.capital)})` : "";
  return { line1: `${rawCode}<span>${name}${cap}</span>`, line2: null };
}

function buildUsStateLabelContent(scramble, ctx) {
  const { d, revealAll, color, UI_COLORS, flagHtml, labelRowLayout } = ctx;
  const rawCode = d.code
    ? `<span style="font-weight: 800; background: ${color}; color: ${UI_COLORS.textInverse}; padding: 1px 4px; border-radius: 3px; font-size: calc(12px * var(--ui-scale, 1)); line-height: 1.1; margin-right: 4px;">${d.code}</span>`
    : "";
  const name = scramble(revealAll ? d.country : "???");
  const cap = d.capital && revealAll ? ` (${scramble(d.capital)})` : "";
  const textSpan = `<span>${rawCode}${name}${cap}</span>`;
  const line1 = flagHtml
    ? `<div style="display:flex; ${labelRowLayout}">${flagHtml}${textSpan}</div>`
    : textSpan;
  return { line1, line2: null };
}

function buildDefaultLabelContent(scramble, ctx) {
  const { d, mode, revealAll, isFoundMinimized, flagHtml, labelRowLayout, itemData } = ctx;
  const isMtn = itemData?.type === "mountain_range" || itemData?.type === "mountain";
  let iconSymbol = "";
  if (d.mode === "rivers_mountains") iconSymbol = isMtn ? "🏔️ " : "💧 ";
  const isCapitals = d.mode === "capitals" || (mode === "learn" && d.learnShowCapitals);
  let baseText = isCapitals ? `${d.capital}` : `${d.country}`;
  if (revealAll && d.capital && !isCapitals && !isFoundMinimized) {
    baseText = `${d.country} (${d.capital})`;
  }
  const prefix = d.iso2 ? "" : `${iconSymbol || d.flag || ""}`;
  const textSpan = `<span>${prefix}${prefix ? " " : ""}${scramble(baseText)}</span>`;
  const line1 = flagHtml
    ? `<div style="display:flex; ${labelRowLayout}">${flagHtml}${textSpan}</div>`
    : textSpan;
  const line2 = isCapitals && !d.hideCountryLine && !isFoundMinimized ? scramble(d.country) : null;
  return { line1, line2 };
}

function getScrambledHtml(ratio, ctx) {
  const { isDeptMode, isUsStatesMode, UI_COLORS, dims, labelBg } = ctx;
  const scramble = (txt) => (ratio <= 0.0 ? txt : scrambleTextWithRatio(txt, ratio));

  let scrambled;
  if (isDeptMode) scrambled = buildDeptLabelContent(scramble, ctx);
  else if (isUsStatesMode) scrambled = buildUsStateLabelContent(scramble, ctx);
  else scrambled = buildDefaultLabelContent(scramble, ctx);

  const fontFamily = ratio > 0.0 ? "var(--font-display, monospace) !important" : "inherit";
  const subLineColor = isDeptMode
    ? `color-mix(in srgb, ${UI_COLORS.textMain} 96%, transparent)`
    : `color-mix(in srgb, ${UI_COLORS.textMain} 88%, transparent)`;
  const subLineMargin = isDeptMode ? "3px" : "2px";
  const subFontWeight = isDeptMode ? 600 : 500;
  const subLineHtml = scrambled.line2
    ? `<div style="font-weight: ${subFontWeight}; font-size: calc(${dims.subSize} * var(--ui-scale, 1)); min-height: calc(${dims.subHeight} * var(--ui-scale, 1)); line-height: calc(${dims.subHeight} * var(--ui-scale, 1)); color: ${subLineColor}; margin-top: ${subLineMargin}; font-family: ${fontFamily};">${scrambled.line2}</div>`
    : "";

  return `
    <div style="${labelBg} font-weight: 700; font-size: calc(${dims.mainSize} * var(--ui-scale, 1)); min-height: calc(${dims.mainHeight} * var(--ui-scale, 1)); line-height: calc(${dims.mainHeight} * var(--ui-scale, 1)); display: flex; align-items: center; justify-content: center; gap: 4px; font-family: ${fontFamily};">${scrambled.line1}</div>
    ${subLineHtml}
  `;
}

function renderRevealingLabel(el, ctx) {
  const { isFoundMinimized, labelDot, labelShadow, labelStalk, labelText } = ctx;
  const dotSize = isFoundMinimized ? "4px" : "6px";
  const dotOffset = isFoundMinimized ? "-2px" : "-3px";
  const stalkHeight = isFoundMinimized ? "7px" : "15px";
  const stalkBottom = isFoundMinimized ? "2px" : "3px";
  const stalkOpacity = isFoundMinimized ? "0.7" : "0.85";
  const containerBottom = isFoundMinimized ? "10px" : "21px";
  const containerClass = `normal-text-container${isFoundMinimized ? " minimized-found-pill" : ""}`;
  const containerOpacity = isFoundMinimized ? "0.88" : "1";

  el.innerHTML = `
    <div class="globe-label-element" style="position: relative; width: 0; height: 0; pointer-events: none;">
      <!-- Dot -->
      <div style="
        position: absolute;
        width: ${dotSize};
        height: ${dotSize};
        background: ${labelDot};
        border-radius: 0;
        left: ${dotOffset};
        top: ${dotOffset};
        box-shadow: 0 0 0 1px color-mix(in srgb, ${labelShadow} 75%, transparent);
        opacity: ${isFoundMinimized ? "0.85" : "1"};
      "></div>
      <!-- Stalk Line -->
      <div style="
        position: absolute;
        width: 1.2px;
        height: ${stalkHeight};
        background: ${labelStalk};
        left: -0.6px;
        bottom: ${stalkBottom};
        opacity: ${stalkOpacity};
      "></div>
      <!-- Centered Minimalist Label directly above the stalk -->
      <div class="${containerClass}" style="
        position: absolute;
        left: 50%;
        bottom: ${containerBottom};
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: var(--font-main);
        white-space: nowrap;
        color: ${labelText};
        opacity: ${containerOpacity};
      ">
        ${getScrambledHtml(1.0, ctx)}
      </div>
    </div>
  `;

  let scrambleProgress = 0.0;
  let hasBeenAttached = false;

  const mountInterval = setInterval(() => {
    if (typeof document === "undefined" || !document.body) {
      clearInterval(mountInterval);
      return;
    }
    const isAttached = document.body.contains(el);
    if (isAttached) {
      hasBeenAttached = true;
    }
    if (hasBeenAttached && !isAttached) {
      clearInterval(mountInterval);
      return;
    }

    scrambleProgress += 0.08;
    const textContainer = el.querySelector(".normal-text-container");
    if (!textContainer) return;

    if (scrambleProgress >= 1.0) {
      clearInterval(mountInterval);
      textContainer.innerHTML = getScrambledHtml(0.0, ctx);
      return;
    }

    textContainer.innerHTML = getScrambledHtml(1.0 - scrambleProgress, ctx);
  }, 30);
}

/**
 * Creates and configures a DOM element representing a label on the 3D globe.
 * Handles both the glitch/scrambling state and normal clean state, including
 * the lifecycle intervals for active text animation.
 */
export function createGlobeLabelElement(
  d,
  {
    REGION_COLORS_LABELS,
    UI_COLORS,
    isHomeScreen,
    isEndScreen,
    gameDataMap,
    mode,
    t,
    isPanelOpen = false,
  }
) {
  const el = document.createElement("div");
  const color = resolveLabelColor(d, { REGION_COLORS_LABELS, UI_COLORS, isHomeScreen });

  const labelText = UI_COLORS.globeLabelText || UI_COLORS.textMain;
  const labelDot = UI_COLORS.globeLabelDot || UI_COLORS.textMain;
  const labelStalk = UI_COLORS.globeLabelStalk || UI_COLORS.accent;
  const labelShadow = UI_COLORS.labelShadow || UI_COLORS.black;

  // Set root to 0 size so its center is the exact lat/lng
  el.style.width = "0";
  el.style.height = "0";
  el.style.position = "relative";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";

  const isPlayMode = mode !== "learn" && d.mode !== "learn" && !isHomeScreen && !isEndScreen;
  const revealAll = mode === "learn" || !isPlayMode || d.isFound;
  const isDeptMode = d.mode === "departments";
  const isUsStatesMode = d.mode === "us_states";
  const isFoundMinimized = isPlayMode && Boolean(d.isFound);
  const showLabelFlag = d.iso2 && d.mode !== "rivers_mountains";
  const flagProminent = showLabelFlag && isPlayMode && d.isSelected && !d.isFound && !isPanelOpen;
  const flagHtml = showLabelFlag
    ? buildGlobeLabelFlagHtml(d.iso2, {
        compact: isPanelOpen || isFoundMinimized,
        minimized: isFoundMinimized,
        prominent: flagProminent,
      })
    : "";
  const labelRowLayout =
    isPanelOpen || isFoundMinimized
      ? "flex-direction: row; align-items: center; gap: 4px;"
      : "flex-direction: column; align-items: center; gap: 3px;";

  const isGlitchMode = shouldScrambleLabel(d.mode, {
    isFound: d.isFound,
    isHomeScreen,
    isEndScreen,
    isSelected: d.isSelected,
    isLearn: mode === "learn",
  });

  if (isGlitchMode) {
    renderGlitchLabel(el, {
      d,
      t,
      UI_COLORS,
      labelDot,
      labelStalk,
      labelText,
      labelShadow,
      flagHtml,
      labelRowLayout,
    });
    return el;
  }

  const itemData =
    gameDataMap?.[d.admin] || countryDataMap[d.admin] || riversMountainsDataMap[d.admin];
  const isRegionalTag = isDeptMode || isUsStatesMode;
  const dims = getLabelTextDimensions({ isFoundMinimized, isRegionalTag });
  const labelBg = getLabelBackground({
    isFoundMinimized,
    isRegionalTag,
    labelShadow,
    labelStalk,
  });

  renderRevealingLabel(el, {
    d,
    mode,
    isDeptMode,
    isUsStatesMode,
    isPlayMode,
    revealAll,
    isFoundMinimized,
    flagHtml,
    labelRowLayout,
    UI_COLORS,
    labelDot,
    labelStalk,
    labelText,
    labelShadow,
    color,
    itemData,
    dims,
    labelBg,
  });

  return el;
}
