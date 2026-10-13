/**
 * Type audit: every heading measured against the text it heads.
 *
 * The recurring sizing complaints were never about a size being below a
 * floor. They were about hierarchy: a heading that is no bigger than the
 * text under it does not read as a heading. Checking each size against a
 * type scale misses that, so this checks the relationship instead.
 *
 * It drives the real app in headless Chrome, walks the brief, the plan and
 * the saved pages, and for each rule compares two computed font sizes.
 * Rules are written as the owner asked for them, e.g. "the Step 2
 * condition headings are bigger than their options".
 *
 *   node scripts/type-audit.mjs [base-url] --dump   list every text element
 *   node scripts/type-audit.mjs [base-url]          check the rules
 *
 * Exit code 1 when any rule fails.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

const BASE = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "http://localhost:3000";
const DUMP = process.argv.includes("--dump");
const CAPS = process.argv.includes("--caps");
/** Measured at run time: how wide the hand sets relative to the text face. */
let HAND_WIDTH = 1;
const PORT = 9991;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = {
  biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "clay",
  wind: "none", viewingEdge: "west", sun: "part", water: "moist",
  bedWidthM: 6, bedLengthM: 3, style: "fynbos",
  colour: { mode: "scheme", scheme: "warm" }, extras: ["pollinators"],
};

/** Lists visible text-bearing elements with their computed size. */
const DUMP_JS = `(() => {
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("main *, header *, footer *")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (own.length < 2) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    const fam = cs.fontFamily.includes("Silly Goose") ? "hand" : "text";
    const cls = (typeof el.className === "string" ? el.className : "").split(" ").filter(Boolean)[0] || "";
    const key = el.tagName.toLowerCase() + (cls ? "." + cls : "") + "|" + own.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parseFloat(cs.fontSize).toFixed(1).padStart(5) + "px " + fam.padEnd(4) + " " +
      (el.tagName.toLowerCase() + (cls ? "." + cls : "")).padEnd(34) + " " + own.slice(0, 50));
  }
  return out;
})()`;

/** How tall each face actually draws per 100 px of font-size. A
 * handwriting face has a short x-height, so equal pixel sizes do not look
 * equal - which is why every pixel check passed headings that looked no
 * bigger than their text. */
const CAP_JS = `(async () => {
  await document.fonts.ready;
  const ctx = document.createElement("canvas").getContext("2d");
  const hand = getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim();
  const text = getComputedStyle(document.body).fontFamily;
  const out = {};
  for (const [name, family] of [["hand", hand], ["text", text]]) {
    ctx.font = "100px " + family;
    out[name] = {
      family: family.slice(0, 48),
      cap: +ctx.measureText("H").actualBoundingBoxAscent.toFixed(1),
      x: +ctx.measureText("x").actualBoundingBoxAscent.toFixed(1),
      // How wide the same words set, per 100 px: a narrow face reads smaller.
      width: +ctx.measureText("Sunlight Water Soil Option").width.toFixed(0),
    };
    // Ink coverage: how much of an "H" box is dark, i.e. stroke weight.
    const c2 = document.createElement("canvas");
    c2.width = 200; c2.height = 200;
    const g = c2.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 200, 200);
    g.fillStyle = "#000"; g.font = "120px " + family; g.textBaseline = "alphabetic";
    g.fillText("Hamburg", 4, 150);
    const px = g.getImageData(0, 0, 200, 200).data;
    let dark = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark += 1;
    out[name].ink = dark;
  }
  return out;
})()`;

/** An input's placeholder size: the ::placeholder pseudo-element can be
 * sized apart from the input itself. */
const PLACEHOLDER_JS = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const cs = getComputedStyle(el, "::placeholder");
  return { px: parseFloat(cs.fontSize), hand: cs.fontFamily.includes("Silly Goose") };
})()`;

/** Font size in px of the first visible element matching a selector,
 * optionally filtered by its own text. */
const SIZE_JS = (selector, text) => `(() => {
  const want = ${JSON.stringify(text ?? null)};
  for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (want && !el.textContent.trim().toLowerCase().includes(want.toLowerCase())) continue;
    const cs = getComputedStyle(el);
    return { px: parseFloat(cs.fontSize), hand: cs.fontFamily.includes("Silly Goose") };
  }
  return null;
})()`;

// ---------------------------------------------------------------- rules
// "gt": the heading must be at least 1.15x the body (reads as a heading).
// "eq": the two must match within half a pixel.
// "lt": the first must be smaller.
const RULES = {
  "step-1": [
    { name: "'Town or suburb' is a heading over its box", a: [".place-combobox label > span", "Town or suburb"], b: [".finder-step > p, .finder-lead, main p", "type your town"], rule: "gt" },
    { name: "the example text matches 'Type your town or suburb, or click the map'", a: [".place-combobox input", null], b: ["main p", "type your town"], rule: "eq", placeholder: true },
  ],
  "step-2": [
    { name: "'Sunlight' is bigger than its options", a: [".site-conditions legend", "Sun"], b: [".choice-button strong", null], rule: "gt" },
    { name: "'Wind exposure' is bigger than its options", a: [".site-conditions legend", "Wind"], b: [".choice-button strong", null], rule: "gt" },
  ],
  "step-3": [
    { name: "'Your bed, from above' is a heading", a: [".bed-preview figcaption", null], b: [".field-help", null], rule: "gt" },
    { name: "'Set your bed size' is a heading over its help", a: [".bed-controls h3", "bed size"], b: [".field-help", null], rule: "gt" },
    { name: "'Choose your orientation' is a heading over its help", a: [".bed-controls h3", "orientation"], b: [".field-help", null], rule: "gt" },
  ],
  "step-4": [
    { name: "'Garden style' is bigger than its options", a: [".choice-stack legend", "style"], b: [".choice-button strong", null], rule: "gt" },
    { name: "'Colour palette' is bigger than its options", a: [".choice-stack legend", "colour"], b: [".choice-button strong", null], rule: "gt" },
    { name: "'Or pick exact colours' matches the colour option text", a: [".colour-custom summary", null], b: [".choice-button strong", null], rule: "eq" },
  ],
  "step-5": [
    { name: "'Build my plan' is at least the size of the text", a: [".finder-footer .button", null], b: [".choice-button strong", null], rule: "gte" },
    { name: "'Previous' is at least the size of the text", a: [".finder-footer .text-link", null], b: [".choice-button strong", null], rule: "gte" },
  ],
  plan: [
    { name: "'Option 1' is far bigger than the text inside its tab", a: [".variant-tab strong", null], b: [".variant-tab em", null], rule: "gt" },
    { name: "'Where to buy' matches the plan title", a: [".sourcing-panel h3", "Where to buy"], b: [".collection-intro h1", null], rule: "eq" },
    { name: "'Bed budget' matches the plan title", a: [".sourcing-budget-title", null], b: [".collection-intro h1", null], rule: "eq" },
    { name: "'Save this layout' matches the plan title", a: [".plan-actions .button", null], b: [".collection-intro h1", null], rule: "eq" },
    { name: "'Regenerate' matches the plan title", a: [".plan-actions .text-link", null], b: [".collection-intro h1", null], rule: "eq" },
    { name: "'Why these plants' heading is clearly bigger than its text", a: [".plan-why h3", null], b: [".plan-why p", null], rule: "gt" },
    { name: "'Care' heading is clearly bigger than its text", a: [".plan-care h3", null], b: [".plan-care p", null], rule: "gt" },
    { name: "'Why these plants' text matches the dashed-edge note", a: [".plan-why p", null], b: [".plan-caveat", null], rule: "eq" },
    { name: "'View notes' is smaller than its heading", a: [".plan-assumptions summary span", null], b: [".plan-assumptions summary", null], rule: "lt" },
  ],
};

async function main() {
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu", "--hide-scrollbars",
    "--no-first-run", `--user-data-dir=${join(process.env.TEMP ?? ".", "sg-type-audit")}`, "about:blank",
  ], { stdio: "ignore" });
  let failures = 0;
  try {
    for (let i = 0; i < 40; i += 1) {
      try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(500); }
    }
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: "PUT" })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0;
    const pend = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); const p = pend.get(m.id); if (p) { pend.delete(m.id); p(m.result ?? m.error); } });
    const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
    const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.value;

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try{localStorage.setItem("garden_tool_v1",JSON.stringify({version:1,savedPlantIds:[],excludedPlantIds:[],brief:${JSON.stringify(SEED)},savedLayouts:[]}))}catch(e){}`,
    });
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: BASE });
    await sleep(6000);
    const faces = await ev(CAP_JS);
    HAND_WIDTH = faces.hand.width / faces.text.width;
    if (!DUMP && !CAPS) console.log(`Hand face is ${(HAND_WIDTH * 100).toFixed(0)}% of the text face's width; hand sizes are scaled by that.
`);
    if (CAPS) {
      console.log(JSON.stringify(await ev(CAP_JS), null, 1));
      ws.close();
      return;
    }
    await ev(`[...document.querySelectorAll("header nav button")].filter(b=>b.textContent.trim()==="Layout tool")[0]?.click()`);
    await sleep(2500);

    const check = async (screen) => {
      if (DUMP) {
        console.log(`\n=========== ${screen}`);
        for (const line of (await ev(DUMP_JS)) ?? []) console.log("  " + line);
        return;
      }
      for (const r of RULES[screen] ?? []) {
        const ma = r.placeholder ? await ev(PLACEHOLDER_JS(r.a[0])) : await ev(SIZE_JS(r.a[0], r.a[1]));
        const mb = await ev(SIZE_JS(r.b[0], r.b[1]));
        let ok = false;
        let detail;
        if (ma === null || mb === null) {
          detail = `not found (${ma === null ? "first" : "second"} element)`;
        } else {
          // Visual size: the hand is narrower than the text face at the same
          // pixel size, so it is scaled by the measured width ratio first.
          const a = ma.px * (ma.hand ? HAND_WIDTH : 1);
          const b = mb.px * (mb.hand ? HAND_WIDTH : 1);
          const show = (m, v) => `${m.px}px ${m.hand ? "hand" : "text"} (looks ${v.toFixed(1)})`;
          const pair = `${show(ma, a)} vs ${show(mb, b)}`;
          if (r.rule === "gt") {
            ok = a >= b * 1.25 - 0.01;
            detail = `${pair} = ${(a / b).toFixed(2)}x, need >= 1.25x`;
          } else if (r.rule === "gte") {
            ok = a >= b - 0.01;
            detail = `${pair}, need at least equal`;
          } else if (r.rule === "eq") {
            ok = Math.abs(a - b) / b <= 0.06;
            detail = `${pair}, need within 6%`;
          } else {
            ok = a < b - 0.01;
            detail = `${pair}, first must look smaller`;
          }
        }
        if (!ok) failures += 1;
        console.log(`  ${ok ? "PASS" : "FAIL"}  ${screen.padEnd(7)} ${r.name}  [${detail}]`);
      }
    };

    // Step 1 needs a real place picked before Continue unlocks.
    await ev(`(function(){var i=document.querySelector(".place-combobox input");if(!i)return;i.focus();var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;s.call(i,"Stellenbosch");i.dispatchEvent(new Event("input",{bubbles:true}))})()`);
    await sleep(2500);
    await ev(`document.querySelector(".place-combobox-list button")?.click()`);
    await sleep(2500);
    await ev(`document.querySelector(".biome-option:not(.is-selected)")?.click()`);
    await sleep(1500);
    await check("step-1");
    for (let s = 2; s <= 5; s += 1) {
      await ev(`[...document.querySelectorAll(".finder-footer button")].filter(x=>/Continue/.test(x.textContent))[0]?.click()`);
      await sleep(2200);
      await check(`step-${s}`);
    }
    await ev(`[...document.querySelectorAll(".finder-footer button")].filter(x=>/Build my plan/.test(x.textContent))[0]?.click()`);
    await sleep(6000);
    await check("plan");
    ws.close();
  } finally {
    chrome.kill();
  }
  if (!DUMP) {
    console.log(failures === 0 ? "\nAll type rules pass." : `\n${failures} type rule(s) fail.`);
    process.exitCode = failures === 0 ? 0 : 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
