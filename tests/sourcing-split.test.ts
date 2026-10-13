/**
 * The split sourcing run (orchestrate.ts): one request per nursery, so the
 * deployed worker never makes more than 50 requests of its own for one
 * incoming request. Mocked fetch throughout; no network.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import snapshot from "../app/data/sourcing_spec.generated.json" with { type: "json" };
import { buildGardenPlan, type GardenBrief } from "../app/lib/planning/index.ts";
import { MemoryCache, PoliteClient } from "../app/lib/sourcing/http.ts";
import { runSplitSourcing } from "../app/lib/sourcing/orchestrate.ts";
import { handleSourcing, type SourcingRequest } from "../app/lib/sourcing/server.ts";
import type { SourcingSpec } from "../app/lib/sourcing/spec.ts";

/** The cap the deployed route uses, and the platform's own limit. */
const CAP = 45;
const CLOUDFLARE_LIMIT = 50;

function spec(): SourcingSpec {
  const copy = structuredClone((snapshot as unknown as { spec: SourcingSpec }).spec);
  copy.pdfSources = []; // live nurseries only
  return copy;
}

const words = (query: string) => decodeURIComponent(query).replace(/\+/g, " ").trim();

/**
 * Every live nursery answers like a real shop: Shopify returns the plant
 * from its search and one product page with two sizes; WooCommerce
 * returns the plant with six variations, each its own request - about
 * seven requests per plant, so a nursery cannot check ten plants within
 * one request and has to use more than one round.
 */
function shopFetch(count: () => void): typeof fetch {
  return (async (input: string | URL | Request) => {
    count();
    const url = new URL(String(input));
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.pathname === "/robots.txt") return new Response("", { status: 404 });
    if (url.hostname.includes("nominatim")) return json([{ lat: "-33.93", lon: "18.86" }]);
    const q = url.searchParams.get("q") ?? url.searchParams.get("search");
    const isWoo = /clicknplant|tulbagh/i.test(url.hostname);
    if (url.pathname.endsWith("/search/suggest.json")) {
      if (isWoo) return new Response("no", { status: 404 });
      const title = words(q ?? "");
      return json({ resources: { results: { products: [{ title, url: `/products/${title.replace(/\s+/g, "-")}`, price: "85.00", available: true, handle: title.replace(/\s+/g, "-") }] } } });
    }
    if (url.pathname.endsWith(".js")) {
      return json({ title: "x", description: "", variants: [{ title: "15cm", price: 8500, available: true }, { title: "20cm", price: 12500, available: true }] });
    }
    if (url.pathname.endsWith("/wp-json/wc/store/products") && !isWoo) return new Response("no", { status: 404 });
    if (url.pathname.endsWith("/wp-json/wc/store/products")) {
      if (url.searchParams.get("per_page") === "1") return json([]);
      const title = words(q ?? "");
      return json([{ id: title.length * 1000, name: title, permalink: `${url.origin}/p/${title}`, type: "variable", is_in_stock: true, prices: { price: "8500", currency_minor_unit: 2 }, variations: [1, 2, 3, 4, 5, 6].map((v) => ({ id: title.length * 1000 + v, attributes: [] })) }]);
    }
    const variation = /\/wp-json\/wc\/store\/products\/(\d+)$/.exec(url.pathname);
    if (variation) {
      return json({ id: Number(variation[1]), name: `x ${["12cm", "15cm", "17cm", "20cm", "2L", "5L"][Number(variation[1]) % 6]}`, is_in_stock: true, prices: { price: "9500", currency_minor_unit: 2 }, variation: "" });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

/** The deployed route, in miniature: a fresh capped client per request
 * (shared cache), counting what each request actually sends. */
function deployedRoute(perRequest: number[]) {
  const cache = new MemoryCache();
  const settings = spec();
  return async (body: SourcingRequest) => {
    let sent = 0;
    const client = new PoliteClient({ fetch: shopFetch(() => (sent += 1)), cache, noDelay: true, maxRequests: CAP });
    const result = await handleSourcing(body, { spec: settings, specVersion: "test", specWarning: null, catalogues: new Map(), client });
    perRequest.push(sent);
    return result;
  };
}

const tenPlants = plants
  .filter((p) => p.scientificName.split(/\s+/).length >= 2)
  .slice(0, 10)
  .map((p) => ({ plantId: p.id, n: 3 }));

test("no single request goes over Cloudflare's 50 subrequests", async () => {
  const perRequest: number[] = [];
  const result = await runSplitSourcing(tenPlants, "Stellenbosch", deployedRoute(perRequest), { sleep: async () => {} });
  assert.ok(result.ok);
  assert.ok(perRequest.length > 2, "the run was split into several requests");
  assert.ok(Math.max(...perRequest) <= CLOUDFLARE_LIMIT, `largest request sent ${Math.max(...perRequest)}`);
  assert.ok(Math.max(...perRequest) <= CAP);
});

test("a 10-species plan across 5 nurseries is fully checked", async () => {
  const perRequest: number[] = [];
  const progress: string[] = [];
  const result = await runSplitSourcing(tenPlants, "Stellenbosch", deployedRoute(perRequest), {
    sleep: async () => {},
    onProgress: ({ checked, total }) => progress.push(`${checked}/${total}`),
  });
  assert.ok(result.ok);
  const live = result.report.sources.filter((s) => s.platform !== "pdf");
  assert.equal(live.length, 5, live.map((s) => s.nursery).join(", "));
  for (const source of live) {
    assert.equal(source.status, "checked", `${source.nursery}: ${source.status} ${source.detail}`);
    assert.equal(source.detail.includes("not checked"), false, `${source.nursery}: ${source.detail}`);
  }
  assert.equal(result.report.warnings.some((w) => /not every plant/.test(w)), false, result.report.warnings.join(" | "));
  // Every plant was found at every nursery.
  for (const species of result.report.species) {
    const nurseries = new Set(species.offers.map((o) => o.sourceId));
    assert.equal(nurseries.size, 5, `${species.scientificName}: ${[...nurseries].join(",")}`);
  }
  // The WooCommerce nurseries needed more than one round to get there.
  const nurseryRequests = perRequest.length - 2; // minus "spec" and "base"
  assert.ok(nurseryRequests > 5, `only ${nurseryRequests} nursery requests`);
  assert.equal(progress.at(-1), "5/5");
  // One summary over all of it: a real budget, every plant priced.
  assert.equal(result.report.budget.coverage, 1);
  assert.ok(result.report.budget.low > 0);
});

test("the split sourcing run never changes the plan", async () => {
  const brief: GardenBrief = {
    biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none",
    viewingEdge: "north", sun: "full", water: "moderate", bedWidthM: 4, bedLengthM: 3,
    style: "fynbos", colour: { mode: "none" }, extras: [],
  };
  const plan = buildGardenPlan(plants, brief);
  const before = JSON.stringify({ q: plan.quantities, l: plan.layout });
  const items = plan.quantities!.quantities.map((q) => ({ plantId: q.id, n: q.quantity }));
  const result = await runSplitSourcing(items, "Stellenbosch", deployedRoute([]), { sleep: async () => {} });
  assert.ok(result.ok);
  assert.equal(JSON.stringify({ q: plan.quantities, l: plan.layout }), before, "the plan object is untouched");
  const again = buildGardenPlan(plants, brief);
  assert.equal(JSON.stringify({ q: again.quantities, l: again.layout }), before, "same seed -> same plants and positions");
});
