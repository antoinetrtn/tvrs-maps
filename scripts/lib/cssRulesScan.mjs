/**
 * cssRulesScan.mjs — pure scanner for TVRS Maps CSS & JS design guardrails.
 */

const r = (description, hint) => ({ description, hint });

export const RULES = {
  "hex-color": r(
    "Hex color literal in CSS declaration value (outside src/index.css)",
    "Use tokens."
  ),
  important: r("!important in CSS declaration", "Avoid !important; adjust specificity instead."),
  "z-index-raw": r("z-index with bare integer value", "Use z-index token (var(--z-...)) instead."),
  uppercase: r("text-transform: uppercase is forbidden", "AGENTS.md rule 5: use natural casing."),
  "radius-circular": r(
    "Circular/pill border-radius (50%, 100%, >=100px, var(--radius-full))",
    "Rule 8: <= 8px."
  ),
  "blur-over-4px": r(
    "Blur radius > 4px in filter/backdrop-filter, custom prop, or JS",
    "Limit blur to <= 4px."
  ),
  "viewport-100vh": r(
    "100vh used without sibling dvh/svh/lvh fallback",
    "Add 100dvh twin right after."
  ),
  "glow-shadow": r(
    "box-shadow/text-shadow/drop-shadow with non-zero blur",
    "Use 0 blur pixel shadows or tokens."
  ),
  "cubic-bezier-raw": r(
    "cubic-bezier() used outside custom property token definitions",
    "Use ease tokens."
  ),
  "duration-raw": r("Raw transition/animation time literal outside var()", "Use duration tokens."),
  "outline-none": r("outline: none/0 without :focus-visible in selector", "Keep focus indicators."),
  "serif-font": r("Serif font family specified in CSS or JS", "Use sans-serif or monospace fonts."),
  "radius-large": r(
    "border-radius > 8px (> 0.5rem) not circular",
    "Rule 8: border-radius must be <= 8px."
  ),
};

const SERIF_RE =
  /(?:(?<!sans-)serif\b|ui-serif\b|\b(?:Georgia|Times\s+New\s+Roman|Times|Playfair|Merriweather|Garamond|Cambria|Palatino)\b)/i;

const DURATION_PROPS = new Set([
  "transition",
  "transition-duration",
  "animation",
  "animation-duration",
  "animation-delay",
  "transition-delay",
]);

function extractAllowComments(text, isCss) {
  const lineAllows = new Map();
  const pattern = isCss
    ? /\/\*\s*css-rules-allow:\s*([^\*]+?)\*\//gi
    : /(?:\/\/\s*css-rules-allow:\s*([^\n]+)|\/\*\s*css-rules-allow:\s*([^\*]+)\*\/)/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const rawContent = match[1] || match[2] || "";
    const rulePart = rawContent.split(/\s+[-—–]\s+|—|–/)[0] || "";
    const rules = rulePart
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
    const startLine = text.slice(0, match.index).split("\n").length;
    const lineCount = (match[0].match(/\n/g) || []).length;
    for (let l = startLine; l <= startLine + lineCount; l += 1) {
      if (!lineAllows.has(l)) lineAllows.set(l, new Set());
      rules.forEach((r) => lineAllows.get(l).add(r));
    }
  }
  return lineAllows;
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function splitTopLevelCommas(str) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < str.length; i += 1) {
    const c = str[i];
    if (c === "(") depth += 1;
    else if (c === ")" && depth > 0) depth -= 1;
    else if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parseCssRules(cssText) {
  let line = 1,
    buf = "",
    bufStart = 1,
    inQ = null,
    pDepth = 0;
  const stack = [],
    rules = [];

  const addDecl = (scope, raw, startLine) => {
    const colon = raw.indexOf(":");
    if (colon <= 0) return;
    const prop = raw.slice(0, colon).trim();
    const value = raw.slice(colon + 1).trim();
    if (prop && value)
      scope.declarations.push({
        prop,
        value,
        line: startLine,
        selector: scope.header,
      });
  };

  for (let i = 0; i < cssText.length; i += 1) {
    const c = cssText[i];
    if (c === "\n") line += 1;
    if (inQ) {
      if (c === inQ && cssText[i - 1] !== "\\") inQ = null;
      buf += c;
    } else if (c === '"' || c === "'") {
      inQ = c;
      buf += c;
    } else if (c === "(") {
      pDepth += 1;
      buf += c;
    } else if (c === ")") {
      if (pDepth > 0) pDepth -= 1;
      buf += c;
    } else if (c === "{" && pDepth === 0) {
      stack.push({ header: buf.trim(), declarations: [] });
      buf = "";
      bufStart = line;
    } else if (c === ";" && pDepth === 0) {
      if (stack.length > 0) addDecl(stack[stack.length - 1], buf.trim(), bufStart);
      buf = "";
      bufStart = line;
    } else if (c === "}" && pDepth === 0) {
      if (stack.length > 0) {
        if (buf.trim()) addDecl(stack[stack.length - 1], buf.trim(), bufStart);
        const finished = stack.pop();
        if (finished.declarations.length > 0) rules.push(finished);
      }
      buf = "";
      bufStart = line;
    } else {
      if (buf.trim() === "" && c !== " " && c !== "\t" && c !== "\r" && c !== "\n") bufStart = line;
      buf += c;
    }
  }
  return rules;
}

function isRadiusProp(prop) {
  const p = prop.toLowerCase();
  return p === "border-radius" || (p.startsWith("border-") && p.endsWith("-radius"));
}

function isGlowLayer(layer) {
  const trimmed = layer.trim();
  if (!trimmed || /^var\(--[a-zA-Z0-9_-]+\)$/.test(trimmed)) return false;
  let clean = trimmed
    .replace(/\binset\b/gi, "")
    .replace(/\b(?:rgba?|hsla?|color-mix)\([^)]*\)/gi, "")
    .replace(/#(?:[0-9a-fA-F]{3,8})\b/g, "")
    .replace(
      /\b(transparent|currentColor|inherit|initial|revert|black|white|red|green|blue|gray|grey)\b/gi,
      ""
    );

  const tokens = clean.trim().split(/\s+/).filter(Boolean);
  const lengths = [];
  for (const t of tokens) {
    if (t.startsWith("var(")) {
      if (lengths.length === 2) return false;
      continue;
    }
    const match = /^([+-]?(?:\d*\.?\d+))(px|rem|em|ex|ch|vw|vh|vmin|vmax|%)?$/i.exec(t);
    if (match) lengths.push(parseFloat(match[1]));
  }
  return lengths.length >= 3 && lengths[2] !== 0;
}

function checkGlowShadow(decl) {
  const p = decl.prop.toLowerCase();
  const v = decl.value.trim().toLowerCase();
  if (v === "none" || /^var\(--[a-zA-Z0-9_-]+\)$/.test(v)) return false;
  if (p === "box-shadow" || p === "text-shadow") {
    return splitTopLevelCommas(decl.value).some((l) => isGlowLayer(l));
  }
  if (decl.value.includes("drop-shadow(")) {
    const dropMatches = [...decl.value.matchAll(/drop-shadow\(([^)]+)\)/gi)];
    return dropMatches.some((m) => isGlowLayer(m[1]));
  }
  return false;
}

function checkRadiusDecl(decl, addViolation) {
  const val = decl.value;
  let circular = val.includes("var(--radius-full)");
  if (!circular && isRadiusProp(decl.prop)) {
    if (/(?:^|[^\d])(?:50%|100%)(?:[^\d]|$)/.test(val) || /\b(9999px|999px)\b/i.test(val)) {
      circular = true;
    } else {
      const pxMatches = [...val.matchAll(/\b(\d+(?:\.\d+)?)px\b/gi)];
      circular = pxMatches.some((m) => parseFloat(m[1]) >= 100);
    }
  }
  if (circular) return void addViolation("radius-circular", decl);

  if (isRadiusProp(decl.prop)) {
    const clean = val.replace(/var\([^)]*\)/g, "").replace(/!\s*important/gi, "");
    let hasLarge = false;
    for (const m of clean.matchAll(/\b(\d+(?:\.\d+)?)px\b/gi)) {
      if (parseFloat(m[1]) > 8) hasLarge = true;
    }
    for (const m of clean.matchAll(/\b(\d+(?:\.\d+)?)(rem|em)\b/gi)) {
      if (parseFloat(m[1]) * 16 > 8) hasLarge = true;
    }
    if (hasLarge) addViolation("radius-large", decl);
  }
}

function checkDuration(decl, addViolation) {
  if (!DURATION_PROPS.has(decl.prop.toLowerCase())) return;
  let val = decl.value;
  while (/var\([^()]*\)/.test(val)) val = val.replace(/var\([^()]*\)/g, "");
  const timeMatches = [...val.matchAll(/(?:^|[^a-zA-Z0-9_.-])(\d*\.?\d+)(s|ms)\b/gi)];
  if (timeMatches.some((m) => parseFloat(m[1]) !== 0)) addViolation("duration-raw", decl);
}

function checkOutline(decl, addViolation) {
  const p = decl.prop.toLowerCase();
  const v = decl.value
    .replace(/!\s*important/gi, "")
    .trim()
    .toLowerCase();
  const isOutlineNone =
    (p === "outline" && (v === "none" || v === "0" || v === "0px")) ||
    (p === "outline-style" && v === "none");
  if (!isOutlineNone) return;
  const sel = decl.selector || "";
  const ok =
    sel.includes(":focus-visible") ||
    sel.includes(":focus-within") ||
    sel.includes(":focus:not(:focus-visible)");
  if (!ok) addViolation("outline-none", decl);
}

function checkBlurCss(decl, addViolation) {
  const p = decl.prop.toLowerCase();
  if (["filter", "backdrop-filter", "-webkit-backdrop-filter"].includes(p)) {
    const matches = [...decl.value.matchAll(/blur\(\s*(\d+(?:\.\d+)?)\s*px\s*\)/gi)];
    if (matches.some((m) => parseFloat(m[1]) > 4)) addViolation("blur-over-4px", decl);
  } else if (decl.prop.startsWith("--") && /blur/i.test(decl.prop)) {
    const matches = [...decl.value.matchAll(/(\d+(?:\.\d+)?)\s*px\b/gi)];
    if (matches.some((m) => parseFloat(m[1]) > 4)) addViolation("blur-over-4px", decl);
  }
}

function checkCssDecl(decl, siblings, filePath, addViolation) {
  if (filePath !== "src/index.css" && !filePath.endsWith("/src/index.css")) {
    if (/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/.test(decl.value)) {
      addViolation("hex-color", decl);
    }
  }
  if (/!\s*important\b/i.test(decl.value)) addViolation("important", decl);

  if (decl.prop.toLowerCase() === "z-index") {
    const cleanZ = decl.value.replace(/!\s*important/gi, "").trim();
    if (/^[+-]?\d+$/.test(cleanZ)) addViolation("z-index-raw", decl);
  }
  if (decl.prop.toLowerCase() === "text-transform" && /\buppercase\b/i.test(decl.value)) {
    addViolation("uppercase", decl);
  }
  checkRadiusDecl(decl, addViolation);
  checkBlurCss(decl, addViolation);

  if (/\b100vh\b/.test(decl.value)) {
    const hasTwin = siblings.some(
      (sib) =>
        sib !== decl &&
        sib.prop.toLowerCase() === decl.prop.toLowerCase() &&
        /(?:dvh|svh|lvh)/i.test(sib.value)
    );
    if (!hasTwin) addViolation("viewport-100vh", decl);
  }

  if (checkGlowShadow(decl)) addViolation("glow-shadow", decl);
  if (!decl.prop.startsWith("--") && decl.value.includes("cubic-bezier(")) {
    addViolation("cubic-bezier-raw", decl);
  }
  checkDuration(decl, addViolation);
  checkOutline(decl, addViolation);
  if (decl.prop.toLowerCase() === "font-family" && SERIF_RE.test(decl.value)) {
    addViolation("serif-font", decl);
  }
}

function scanJsSource(filePath, text, allowMap) {
  const violations = [];
  const lines = text.split("\n");
  const isExempt = (r, l) => allowMap.get(l)?.has(r) || allowMap.get(l - 1)?.has(r);

  for (let i = 0; i < lines.length; i += 1) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const code = rawLine.replace(/\/\/[^\n]*/, "");

    const blurMatches = [...code.matchAll(/blur\(\s*(\d+(?:\.\d+)?)\s*px\s*\)/gi)];
    const blurProp = [...code.matchAll(/blur\s*:\s*["'`]?\s*(\d+(?:\.\d+)?)\s*px/gi)];
    if (
      blurMatches.some((m) => parseFloat(m[1]) > 4) ||
      blurProp.some((m) => parseFloat(m[1]) > 4)
    ) {
      if (!isExempt("blur-over-4px", lineNum)) {
        violations.push({
          rule: "blur-over-4px",
          file: filePath,
          line: lineNum,
          excerpt: rawLine.trim(),
        });
      }
    }

    const fontMatches = [
      ...code.matchAll(/(?:fontFamily|font-family)\s*:\s*["'`]([^"'`]+)["'`]/gi),
    ];
    if (fontMatches.some((m) => SERIF_RE.test(m[1])) && !isExempt("serif-font", lineNum)) {
      violations.push({
        rule: "serif-font",
        file: filePath,
        line: lineNum,
        excerpt: rawLine.trim(),
      });
    }
  }
  return violations;
}

export function scanSource(filePath, text) {
  const isCss = filePath.endsWith(".css");
  const isJs = filePath.endsWith(".js") || filePath.endsWith(".jsx");
  if (!isCss && !isJs) return [];

  const allowMap = extractAllowComments(text, isCss);
  if (isJs) return scanJsSource(filePath, text, allowMap);

  const cleanCss = stripCssComments(text);
  const rules = parseCssRules(cleanCss);
  const violations = [];

  for (const rule of rules) {
    for (const decl of rule.declarations) {
      const isExempt = (ruleId) =>
        allowMap.get(decl.line)?.has(ruleId) || allowMap.get(decl.line - 1)?.has(ruleId);

      const addViolation = (ruleId, d) => {
        if (!isExempt(ruleId)) {
          violations.push({
            rule: ruleId,
            file: filePath,
            line: d.line,
            excerpt: `${d.prop}: ${d.value}`,
          });
        }
      };

      checkCssDecl(decl, rule.declarations, filePath, addViolation);
    }
  }

  return violations.sort((a, b) => a.line - b.line);
}
