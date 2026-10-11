/**
 * Measure what the readability checklist actually asks about: text sizes,
 * tap-target heights, line lengths and contrast. Reports the offenders per
 * screen so the audit is evidence rather than impression.
 *
 * Run: node scripts/a11y-audit.mjs <base-url> [port]
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PORT = Number(process.argv[3] ?? 9920);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = {
  biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy",
  wind: "affected", viewingEdge: "north", sun: "full", water: "moderate",
  bedWidthM: 6, bedLengthM: 4, style: "fynbos",
  colour: { mode: "scheme", scheme: "warm" }, extras: ["pollinators", "fragrance"],
};

const PROBE = `(function(){
  function lum(c){
    var m = c.match(/[\\d.]+/g).map(Number);
    var f = m.slice(0,3).map(function(v){ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2];
  }
  function bg(el){
    var e = el;
    while (e) {
      var c = getComputedStyle(e).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
      e = e.parentElement;
    }
    return "rgb(255,255,255)";
  }
  var small = {}, targets = [], longLines = [], lowContrast = [];
  var all = document.querySelectorAll("body *");
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    var cs = getComputedStyle(el);
    var text = (el.childNodes.length && [].slice.call(el.childNodes)
      .filter(function(n){return n.nodeType===3})
      .map(function(n){return n.textContent.trim()}).join(" ")) || "";
    if (text.length > 1) {
      var px = parseFloat(cs.fontSize);
      if (px < 14) {
        var k = px.toFixed(1) + "px  " + (el.className || el.tagName).toString().slice(0,40);
        small[k] = (small[k]||0) + 1;
      }
      if (text.length > 95 && r.width > 300) {
        longLines.push(Math.round(text.length) + "ch  " + (el.className||el.tagName).toString().slice(0,34));
      }
      try {
        var l1 = lum(cs.color), l2 = lum(bg(el));
        var ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        if (ratio < 4.5) lowContrast.push(ratio.toFixed(2) + ":1  " + (el.className||el.tagName).toString().slice(0,34));
      } catch (e) {}
    }
    if ((el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "SUMMARY") && r.height > 0 && r.height < 44) {
      targets.push(Math.round(r.height) + "px  " + (el.className || el.tagName).toString().slice(0,40));
    }
  }
  function top(arr, n){ var c={}; arr.forEach(function(x){c[x]=(c[x]||0)+1});
    return Object.keys(c).sort(function(a,b){return c[b]-c[a]}).slice(0,n).map(function(k){return c[k]+"x  "+k}); }
  return {
    under14px: Object.keys(small).sort(function(a,b){return small[b]-small[a]}).slice(0,8)
      .map(function(k){return small[k]+"x  "+k}),
    tapUnder44: top(targets, 6),
    over95ch: top(longLines, 4),
    contrastUnder45: top(lowContrast, 5),
  };
})()`;

async function main() {
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu",
    "--no-first-run", `--user-data-dir=${join(process.env.TEMP ?? ".", `sg-a11y-${PORT}`)}`, "about:blank",
  ], { stdio: "ignore" });
  try {
    for (let i = 0; i < 40; i += 1) {
      try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(500); }
    }
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: "PUT" })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0; const pend = new Map();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data); const p = pend.get(m.id);
      if (p) { pend.delete(m.id); p(m.result ?? m.error); }
    });
    const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
    const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) return `EXC ${(r.exceptionDetails.exception?.description ?? "").split("\n")[0]}`;
      return r.result?.value; };

    await send("Page.enable"); await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try{localStorage.setItem("garden_tool_v1",JSON.stringify({version:1,savedPlantIds:[],excludedPlantIds:[],brief:${JSON.stringify(SEED)},savedLayouts:[]}))}catch(e){}`,
    });
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: BASE });
    await sleep(6000);

    const report = async (name) => {
      console.log(`\n### ${name}`);
      const r = await ev(PROBE);
      if (typeof r === "string") { console.log("  " + r); return; }
      for (const [k, v] of Object.entries(r)) {
        console.log(`  ${k}:`);
        (v.length ? v : ["  none"]).forEach((x) => console.log(`     ${x}`));
      }
    };

    await report("Home");
    await ev(`[].slice.call(document.querySelectorAll("header nav button")).filter(function(b){return b.textContent.trim()==="Layout tool"})[0].click()`);
    await sleep(2000);
    await ev(`(function(){var i=document.querySelector(".place-combobox input");i.focus();var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;s.call(i,"Stellenbosch");i.dispatchEvent(new Event("input",{bubbles:true}))})()`);
    await sleep(2500);
    await ev(`(function(){var b=document.querySelector(".place-combobox-list button"); if(b) b.click()})()`);
    await sleep(2000);
    await ev(`(function(){var o=document.querySelector(".biome-option:not(.is-selected)"); if(o) o.click()})()`);
    await sleep(1500);
    await report("Brief step 1");
    for (let s = 0; s < 4; s += 1) {
      await ev(`(function(){var b=[].slice.call(document.querySelectorAll(".finder-footer button")).filter(function(x){return /Continue|Build my plan/.test(x.textContent)})[0]; if(b&&!b.disabled) b.click()})()`);
      await sleep(2000);
    }
    await report("Brief step 5");
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll(".finder-footer button")).filter(function(x){return /Build my plan/.test(x.textContent)})[0]; if(b&&!b.disabled) b.click()})()`);
    await sleep(5000);
    await report("Plan output");
    await ev(`[].slice.call(document.querySelectorAll("header nav button")).filter(function(b){return b.textContent.trim()==="Plant library"})[0].click()`);
    await sleep(3000);
    await report("Plant library");
    ws.close();
  } finally { chrome.kill(); }
}

main().catch((e) => { console.error(e); process.exit(1); });
