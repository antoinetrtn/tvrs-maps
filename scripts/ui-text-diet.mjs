// node scripts/ui-text-diet.mjs [--base-url http://127.0.0.1:5210] [--out docs/ui-text-diet] [--shots <dir>] [--label before|after] [--json-only]
// It expects a dev server already running at --base-url (default http://127.0.0.1:5210) started by the caller with env VITE_ENABLE_CONQUEST=true VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=mock-anon-key .

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const FAKE_USER_ID = "00000000-0000-4000-8000-000000000001";
const RIVAL_USER_ID = "00000000-0000-4000-8000-000000000002";
const FAKE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.mock_sig";
const FAKE_AUTH_SESSION = JSON.parse(
  `{"access_token":"${FAKE_JWT}","refresh_token":"r","token_type":"bearer","expires_in":3600,"expires_at":4102444800,"user":{"id":"${FAKE_USER_ID}","aud":"authenticated","role":"authenticated","is_anonymous":true,"app_metadata":{},"user_metadata":{}}}`
);
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];
const LANGUAGES = ["fr", "en"];
const CORS_HEADERS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const PANELS = {
  settings: [".settings-trigger-btn", ".sheet-panel.settings-panel.open"],
  profile: [".profile-trigger-btn", ".sheet-panel.profile-panel.open"],
  auth: [".profile-trigger-btn", ".sheet-panel.profile-panel.open"],
  leaderboard: [".home-podium-widget", ".sheet-panel.leaderboard-panel.open"],
};

const parseArgs = (argv) => {
  const a = { baseUrl: "http://127.0.0.1:5210", out: "docs/ui-text-diet", label: "before" };
  const split = (v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  for (let i = 2; i < argv.length; i++) {
    const [k, v] = [argv[i], argv[i + 1]];
    if (k === "--base-url") a.baseUrl = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--shots") a.shots = v && !v.startsWith("--") ? argv[++i] : "shots";
    else if (k === "--label") a.label = argv[++i];
    else if (k === "--json-only") a.jsonOnly = true;
    else if (k === "--only") a.only = split(argv[++i]);
    else if (k === "--viewports") a.viewports = split(argv[++i].toLowerCase());
    else if (k === "--langs") a.langs = split(argv[++i].toLowerCase());
  }
  return a;
};

const makeConquestFixture = (type) => {
  if (!type) return null;
  const iso = (ms) => new Date(Date.now() + ms).toISOString();
  const live = type === "live",
    end = type === "finished";
  const scores = { [FAKE_USER_ID]: 15, [RIVAL_USER_ID]: 8 };
  const elo = { [FAKE_USER_ID]: { delta: 18, after: 1218 } };
  const match = {
    id: "m1",
    code: "ABC123",
    host_id: FAKE_USER_ID,
    status: end ? "finished" : live ? "live" : "lobby",
    started_at: live ? iso(-60000) : end ? iso(-600000) : undefined,
    ends_at: live ? iso(540000) : end ? iso(-1000) : undefined,
    rules: { round_duration_sec: 600, countdown_sec: 10 },
  };
  if (end) match.result = { winner: FAKE_USER_ID, scores, elo };
  const p1 = { user_id: FAKE_USER_ID, display_name: "Explorer", color: "teal", ready: live || end };
  const p2 = { user_id: RIVAL_USER_ID, display_name: "Rival", color: "amber", ready: true };
  const players = type === "lobby-1p" ? [p1] : [p1, p2];
  const claims =
    live || end
      ? [
          {
            country_id: "FRA",
            owner_id: FAKE_USER_ID,
            user_id: FAKE_USER_ID,
            claimed_at: iso(-40000),
          },
        ]
      : [];
  if (live)
    claims.push({
      country_id: "DEU",
      owner_id: RIVAL_USER_ID,
      user_id: RIVAL_USER_ID,
      claimed_at: iso(-30000),
    });
  const events = live
    ? [{ id: 1, kind: "capture", actor_id: FAKE_USER_ID, country_id: "FRA" }]
    : [];
  return {
    version: end ? 20 : live ? 10 : 2,
    server_now: iso(0),
    match,
    players,
    claims,
    events,
    bonuses: [],
  };
};

const jsonResp = (route, status, data, extra = {}) =>
  route.fulfill({
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json", ...extra },
    body: JSON.stringify(data),
  });

const handleSupabaseRoute = async (route, req, url, state) => {
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
  const p = url.pathname;
  if (p.startsWith("/auth/v1/")) return jsonResp(route, 200, FAKE_AUTH_SESSION);
  if (p.startsWith("/rest/v1/rpc/")) {
    const rpc = p.replace("/rest/v1/rpc/", "").split("?")[0];
    let d = { ok: true };
    if (rpc === "conquest_create_match" || rpc === "conquest_join_match")
      d = state?.match || { id: "m1", code: "ABC123", host_id: FAKE_USER_ID, status: "lobby" };
    else if (rpc === "conquest_get_state")
      d = {
        ...(state || { version: 1, match: null, players: [], claims: [] }),
        server_now: new Date().toISOString(),
      };
    else if (rpc === "conquest_my_active_match") d = state?.match?.id ? state.match : null;
    else if (rpc === "conquest_leaderboard") d = { top: [], me: null };
    return jsonResp(route, 200, d);
  }
  if (p.startsWith("/rest/v1/")) {
    const s = (req.headers().accept || "").includes("application/vnd.pgrst.object+json");
    return jsonResp(
      route,
      200,
      s ? { id: FAKE_USER_ID, username: "Explorer", xp: 0, level: 1 } : [],
      s ? { "content-type": "application/vnd.pgrst.object+json" } : { "content-range": "0-0/0" }
    );
  }
  return route.fulfill({ status: 200, headers: CORS_HEADERS, body: "{}" });
};

const setupContextMocking = async (context, state) => {
  await context.routeWebSocket(/mock\.supabase\.co/, (ws) => ws.close());
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.hostname.includes("mock.supabase.co"))
      return handleSupabaseRoute(route, req, url, state.conquest);
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
    if (url.pathname.endsWith("/src/App.jsx")) {
      const resp = await route.fetch();
      const text = (await resp.text()).replace(
        'useState("fr")',
        'useState(() => localStorage.getItem("tvrs-lang") || "fr")'
      );
      return route.fulfill({ response: resp, body: text });
    }
    return route.continue();
  });
};

const browserInitScript = ({ lang, storedMatch, fakeAuthSession }) => {
  const s = localStorage;
  s.setItem("tvrs-guest-mode", "true");
  s.setItem("tvrs-lang", lang);
  s.setItem("tvrs-conquest-rules-seen", "1");
  if (storedMatch) {
    s.setItem("tvrs-conquest-match", JSON.stringify(storedMatch));
    s.setItem("sb-mock-auth-token", JSON.stringify(fakeAuthSession));
  } else {
    s.removeItem("tvrs-conquest-match");
    s.removeItem("sb-mock-auth-token");
  }
  const css =
    "* { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }";
  const el = Object.assign(document.createElement("style"), { textContent: css });
  (document.head || document.documentElement).appendChild(el);
};

const visHelper = (el) => {
  for (let c = el, op = 1.0; c && c !== document.documentElement; c = c.parentElement) {
    if (c.hidden || c.classList?.contains("sr-only")) return false;
    const s = getComputedStyle(c),
      o = parseFloat(s.opacity);
    if (s.display === "none" || s.visibility === "hidden" || s.clip === "rect(0px, 0px, 0px, 0px)")
      return false;
    if (!Number.isNaN(o) && (op *= o) < 0.05) return false;
  }
  return Boolean(el?.isConnected);
};

const inViewHelper = (r, el) => {
  if (!r || r.width <= 1 || r.height <= 1 || r.right <= 0 || r.bottom <= 0) return false;
  if (r.left >= window.innerWidth || r.top >= window.innerHeight) return false;
  const cx = Math.floor((Math.max(0, r.left) + Math.min(window.innerWidth, r.right)) / 2);
  const cy = Math.floor((Math.max(0, r.top) + Math.min(window.innerHeight, r.bottom)) / 2);
  const top = document.elementFromPoint(cx, cy);
  return Boolean(top && (top === el || el.contains(top) || top.contains(el)));
};

const collectBlocksHelper = (vis, inView) => {
  const blocks = [];
  const w = document.createTreeWalker(document.body, 4, {
    acceptNode: (n) => (/^(script|style|noscript|canvas)$/i.test(n.parentElement?.tagName) ? 2 : 1),
  });
  let node;
  while ((node = w.nextNode())) {
    const p = node.parentElement,
      t = (node.nodeValue || "").trim();
    if (!p || !t || !vis(p)) continue;
    let r = null;
    try {
      const range = document.createRange();
      range.selectNodeContents(node);
      r = range.getBoundingClientRect();
    } catch {}
    if ((!r || r.width <= 1) && p) r = p.getBoundingClientRect();
    if (inView(r, p)) blocks.push({ el: p, text: t });
  }
  document.querySelectorAll("input, textarea").forEach((inp) => {
    const v = (inp.value || "").trim() || (inp.placeholder || "").trim();
    if (v && vis(inp) && inView(inp.getBoundingClientRect(), inp))
      blocks.push({ el: inp, text: v });
  });
  return blocks;
};

const queryElementsHelper = (blocks, vis, inView, sel, isSent) => {
  const headings = new Set(["P", "LI", "LABEL", "H1", "H2", "H3", "H4", "H5", "H6"]);
  return Array.from(document.querySelectorAll(sel))
    .filter(
      (el) =>
        vis(el) &&
        inView(el.getBoundingClientRect(), el) &&
        !(isSent && el.tagName === "SPAN" && headings.has(el.parentElement?.tagName))
    )
    .map((el) => {
      const text = blocks
        .filter((i) => i.el === el || el.contains(i.el))
        .map((i) => i.text)
        .join(" ")
        .trim();
      const words = text.split(/\s+/).filter((t) => /[a-zA-Z\p{L}]/u.test(t)).length;
      return {
        tag: el.tagName.toLowerCase(),
        className: (el.className || "").trim(),
        text,
        words,
        flag: isSent ? true : words > 3,
      };
    })
    .filter((item) => (isSent ? item.words > 12 : true));
};

const aggregateBlocksHelper = (blocks, vis, inView, queryHelper) => {
  let words = 0,
    numbers = 0;
  const elMap = new Map();
  for (const b of blocks) {
    let bw = 0,
      bn = 0;
    for (const tok of b.text.split(/\s+/)) {
      if (/[a-zA-Z\p{L}]/u.test(tok)) bw++;
      else if (/\d/.test(tok)) bn++;
    }
    words += bw;
    numbers += bn;
    if (!elMap.has(b.el))
      elMap.set(b.el, {
        tag: b.el.tagName.toLowerCase(),
        cls: b.el.className || "",
        texts: [],
        words: 0,
        numbers: 0,
      });
    const e = elMap.get(b.el);
    e.texts.push(b.text);
    e.words += bw;
    e.numbers += bn;
  }
  const buttons = queryHelper(
    blocks,
    vis,
    inView,
    'button, [role="button"], a[class*="btn"]',
    false
  );
  const sentences = queryHelper(
    blocks,
    vis,
    inView,
    "p, span, li, label, h1, h2, h3, h4, h5, h6",
    true
  );
  const elements = Array.from(elMap.values()).map((e) => ({
    tag: e.tag,
    className: e.cls.trim(),
    text: e.texts.join(" "),
    words: e.words,
    numbers: e.numbers,
  }));
  const top15 = [...elements].sort((a, b) => b.words - a.words).slice(0, 15);
  return {
    words,
    numbers,
    elements: elements.slice(0, 40),
    buttons: buttons.slice(0, 40),
    sentences: sentences.slice(0, 40),
    longestBlocks: top15,
  };
};

export async function countVisibleWords(page) {
  const args = {
    vS: visHelper.toString(),
    iS: inViewHelper.toString(),
    cS: collectBlocksHelper.toString(),
    qS: queryElementsHelper.toString(),
    aS: aggregateBlocksHelper.toString(),
  };
  return await page.evaluate(({ vS, iS, cS, qS, aS }) => {
    const [vis, inView, c, q, a] = [vS, iS, cS, qS, aS].map((s) => eval(`(${s})`));
    return a(c(vis, inView), vis, inView, q);
  }, args);
}

const setupScreen = async (page, screen, baseUrl) => {
  await page.goto(baseUrl);
  const id = screen.id;
  if (id === "home-conquest") return page.waitForTimeout(1500);
  if (id === "home-countries" || id === "game-hud") {
    await page.locator(".deck-dots-row .deck-dot").nth(1).click();
    await page.locator('.deck-mode-card.is-top-card[data-mode="countries"]').waitFor();
    if (id === "game-hud") {
      await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
      await page.locator("#q-resp-field").waitFor();
    }
    return page.waitForTimeout(500);
  }
  if (PANELS[id]) {
    await page.locator(PANELS[id][0]).click();
    await page.locator(PANELS[id][1]).waitFor();
    if (id === "auth") {
      await page.locator(".profile-blur-btn").click();
      await page.locator(".dialog-panel").waitFor();
    }
    return page.waitForTimeout(400);
  }
  if (id === "conquest-entry" || id === "conquest-lobby") {
    await page.locator(".deck-mode-card.is-top-card .card-play-btn").click();
    await page.locator(".conquest-panel").waitFor();
    if (id === "conquest-lobby") {
      await page.locator(".conquest-panel .btn-primary").first().click();
      await page.locator(".conquest-ready-cta").waitFor();
    }
    return page.waitForTimeout(400);
  }
  const sel =
    id === "conquest-lobby-2p"
      ? ".conquest-ready-cta"
      : id === "conquest-hud"
        ? ".conquest-hud"
        : ".conquest-end";
  try {
    await page.locator(sel).waitFor({ timeout: 4000 });
  } catch {
    const play = page.locator(".deck-mode-card.is-top-card .card-play-btn");
    if (await play.isVisible()) await play.click();
    await page.locator(sel).waitFor();
  }
  return page.waitForTimeout(600);
};

const SCREENS =
  "home-conquest:01 home-countries:02 settings:03 profile:04 leaderboard:05 auth:06 conquest-entry:07 conquest-lobby:08:lobby-1p conquest-lobby-2p:09:lobby-2p game-hud:10 conquest-hud:11:live conquest-end:12:finished"
    .split(" ")
    .map((s) => {
      const [id, num, conquest] = s.split(":");
      return { id, num, conquest: conquest || null };
    });

const formatCandidates = (blocks) =>
  (blocks || [])
    .slice(0, 3)
    .map((b) => {
      const c = b.text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
      return `"${c.length > 60 ? `${c.slice(0, 57)}...` : c}" (${b.words} mots)`;
    })
    .join("<br>") || "-";

const generateMarkdownReport = (label, results) => {
  const rows = results.map((r) => {
    const st = r.unreachable ? "✘ (injoignable)" : r.words <= 12 ? "✔" : "✘";
    const cand = r.unreachable
      ? `✘ Injoignable: ${(r.error || "").slice(0, 60)}`
      : formatCandidates(r.longestBlocks);
    return `| ${r.id} | ${r.viewport} | ${r.lang} | ${r.words} | ${r.numbers} | ${r.buttonsExceeding} | ${r.sentencesExceeding} | ${st} | ${cand} |`;
  });
  const v = results.filter((r) => !r.unreachable);
  const avg = v.length ? (v.reduce((s, r) => s + r.words, 0) / v.length).toFixed(1) : "0";
  const pass = (vp) =>
    results.filter((r) => r.viewport === vp && r.words <= 12 && !r.unreachable).length;
  const tot = (vp) => results.filter((r) => r.viewport === vp).length;
  const details = results
    .map((r) => {
      const b = (r.longestBlocks || [])
        .slice(0, 15)
        .map(
          (x, i) =>
            `${i + 1}. [${x.words} mots] \`${x.tag}${x.className ? `.${x.className}` : ""}\`: "${x.text}"`
        )
        .join("\n");
      return `### ${r.number} ${r.id} (${r.viewport}, ${r.lang}) — ${r.words} mots visibles, ${r.numbers} nombres\n${b || "*(aucun texte visible)*"}`;
    })
    .join("\n\n");
  const hdr =
    "| Écran | Viewport | Langue | Mots visibles | Nombres | Boutons > 3 mots | Phrases > 12 mots | Budget ≤ 12 | Candidats à remplacer |\n| :--- | :--- | :---: | ---: | ---: | ---: | ---: | :---: | :--- |";
  return `# Rapport UI Text Diet — ${label}\n\n${hdr}\n${rows.join("\n")}\n\n## Synthèse globale\n- **Moyenne de mots par écran** : ${avg}\n- **Écrans dans le budget (mobile)** : ${pass("mobile")} / ${tot("mobile")}\n- **Écrans dans le budget (desktop)** : ${pass("desktop")} / ${tot("desktop")}\n\n## Candidates à remplacer par un picto (15 blocs les plus longs)\n\n${details}\n`;
};

const printConsoleSummary = (label, results) => {
  console.log(`\n=== Rapport UI Text Diet (${label}) ===`);
  console.table(
    results.map((r) => {
      const e = r.unreachable;
      return {
        Écran: r.id,
        Viewport: r.viewport,
        Lang: r.lang,
        Mots: e ? "ERR" : r.words,
        Nb: e ? "ERR" : r.numbers,
        "Btn>3": r.buttonsExceeding,
        "Phr>12": r.sentencesExceeding,
        Budget: e ? "ERR" : r.words <= 12 ? "✔" : "✘",
      };
    })
  );
  const v = results.filter((r) => !r.unreachable);
  const avg = v.length ? (v.reduce((s, r) => s + r.words, 0) / v.length).toFixed(1) : "0";
  const p = (n) =>
    results.filter((r) => r.viewport === n && r.words <= 12 && !r.unreachable).length;
  const t = (n) => results.filter((r) => r.viewport === n).length;
  console.log(
    `Summary: Avg words/screen: ${avg} | Budget <= 12: mobile ${p("mobile")}/${t("mobile")}, desktop ${p("desktop")}/${t("desktop")}\n`
  );
};

const measureScreenRun = async (context, sc, vp, lang, cfg, state) => {
  state.conquest = makeConquestFixture(sc.conquest);
  const storedMatch =
    sc.conquest && sc.conquest !== "lobby-1p" ? { id: "m1", code: "ABC123" } : null;
  const page = await context.newPage();
  await page.addInitScript(browserInitScript, {
    lang,
    storedMatch,
    fakeAuthSession: FAKE_AUTH_SESSION,
  });
  page.setDefaultTimeout(8000);
  let res = { words: 0, numbers: 0, elements: [], buttons: [], sentences: [], longestBlocks: [] },
    unreachable = false,
    error = null;
  try {
    await setupScreen(page, sc, cfg.baseUrl);
    res = await countVisibleWords(page);
    if (cfg.shots && lang === "fr") {
      fs.mkdirSync(cfg.shots, { recursive: true });
      await page.screenshot({
        path: path.join(cfg.shots, `${cfg.label}-${vp.name}-${sc.num}-${sc.id}.png`),
      });
    }
  } catch (err) {
    unreachable = true;
    const raw = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    error = `${err.message || String(err)}${raw ? ` | body: ${raw.slice(0, 300).replace(/\s+/g, " ")}` : ""}`;
  }
  await page.close();
  const bEx = res.buttons.filter((b) => b.words > 3).length;
  const sEx = res.sentences.filter((s) => s.words > 12).length;
  return Object.assign(
    { id: sc.id, number: sc.num, viewport: vp.name, lang, unreachable, error },
    res,
    { buttonsExceeding: bEx, sentencesExceeding: sEx }
  );
};

const runMeasurementLoop = async (browser, cfg, state) => {
  const results = [];
  const vps = cfg.viewports ? VIEWPORTS.filter((v) => cfg.viewports.includes(v.name)) : VIEWPORTS;
  const langs = cfg.langs ? LANGUAGES.filter((l) => cfg.langs.includes(l)) : LANGUAGES;
  const screens = cfg.only ? SCREENS.filter((s) => cfg.only.includes(s.id)) : SCREENS;
  for (const vp of vps) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: "reduce",
    });
    await setupContextMocking(context, state);
    for (const sc of screens) {
      for (const lang of langs) {
        results.push(await measureScreenRun(context, sc, vp, lang, cfg, state));
      }
    }
    await context.close();
  }
  return results;
};

const main = async () => {
  const cfg = parseArgs(process.argv);
  const state = { conquest: null },
    browser = await chromium.launch({ headless: true });
  try {
    const results = await runMeasurementLoop(browser, cfg, state);
    fs.mkdirSync(cfg.out, { recursive: true });
    fs.writeFileSync(
      path.join(cfg.out, `report-${cfg.label}.json`),
      JSON.stringify(results, null, 2),
      "utf8"
    );
    if (!cfg.jsonOnly)
      fs.writeFileSync(
        path.join(cfg.out, `report-${cfg.label}.md`),
        generateMarkdownReport(cfg.label, results),
        "utf8"
      );
    printConsoleSummary(cfg.label, results);
  } finally {
    await browser.close();
  }
};

if (process.argv[1]?.endsWith("ui-text-diet.mjs")) {
  main().catch((err) => {
    console.error("Erreur d'exécution ui-text-diet:", err);
    process.exit(0);
  });
}
