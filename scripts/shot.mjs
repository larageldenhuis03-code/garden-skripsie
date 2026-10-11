/**
 * Screenshot the "How it works" page at two widths and report whether the
 * handwriting actually rendered.
 *
 * The page is a client-side view rather than a route, so it cannot be
 * deep-linked: the script drives Chrome over the DevTools Protocol, clicks
 * the nav item, then captures. Node 22 has a global WebSocket, so this
 * needs no dependency.
 *
 * Usage: node scripts/shot.mjs <base-url> <out-dir>
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "screenshots";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  #ws;
  #id = 0;
  #pending = new Map();

  static async attach(wsUrl) {
    const cdp = new CDP();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      cdp.#ws.addEventListener("open", resolve, { once: true });
      cdp.#ws.addEventListener("error", reject, { once: true });
    });
    cdp.#ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      const resolver = cdp.#pending.get(msg.id);
      if (resolver) {
        cdp.#pending.delete(msg.id);
        resolver(msg.result ?? msg.error);
      }
    });
    return cdp;
  }

  send(method, params = {}) {
    const id = ++this.#id;
    this.#ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => this.#pending.set(id, resolve));
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result?.result?.value;
  }

  close() {
    this.#ws.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" + join(process.env.TEMP ?? ".", "sg-shot-profile"),
    "about:blank",
  ], { stdio: "ignore" });

  try {
    // Wait for the debugging endpoint.
    let version = null;
    for (let i = 0; i < 40; i += 1) {
      try {
        version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
        break;
      } catch {
        await sleep(500);
      }
    }
    if (!version) throw new Error("Chrome did not expose its debugging port.");
    console.log(`  ${version.Browser}`);

    const target = await (
      await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: "PUT" })
    ).json();
    const cdp = await CDP.attach(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    for (const [label, width] of [["1280", 1280], ["375", 375]]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 2,
        mobile: width < 700,
      });
      await cdp.send("Page.navigate", { url: BASE });
      await sleep(5000);

      // The method page is a view, not a route: click its nav item. React
      // has to have hydrated first or the click lands on dead markup, so
      // this retries until the heading actually changes.
      let clicked = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await cdp.evaluate(`
          (() => {
            const b = [...document.querySelectorAll("header nav button")]
              .find((x) => x.textContent.trim().toLowerCase() === "how it works");
            if (b) b.click();
          })()
        `);
        await sleep(1200);
        const heading = await cdp.evaluate(
          `document.querySelector("h1") ? document.querySelector("h1").textContent.trim() : ""`,
        );
        if (heading === "How it works") { clicked = true; break; }
      }
      if (!clicked) throw new Error("could not reach the How it works view");
      await sleep(1200);

      const check = await cdp.evaluate(`
        (async () => {
          await document.fonts.ready;
          const h1 = document.querySelector("h1");
          const loaded = [...document.fonts].filter((f) => f.family.includes("Silly Goose"))
            .map((f) => f.status);
          return {
            clickedNav: ${clicked},
            heading: h1 ? h1.textContent.trim() : null,
            h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
            h1Size: h1 ? getComputedStyle(h1).fontSize : null,
            faceStatus: loaded,
            check: document.fonts.check('32px "Silly Goose Hand"'),
            docHeight: document.documentElement.scrollHeight,
          };
        })()
      `);
      console.log(`  ${label}px:`, JSON.stringify(check));

      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width,
          height: Math.min(check?.docHeight ?? 2000, 6000),
          scale: 1,
        },
      });
      const file = join(OUT, `how-it-works-${label}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      console.log(`  wrote ${file}`);
    }
    cdp.close();
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
