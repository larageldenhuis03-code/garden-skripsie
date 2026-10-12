/**
 * Draw the coverage-test layouts as PNGs.
 *
 * scripts/coverage-test.ts writes panels.json: for each example bed, the
 * placed circles under V0, V1 and V2 on the same seed. This lays them out
 * as one HTML page, renders it in headless Chrome and saves each panel as
 * its own image, so the three versions of a bed can be put side by side.
 *
 * Node 22+ has a global WebSocket, so this needs no dependency.
 *
 * Run: node scripts/coverage-figures.mjs
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIG = join("reports", "figures", "coverage_test");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9961;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const panels = JSON.parse(readFileSync(join(FIG, "panels.json"), "utf8"));
if (panels.length === 0) {
  console.error("panels.json is empty - run scripts/coverage-test.ts first.");
  process.exit(1);
}

/** One bed, drawn to scale with a 1 m grid. */
function svgFor(panel) {
  const pxPerM = Math.min(620 / panel.widthM, 420 / panel.lengthM);
  const w = panel.widthM * pxPerM;
  const h = panel.lengthM * pxPerM;
  const grid = [];
  for (let x = 1; x < panel.widthM; x += 1) {
    grid.push(`<line x1="${x * pxPerM}" y1="0" x2="${x * pxPerM}" y2="${h}" />`);
  }
  for (let y = 1; y < panel.lengthM; y += 1) {
    grid.push(`<line x1="0" y1="${y * pxPerM}" x2="${w}" y2="${y * pxPerM}" />`);
  }
  const circles = panel.circles
    .map(
      (c) =>
        `<circle cx="${c.x * pxPerM}" cy="${c.y * pxPerM}" r="${c.r * pxPerM}" />`,
    )
    .join("");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect class="bed" x="0" y="0" width="${w}" height="${h}" />
    <g class="grid">${grid.join("")}</g>
    <g class="canopy">${circles}</g>
  </svg>`;
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Coverage test</title>
<style>
  body { margin: 0; padding: 20px; background: #fff; font-family: system-ui, sans-serif; }
  .panel { display: inline-block; margin: 0 16px 16px 0; padding: 12px; background: #fff; }
  .panel h2 { margin: 0 0 2px; font-size: 15px; font-weight: 650; }
  .panel p { margin: 0 0 8px; font-size: 12px; color: #444; }
  svg { display: block; }
  .bed { fill: #f6f6f1; stroke: #333; stroke-width: 1; }
  .grid line { stroke: #d6d6cc; stroke-width: 1; }
  .canopy circle { fill: rgba(90, 120, 70, 0.38); stroke: #5a7846; stroke-width: 1; }
</style></head><body>
${panels
  .map(
    (panel, index) => `<div class="panel" id="p${index}">
  <h2>${panel.label} - ${panel.version}</h2>
  <p>${panel.scenarioId}, ${panel.bed} &middot; cover ${panel.cover} &middot;
     empty ${panel.emptyCellShare} &middot; largest patch ${panel.largestEmptyPatch}
     &middot; quadrant CV ${panel.quadrantCV}</p>
  ${svgFor(panel)}
</div>`,
  )
  .join("\n")}
</body></html>`;

const pagePath = join(FIG, "panels.html");
writeFileSync(pagePath, html, "utf8");

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    `--user-data-dir=${join(process.env.TEMP ?? ".", "sg-coverage-figs")}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  for (let i = 0; i < 40; i += 1) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
      break;
    } catch {
      await sleep(500);
    }
  }
  const fileUrl = "file:///" + join(process.cwd(), pagePath).replace(/\\/g, "/");
  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(fileUrl)}`, {
      method: "PUT",
    })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message.result ?? message.error);
    }
  });
  const send = (method, params = {}) => {
    const next = ++id;
    ws.send(JSON.stringify({ id: next, method, params }));
    return new Promise((r) => pending.set(next, r));
  };
  const evaluate = async (expression) =>
    (
      await send("Runtime.evaluate", { expression, returnByValue: true })
    ).result?.value;

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1400,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await sleep(1500);

  for (const [index, panel] of panels.entries()) {
    const box = await evaluate(
      `(function(){var e=document.getElementById("p${index}");var r=e.getBoundingClientRect();` +
        `return {x:r.x+window.scrollX, y:r.y+window.scrollY, w:r.width, h:r.height};})()`,
    );
    if (!box) continue;
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
    });
    const name = `${slug(panel.label)}-${panel.version}.png`;
    writeFileSync(join(FIG, name), Buffer.from(shot.data, "base64"));
    console.log(`  ${join(FIG, name)}`);
  }
  ws.close();
} finally {
  chrome.kill();
}
