/**
 * Capture every screen at 1280 px and 375 px.
 *
 * The app is one page with client-side views, so screens are reached by
 * clicking. The quiz is the hard part: it cannot be deep-linked and each
 * step gates the next. The trick is to seed a complete brief into
 * localStorage before the first paint, so every question is already
 * answered and "Continue" is enabled on every step - the screens then
 * render exactly as they would for someone who had filled them in.
 *
 * Run: node scripts/screens.mjs <base-url> <out-dir>
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "docs/screenshots/before";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = Number(process.argv[4] ?? 9900);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A complete, valid brief, so the quiz can be walked without typing. */
const SEED_BRIEF = {
  biomes: ["Fynbos"],
  bioregion: "Southwest Fynbos Bioregion",
  soil: "sandy",
  wind: "affected",
  viewingEdge: "north",
  sun: "full",
  water: "moderate",
  bedWidthM: 6,
  bedLengthM: 4,
  style: "fynbos",
  colour: { mode: "scheme", scheme: "warm" },
  extras: ["pollinators", "fragrance"],
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${join(process.env.TEMP ?? ".", `sg-screens-${PORT}`)}`,
    "about:blank",
  ], { stdio: "ignore" });

  try {
    for (let i = 0; i < 40; i += 1) {
      try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(500); }
    }
    const target = await (
      await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: "PUT" })
    ).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      const resolve = pending.get(msg.id);
      if (resolve) { pending.delete(msg.id); resolve(msg.result ?? msg.error); }
    });
    const send = (method, params = {}) => {
      const i = ++id;
      ws.send(JSON.stringify({ id: i, method, params }));
      return new Promise((r) => pending.set(i, r));
    };
    const ev = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        return `EXC ${(r.exceptionDetails.exception?.description ?? "").split("\n")[0]}`;
      }
      return r.result?.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    // Seeded before any script runs, so the app boots already answered.
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { localStorage.setItem("garden_tool_v1", JSON.stringify({
        version: 1, savedPlantIds: [], excludedPlantIds: [],
        brief: ${JSON.stringify(SEED_BRIEF)}, savedLayouts: []
      })); } catch {}`,
    });

    const shot = async (name, width) => {
      const height = await ev("document.documentElement.scrollHeight");
      const data = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height: Math.min(Number(height) || 1200, 7000), scale: 1 },
      });
      const file = join(OUT, `${name}-${width}.png`);
      writeFileSync(file, Buffer.from(data.data, "base64"));
      console.log(`  ${file}`);
    };

    const nav = async (label) => {
      for (let i = 0; i < 10; i += 1) {
        await ev(`[].slice.call(document.querySelectorAll("header nav button"))
          .filter(function(b){return b.textContent.trim()===${JSON.stringify(label)}})
          .forEach(function(b){b.click()})`);
        await sleep(900);
        if (await ev(`document.querySelector("header nav button.is-active") &&
          document.querySelector("header nav button.is-active").textContent.trim()===${JSON.stringify(label)}`)) return true;
      }
      return false;
    };

    for (const width of [1280, 375]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width, height: 900, deviceScaleFactor: 2, mobile: width < 700,
      });
      await send("Page.navigate", { url: BASE });
      await sleep(5500);

      await shot("01-home", width);

      // Brief steps 1-5, walked with Continue.
      await nav("Layout tool");
      await sleep(1500);

      // Step 1 gates on a chosen place, which is component state rather
      // than part of the stored brief, so it has to be picked for real:
      // focus the box, type, then click the first suggestion.
      await ev(`(function(){
        var i = document.querySelector(".place-combobox input");
        if (!i) return false;
        i.focus();
        var set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        set.call(i, "Stellenbosch");
        i.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`);
      await sleep(2500);
      await ev(`(function(){
        var b = document.querySelector(".place-combobox-list button");
        if (b) { b.click(); return true; }
        return false;
      })()`);
      await sleep(2500);
      // Choosing the place offers the vegetation types for that area; one
      // has to be ticked before the step will let you continue.
      await ev(`(function(){
        var o = document.querySelector(".biome-option:not(.is-selected)");
        if (o) { o.click(); return true; }
        return false;
      })()`);
      await sleep(2000);
      for (let step = 1; step <= 5; step += 1) {
        await shot(`02-brief-step-${step}`, width);
        const moved = await ev(`(function(){
          var b = [].slice.call(document.querySelectorAll(".finder-footer button"))
            .filter(function(x){return /Continue|Build my plan/.test(x.textContent)})[0];
          if (b && !b.disabled) { b.click(); return true; }
          return false;
        })()`);
        if (!moved) { console.log(`  (step ${step}: Continue disabled, stopping the walk)`); break; }
        await sleep(2200);
      }

      // The plan, reached by finishing the brief above.
      await sleep(3000);
      if (await ev(`!!document.querySelector(".plan-output")`)) {
        await shot("03-plan-output", width);
        await ev(`(function(){var t=document.querySelectorAll(".variant-tab"); if(t[1]) t[1].click()})()`);
        await sleep(2000);
        await shot("04-option-comparison", width);
      } else {
        console.log("  (plan not reached)");
      }

      await nav("Plant library");
      await sleep(2500);
      await shot("05-plant-library", width);

      await ev(`(function(){var c=document.querySelector(".portrait-button, .plant-card button"); if(c) c.click()})()`);
      await sleep(2000);
      await shot("06-plant-profile", width);
      await ev(`(function(){var c=document.querySelector(".drawer-backdrop"); if(c) c.click()})()`);
      await sleep(1200);

      for (let i = 0; i < 8; i += 1) {
        await ev(`(function(){var s=document.querySelector(".saved-link"); if(s) s.click()})()`);
        await sleep(900);
        if (await ev(`!!document.querySelector(".saved-tabs")`)) break;
      }
      await shot("07-saved-gardens", width);
      await ev(`(function(){var t=[].slice.call(document.querySelectorAll(".saved-tab"))[1]; if(t) t.click()})()`);
      await sleep(1200);
      await shot("08-favourites", width);
      await ev(`(function(){var t=[].slice.call(document.querySelectorAll(".saved-tab"))[2]; if(t) t.click()})()`);
      await sleep(1200);
      await shot("09-excluded", width);
    }
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
