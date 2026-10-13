/**
 * The two standard briefs' sourcing, side by side: the deployed app before
 * the per-nursery split (one request, capped at 42), the new preview (one
 * request per nursery) and the dev server (no cap). Live requests to real
 * nurseries, at most one a second per site.
 *
 * Run: BEFORE_URL=... AFTER_URL=... DEV_URL=... node --experimental-strip-types scripts/sourcing-compare.ts
 */
import { writeFileSync } from "node:fs";

import { plants } from "../app/data/plants.ts";
import { buildGardenPlanVariants, type GardenBrief } from "../app/lib/planning/index.ts";
import { runSplitSourcing } from "../app/lib/sourcing/orchestrate.ts";
import type { SourcingReport } from "../app/lib/sourcing/summary.ts";

const BEFORE = process.env.BEFORE_URL ?? "https://53462cf1-silly-goose-mvp.larageldenhuis03.workers.dev";
const AFTER = process.env.AFTER_URL ?? "https://7022ed2f-silly-goose-mvp.larageldenhuis03.workers.dev";
const DEV = process.env.DEV_URL ?? "http://localhost:3000";

const BRIEFS: { name: string; place: string; brief: GardenBrief }[] = [
  {
    name: "A  Stellenbosch fynbos 6 x 4", place: "Stellenbosch",
    brief: {
      biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy",
      wind: "affected", viewingEdge: "north", sun: "full", water: "moderate",
      bedWidthM: 6, bedLengthM: 4, style: "fynbos",
      colour: { mode: "scheme", scheme: "warm" }, extras: ["pollinators", "fragrance"],
    },
  },
  {
    name: "B  Cottage 10 x 6 clay", place: "Hermanus",
    brief: {
      biomes: ["Fynbos"], bioregion: "Southern Fynbos Bioregion", soil: "clay",
      wind: "none", viewingEdge: "south", sun: "part", water: "moist",
      bedWidthM: 10, bedLengthM: 6, style: "cottage",
      colour: { mode: "none" }, extras: ["wildlife"],
    },
  },
];

const postTo = (base: string) => async (body: unknown) => {
  const response = await fetch(`${base}/api/sourcing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 120)}`, specWarning: null };
  }
};

type Row = { env: string; ok: boolean; error?: string; report?: SourcingReport; seconds: number; requests: number };

const rand = (x: number) => `R${Math.round(x).toLocaleString("en-ZA").replace(/\s/g, ",")}`;
const lines: string[] = [];
const say = (line = "") => {
  lines.push(line);
  console.log(line);
};

say("# Sourcing before / after the per-nursery split");
say();
say(`Before: ${BEFORE} (one request, 42-request budget). After: ${AFTER} (one request per nursery). Dev: ${DEV} (no cap).`);
say();

for (const { name, place, brief } of BRIEFS) {
  const plan = buildGardenPlanVariants(plants, brief)[0];
  const items = (plan.quantities?.quantities ?? []).map((q) => ({ plantId: q.id, n: q.quantity }));
  const rows: Row[] = [];

  let t = Date.now();
  const before = await postTo(BEFORE)({ items, place });
  rows.push({ env: "before (deployed, 1 request)", ok: before.ok, error: before.error, report: before.report, seconds: (Date.now() - t) / 1000, requests: 1 });

  for (const [env, base] of [["after (preview, split)", AFTER], ["dev server (no cap, split)", DEV]] as const) {
    t = Date.now();
    const result = await runSplitSourcing(items, place, postTo(base));
    rows.push({ env, ok: result.ok, error: result.ok ? undefined : result.error, report: result.ok ? result.report : undefined, seconds: (Date.now() - t) / 1000, requests: result.requests });
  }

  say(`## ${name} (${place}): ${items.length} species, ${items.reduce((s, i) => s + i.n, 0)} plants`);
  say();
  say("| | budget Low / Typical / High | plants priced from live listings | species found / estimated / not found | nurseries checked | HTTP calls | seconds |");
  say("|---|---|---|---|---|---|---|");
  for (const row of rows) {
    if (!row.ok || !row.report) {
      say(`| ${row.env} | failed: ${row.error} | | | | ${row.requests} | ${row.seconds.toFixed(0)} |`);
      continue;
    }
    const r = row.report;
    const found = r.budget.lines.filter((l) => l.status === "Found").length;
    const live = r.sources.filter((s) => s.platform !== "pdf");
    const checked = live.filter((s) => s.status === "checked" && !/not checked/.test(s.detail)).length;
    say(
      `| ${row.env} | ${rand(r.budget.low)} / ${rand(r.budget.typical)} / ${rand(r.budget.high)} | ${Math.round(r.budget.coverage * 100)}% | ` +
        `${found} / ${r.budget.estimatedSpecies} / ${r.budget.notFoundSpecies} | ${checked} of ${live.length} | ${row.requests} | ${row.seconds.toFixed(0)} |`,
    );
  }
  say();
  for (const row of rows) {
    if (!row.report) continue;
    const problems = row.report.sources.filter((s) => s.status !== "checked" || s.detail);
    if (problems.length) say(`- ${row.env}: ${problems.map((s) => `${s.nursery} ${s.status}${s.detail ? ` (${s.detail})` : ""}`).join("; ")}`);
  }
  say();
}

writeFileSync("reports/sourcing_compare.md", lines.join("\n") + "\n", "utf8");
