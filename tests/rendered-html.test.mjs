import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Silly Goose product surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Silly Goose MVP — Garden planning for the Western Cape<\/title>/i,
  );
  assert.match(html, /Let’s grow your <em>garden\.<\/em>/);
  assert.match(html, /estimate what your planting could cost/i);
  assert.match(html, /flowers-sketch\.png/);
  // Entry-point labels are specified copy (spec 1), not incidental.
  assert.match(html, /Create my garden/);
  assert.match(html, /Browse plant library/);
  assert.doesNotMatch(html, /class="manifesto-band"/);
  assert.doesNotMatch(html, /class="specimen-section"/);
  assert.doesNotMatch(html, /class="how-section"/);
  assert.doesNotMatch(html, /<footer\b/i);
  assert.doesNotMatch(html, /A garden guide for the Western Cape/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("removes disposable starter UI and dependencies", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<GardenApp \/>/);
  assert.match(layout, /Silly Goose MVP/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
});

test("uses the flower sketch as home visual and site icon, with no background art", async () => {
  const [layout, css, sketch, icon] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    stat(new URL("../public/images/flowers-sketch.png", import.meta.url)),
    stat(new URL("../public/favicon.png", import.meta.url)),
  ]);
  assert.match(layout, /rel="icon"[^>]*favicon\.png/);
  assert.doesNotMatch(layout, /home-hero/);
  assert.doesNotMatch(css, /home-hero|site-border\.jpg/);
  assert.ok(sketch.size > 0 && icon.size > 0);
});

test("keeps legacy artwork and unused service scaffolding out of the app", async () => {
  const packageJson = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  );
  const removedPaths = [
    "../hero2.png",
    "../hero.png",
    "../border.jpg",
    "../public/images/editorial/home-hero.avif",
    "../public/images/editorial/site-border.jpg",
    "../assets/source/home-cape-cabinet.png",
    "../public/images/editorial/home-headline-frame.png",
    "../public/images/editorial/home-cape-cabinet.webp",
    "../app/chatgpt-auth.ts",
    "../db/schema.ts",
    "../drizzle/meta/_journal.json",
    "../drizzle.config.ts",
    "../postcss.config.mjs",
  ];

  assert.doesNotMatch(packageJson, /drizzle|tailwind|^\s*"next"\s*:/im);
  await Promise.all(
    removedPaths.map((path) =>
      assert.rejects(access(new URL(path, import.meta.url))),
    ),
  );
});

test("keeps plan circles visible", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(css, /var\(--sage\)/);
  assert.match(
    css,
    /\.plan-marker\s*\{[^}]*background:\s*var\(--accent,\s*var\(--olive-soft\)\)/s,
  );
  assert.match(
    css,
    /\.legend-dot\s*\{[^}]*background:\s*var\(--accent,\s*var\(--olive-soft\)\)/s,
  );
});

test("keeps the app usable on narrow touch screens", async () => {
  const [response, css] = await Promise.all([
    render(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const mobileStart = css.indexOf("@media (max-width: 620px)");
  const mobileEnd = css.indexOf(
    "@media (prefers-reduced-motion: reduce)",
    mobileStart,
  );
  const mobileCss = css.slice(mobileStart, mobileEnd);

  assert.match(
    html,
    /<meta name="viewport" content="width=device-width, initial-scale=1"\/?>/i,
  );
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(mobileCss, /\.hero-copy h1 > span\s*\{[^}]*white-space:\s*normal/s);
  assert.match(mobileCss, /\.saved-label::after\s*\{[^}]*content:\s*"Saved"/s);
  assert.match(mobileCss, /\.site-footer\s*\{[^}]*padding:\s*48px 24px/s);
});
