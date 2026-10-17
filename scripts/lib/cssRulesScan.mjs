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
  "hover-unguarded": r(
    ":hover selector outside @media (hover: hover) (sticky hover on touch devices)",
    "Wrap the rule in @media (hover: hover)."
  ),
  "breakpoint-offscale": r(
    "@media width breakpoint outside the scale of src/config/breakpoints.js",
    "Use a BREAKPOINT_SCALE value (max-width) or value + 1 (min-width)."
  ),
  "radius-large": r(
    "border-radius > 8px (> 0.5rem) not circular",
    "Rule 8: border-radius must be <= 8px."
  ),
};

import { BREAKPOINT_SCALE } from "../../src/config/breakpoints.js";

const SCALE_PX = new Set(Object.values(BREAKPOINT_SCALE));

const SERIF_RE =
  /(?:(?<!sans-)serif\b|ui-serif\b|\b(?:Georgia|Times\s+New\s+Roman|Times|Playfair|Merriweather|Garamond|Cambria|Palatino)\b)/i;

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

const DURATION_PROPS = new Set([
  "transition",
  "transition-duration",
  "animation",
  "animation-duration",
  "animation-delay",
  "transition-delay",
]);

const ALLOW_MARKER = "css-rules-allow:";

function allowCommentEnd(text, idx) {
  const lineStart = text.lastIndexOf("\n", idx) + 1;
  const prefix = text.slice(lineStart, idx);
  const isBlock = prefix.lastIndexOf("/*") > prefix.lastIndexOf("//");
  const end = text.indexOf(isBlock ? "*/" : "\n", idx);
  return end === -1 ? text.length : end;
}

function extractAllowComments(text) {
  const lineAllows = new Map();
  let idx = text.indexOf(ALLOW_MARKER);
  while (idx !== -1) {
    const end = allowCommentEnd(text, idx);
    const rawContent = text.slice(idx + ALLOW_MARKER.length, end);
    const rules = rawContent
      .split(/[—–]| - /)[0]
      .split(",")
      .map((rule) => rule.trim().toLowerCase())
      .filter(Boolean);
    const startLine = text.slice(0, idx).split("\n").length;
    const endLine = startLine + text.slice(idx, end).split("\n").length - 1;
    for (let l = startLine; l <= endLine; l += 1) {
      if (!lineAllows.has(l)) lineAllows.set(l, new Set());
      rules.forEach((rule) => lineAllows.get(l).add(rule));
    }
    idx = text.indexOf(ALLOW_MARKER, end);
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
  for (const c of str) {
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

function addDeclaration(scope, raw, startLine) {
  const colon = raw.indexOf(":");
  if (colon <= 0) return;
  const prop = raw.slice(0, colon).trim();
  const value = raw.slice(colon + 1).trim();
  if (prop && value)
    scope.declarations.push({ prop, value, line: startLine, selector: scope.header });
}

function resetBuffer(st) {
  st.buf = "";
  st.bufStart = st.line;
}

function closeBlock(st) {
  if (st.stack.length === 0) return resetBuffer(st);
  const scope = st.stack.at(-1);
  if (st.buf.trim()) addDeclaration(scope, st.buf.trim(), st.bufStart);
  st.stack.pop();
  if (scope.declarations.length > 0) st.rules.push(scope);
  return resetBuffer(st);
}

function endDeclaration(st) {
  if (st.stack.length > 0) addDeclaration(st.stack.at(-1), st.buf.trim(), st.bufStart);
  resetBuffer(st);
}

function openBlock(st) {
  st.stack.push({
    header: st.buf.trim(),
    declarations: [],
    ancestors: st.stack.map((s) => s.header),
  });
  resetBuffer(st);
}

function pushText(st, c) {
  if (st.buf.trim() === "" && !/\s/.test(c)) st.bufStart = st.line;
  st.buf += c;
}

function stepCss(st, c, prev) {
  if (st.inQ) {
    if (c === st.inQ && prev !== "\\") st.inQ = null;
  } else if (c === '"' || c === "'") st.inQ = c;
  else if (c === "(") st.pDepth += 1;
  else if (c === ")") st.pDepth = Math.max(0, st.pDepth - 1);
  else if (st.pDepth === 0 && c === "{") return openBlock(st);
  else if (st.pDepth === 0 && c === ";") return endDeclaration(st);
  else if (st.pDepth === 0 && c === "}") return closeBlock(st);
  else return pushText(st, c);
  st.buf += c;
}

function parseCssRules(cssText) {
  const st = { line: 1, buf: "", bufStart: 1, inQ: null, pDepth: 0, stack: [], rules: [] };
  for (let i = 0; i < cssText.length; i += 1) {
    if (cssText[i] === "\n") st.line += 1;
    stepCss(st, cssText[i], cssText[i - 1]);
  }
  return st.rules;
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
    const num = t.replace(/(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|%)$/i, "");
    if (num !== "" && Number.isFinite(Number(num))) lengths.push(Number(num));
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

function isCircularRadius(decl) {
  const val = decl.value;
  if (val.includes("var(--radius-full)")) return true;
  if (!isRadiusProp(decl.prop)) return false;
  if (/(?:^|[^\d])(?:50%|100%)(?:[^\d]|$)/.test(val) || /\b(9999px|999px)\b/i.test(val))
    return true;
  return [...val.matchAll(/\b(\d+(?:\.\d+)?)px\b/gi)].some((m) => Number.parseFloat(m[1]) >= 100);
}

function hasLargeRadius(value) {
  const clean = value.replaceAll(/var\([^)]*\)/g, "").replaceAll(/!\s*important/gi, "");
  const px = [...clean.matchAll(/\b(\d+(?:\.\d+)?)px\b/gi)].some(
    (m) => Number.parseFloat(m[1]) > 8
  );
  const rem = [...clean.matchAll(/\b(\d+(?:\.\d+)?)(?:rem|em)\b/gi)].some(
    (m) => Number.parseFloat(m[1]) * 16 > 8
  );
  return px || rem;
}

function checkRadiusDecl(decl, addViolation) {
  if (isCircularRadius(decl)) return addViolation("radius-circular", decl);
  if (isRadiusProp(decl.prop) && hasLargeRadius(decl.value)) addViolation("radius-large", decl);
}

function hasRawTime(value) {
  let val = value;
  while (/var\([^()]*\)/.test(val)) val = val.replaceAll(/var\([^()]*\)/g, " ");
  return val.split(/[\s,()]+/).some((token) => {
    const lower = token.toLowerCase();
    let num = "";
    if (lower.endsWith("ms")) num = lower.slice(0, -2);
    else if (lower.endsWith("s")) num = lower.slice(0, -1);
    return num !== "" && Number.isFinite(Number(num)) && Number(num) !== 0;
  });
}

function checkDuration(decl, addViolation) {
  if (DURATION_PROPS.has(decl.prop.toLowerCase()) && hasRawTime(decl.value)) {
    addViolation("duration-raw", decl);
  }
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
    if (matches.some((m) => Number.parseFloat(m[1]) > 4)) addViolation("blur-over-4px", decl);
  } else if (decl.prop.startsWith("--") && /blur/i.test(decl.prop)) {
    const compact = decl.value.replaceAll(/\s/g, "");
    const matches = [...compact.matchAll(/(\d+(?:\.\d+)?)px\b/gi)];
    if (matches.some((m) => Number.parseFloat(m[1]) > 4)) addViolation("blur-over-4px", decl);
  }
}

function checkBasicProps(decl, filePath, addViolation) {
  const prop = decl.prop.toLowerCase();
  const isIndexCss = filePath === "src/index.css" || filePath.endsWith("/src/index.css");
  if (!isIndexCss && HEX_RE.test(decl.value)) addViolation("hex-color", decl);
  if (/!\s*important\b/i.test(decl.value)) addViolation("important", decl);
  if (prop === "z-index") {
    const cleanZ = decl.value.replaceAll(/!\s*important/gi, "").trim();
    if (/^[+-]?\d+$/.test(cleanZ)) addViolation("z-index-raw", decl);
  }
  if (prop === "text-transform" && /\buppercase\b/i.test(decl.value)) {
    addViolation("uppercase", decl);
  }
  if (prop === "font-family" && SERIF_RE.test(decl.value)) addViolation("serif-font", decl);
}

function hasDvhTwin(decl, siblings) {
  return siblings.some(
    (sib) =>
      sib !== decl &&
      sib.prop.toLowerCase() === decl.prop.toLowerCase() &&
      /(?:dvh|svh|lvh)/i.test(sib.value)
  );
}

function checkCssDecl(decl, siblings, filePath, addViolation) {
  checkBasicProps(decl, filePath, addViolation);
  checkRadiusDecl(decl, addViolation);
  checkBlurCss(decl, addViolation);
  if (/\b100vh\b/.test(decl.value) && !hasDvhTwin(decl, siblings)) {
    addViolation("viewport-100vh", decl);
  }
  if (checkGlowShadow(decl)) addViolation("glow-shadow", decl);
  if (!decl.prop.startsWith("--") && decl.value.includes("cubic-bezier(")) {
    addViolation("cubic-bezier-raw", decl);
  }
  checkDuration(decl, addViolation);
  checkOutline(decl, addViolation);
}

function scanJsSource(filePath, text, allowMap) {
  const violations = [];
  const lines = text.split("\n");
  const isExempt = (r, l) => allowMap.get(l)?.has(r) || allowMap.get(l - 1)?.has(r);

  for (let i = 0; i < lines.length; i += 1) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const code = rawLine.replace(/\/\/[^\n]*/, "");

    const compact = code.replaceAll(/\s/g, "");
    const blurMatches = [...compact.matchAll(/blur\((\d+(?:\.\d+)?)px\)/gi)];
    const blurProp = [...compact.matchAll(/blur:["'`]?(\d+(?:\.\d+)?)px/gi)];
    if (
      blurMatches.some((m) => Number.parseFloat(m[1]) > 4) ||
      blurProp.some((m) => Number.parseFloat(m[1]) > 4)
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

  const allowMap = extractAllowComments(text);
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

  violations.push(...scanRuleContext(filePath, rules, allowMap));
  violations.push(...scanBreakpoints(filePath, cleanCss, allowMap));

  return violations.sort((a, b) => a.line - b.line);
}

/** Rule-level checks that need the selector and its enclosing at-rules. */
function scanRuleContext(filePath, rules, allowMap) {
  const out = [];
  for (const rule of rules) {
    if (rule.header.startsWith("@") || !rule.header.includes(":hover")) continue;
    if (rule.ancestors.some((a) => /\(\s*hover\s*:\s*hover\s*\)/i.test(a))) continue;
    const line = rule.declarations[0].line;
    if (
      allowMap.get(line)?.has("hover-unguarded") ||
      allowMap.get(line - 1)?.has("hover-unguarded")
    )
      continue;
    out.push({ rule: "hover-unguarded", file: filePath, line, excerpt: rule.header });
  }
  return out;
}

function isScaleBreakpoint(px) {
  return SCALE_PX.has(px) || SCALE_PX.has(px - 1);
}

/** Flags @media width queries (max/min-width) that are not on the breakpoint scale. */
function scanBreakpoints(filePath, cleanCss, allowMap) {
  const out = [];
  for (const m of cleanCss.matchAll(/@media([^{]*)\{/g)) {
    const line = cleanCss.slice(0, m.index).split("\n").length;
    if (
      allowMap.get(line)?.has("breakpoint-offscale") ||
      allowMap.get(line - 1)?.has("breakpoint-offscale")
    )
      continue;
    for (const w of m[1].matchAll(/\(\s*(?:max|min)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/gi)) {
      if (!isScaleBreakpoint(Number(w[1]))) {
        out.push({
          rule: "breakpoint-offscale",
          file: filePath,
          line,
          excerpt: `@media${m[1].trim()}`,
        });
      }
    }
  }
  return out;
}
