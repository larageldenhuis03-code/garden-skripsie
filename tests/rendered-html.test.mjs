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
  assert.match(html, /Describe your <em>garden\.<\/em>/);
  assert.match(html, /Discover the plants that <em>fit\.<\/em>/);
  assert.match(html, /suggest plants and show you how they\s+could fit/i);
  assert.match(html, /Start my garden plan/);
  assert.match(html, /Browse the plant library/);
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

test("serves the home hero in a high-quality modern format", async () => {
  const [layout, css, hero] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    stat(
      new URL(
        "../public/images/editorial/home-hero.avif",
        import.meta.url,
      ),
    ),
  ]);

  assert.match(layout, /home-hero\.avif/);
  assert.match(layout, /type="image\/avif"/);
  assert.match(css, /image-set\([^)]*home-hero\.avif/s);
  assert.match(css, /home-hero\.webp/);
  assert.match(css, /home-hero\.jpg/);
  assert.ok(
    hero.size < 320 * 1024,
    `Expected the hero below 320 KB, received ${hero.size} bytes`,
  );
});

test("keeps legacy artwork and unused service scaffolding out of the app", async () => {
  const packageJson = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  );
  const removedPaths = [
    "../hero2.png",
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

test("keeps plan circles visible and the border lightweight", async () => {
  const [css, border] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    stat(
      new URL(
        "../public/images/editorial/site-border.jpg",
        import.meta.url,
      ),
    ),
  ]);

  assert.doesNotMatch(css, /var\(--sage\)/);
  assert.match(
    css,
    /\.plan-marker\s*\{[^}]*background:\s*var\(--accent,\s*var\(--olive-soft\)\)/s,
  );
  assert.match(
    css,
    /\.legend-dot\s*\{[^}]*background:\s*var\(--accent,\s*var\(--olive-soft\)\)/s,
  );
  assert.ok(
    border.size < 200 * 1024,
    `Expected site border below 200 KB, received ${border.size} bytes`,
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
  assert.match(mobileCss, /\.section-heading\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(mobileCss, /\.site-footer\s*\{[^}]*padding:\s*48px 24px/s);
});
