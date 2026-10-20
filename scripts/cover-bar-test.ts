/**
 * Cover-bar test (owner, 20 Oct 2026; measurement only). Runs the final
 * algorithm on the 100 batch scenarios plus the fixed case (6 x 2 m fynbos,
 * south view), every option, same seeds, either as it is (FINAL) or with
 * the style cover values overridden IN MEMORY to iteration 1's book values
 * (FINAL-BOOK). Nothing is written back to the rulebook or engine defaults.
 *
 * Selection measures follow Chapter 5's T1 (scripts/chapter5/run-all.ts):
 * option 1 per scenario via buildGardenPlan, all options for Jaccard.
 * Layout measures follow scripts/layout-v2d-run.ts, over every feasible
 * option of the 100 scenarios and the fixed case.
 *
 * Run: COVER_BAR=book|final node --experimental-strip-types scripts/cover-bar-test.ts
 * Writes reports/cover_bar/<variant>.json (summary + figure layouts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { plants } from "../app/data/plants.ts";
import { DATASET_VERSION } from "../app/data/datasetVersion.ts";
import {
  buildGardenPlan,
  buildGardenPlanVariants,
  computeHeightTiers,
  evaluateHardFilters,
  minCentreDistance,
  RULES,
  RULES_VERSION,
  tierOf,
  viewingAxis,
  type GardenBrief,
  type GardenPlan,
} from "../app/lib/planning/index.ts";
import { sideGapSpread } from "../app/lib/planning/relax.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { spreadMetrics } from "./batch-test/metrics.ts";

const VARIANT = process.env.COVER_BAR === "book" ? "final_book" : "final";
const BOOK: Record<string, { coverMin: number; coverMax: number }> = {
  fynbos: { coverMin: 0.7, coverMax: 0.85 },
  mediterranean: { coverMin: 0.6, coverMax: 0.8 },
  cottage: { coverMin: 0.85, coverMax: 0.9 },
  generic: { coverMin: 0.75, coverMax: 0.85 },
};

// ------------------------------------------------------------ the override
const styles = RULES.styles as unknown as Record<string, { coverMin: number; coverMax: number }>;
const rulesBefore = JSON.stringify(RULES);
const coverBefore = Object.fromEntries(Object.entries(styles).map(([k, s]) => [k, { coverMin: s.coverMin, coverMax: s.coverMax }]));
if (VARIANT === "final_book") {
  for (const [k, v] of Object.entries(BOOK)) Object.assign(styles[k], v);
}
// Nothing but the eight cover values may differ from the rulebook.
const changed: string[] = [];
const walk = (a: unknown, b: unknown, path: string) => {
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const key of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
      walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
    }
  } else if (a !== b) changed.push(`${path}: ${a} -> ${b}`);
};
walk(JSON.parse(rulesBefore), JSON.parse(JSON.stringify(RULES)), "");

const median = (v: number[]) => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const byId = new Map(plants.map((p) => [p.id, p]));
const tiers = computeHeightTiers(plants);
const hb = RULES.stage4.heightBands;
const isTree = (id: string) => (byId.get(id)?.plantType ?? []).includes("tree");
const speciesOf = (plan: GardenPlan) => new Set((plan.quantities?.quantities ?? []).map((q) => q.id));
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const id of a) if (b.has(id)) shared += 1;
  return shared / (a.size + b.size - shared);
};

// ------------------------------------------------------------ selection (T1)
const scenarios = buildScenarios();
const FIXED: GardenBrief = {
  biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none",
  viewingEdge: "south", sun: "part", water: "moist", bedWidthM: 6, bedLengthM: 2,
  style: "fynbos", colour: { mode: "none" }, extras: [],
};
const times: number[] = [];
const zs: number[] = [];
const goals: number[][] = [];
const tierGap: Record<string, number[]> = {};
const hardViolations: Record<string, number> = { H1: 0, H2: 0, H3: 0, H3b: 0, H4: 0, H5: 0 };
let p1 = 0;
let p2 = 0;
let degraded = 0;
const infeasible: string[] = [];
const jacc: number[] = [];
const distinct = new Set<string>();
// Layout rows: every feasible option of the 100 scenarios and the fixed case.
const layoutRows: Record<string, number>[] = [];
const samples: unknown[] = [];

function layoutRow(plan: GardenPlan, brief: GardenBrief) {
  const layout = plan.layout!;
  const W = layout.bedWidthM;
  const L = layout.bedLengthM;
  const axis = viewingAxis(brief.viewingEdge, W, L);
  const m = spreadMetrics(layout.placements, W, L);
  let tallFront = 0;
  let treesFront = 0;
  for (const p of layout.placements) {
    const front = axis.depthOf(p.xM, p.yM) / axis.span < hb.edgeFrontMid;
    if (front && (byId.get(p.plantId)?.heightCm ?? 0) >= hb.hBackMin) tallFront += 1;
    if (front && isTree(p.plantId)) treesFront += 1;
  }
  const circles = layout.placements.map((p) => ({ x: p.xM, y: p.yM, r: p.radiusM }));
  return {
    cover: 1 - plan.openSpaceRatio,
    patch: m.largestEmptyPatch,
    emptyCells: m.emptyCellShare,
    sideGapCm: 100 * sideGapSpread(circles, W, L),
    tallFront,
    treesFront,
    plants: (plan.quantities?.quantities ?? []).reduce((s, q) => s + q.quantity, 0),
    species: (plan.quantities?.quantities ?? []).length,
  };
}

const started = performance.now();
for (const [id, brief, inT1] of [...scenarios.map((s) => [s.id, s.brief, true] as const), ["FIX", FIXED, false] as const]) {
  const t0 = performance.now();
  const plan = buildGardenPlan(plants, brief);
  const ms = performance.now() - t0;
  const variants = buildGardenPlanVariants(plants, brief);
  for (const v of variants) if (v.status === "provisional-plan" && v.layout) layoutRows.push(layoutRow(v, brief));
  if (["S001", "S006", "FIX"].includes(id)) {
    const p = variants[0];
    samples.push({
      id, style: brief.style, wind: brief.wind, viewingEdge: brief.viewingEdge ?? "north",
      widthM: brief.bedWidthM, lengthM: brief.bedLengthM, status: p.status, z: p.engine?.z ?? null,
      cover: p.status === "provisional-plan" ? 1 - p.openSpaceRatio : null,
      largestEmptyPatch: p.layout ? spreadMetrics(p.layout.placements, brief.bedWidthM, brief.bedLengthM).largestEmptyPatch : null,
      quadrantCV: p.layout ? spreadMetrics(p.layout.placements, brief.bedWidthM, brief.bedLengthM).quadrantCV : null,
      circles: (p.layout?.placements ?? []).map((c) => ({
        id: c.plantId, x: c.xM, y: c.yM, r: c.radiusM, heightCm: byId.get(c.plantId)?.heightCm ?? null,
        tree: isTree(c.plantId), windbreak: Boolean((c as { windbreakRow?: boolean }).windbreakRow),
      })),
    });
  }
  if (!inT1) continue; // the fixed case is in the layout measures and figures only
  times.push(ms);
  if (plan.status !== "provisional-plan") {
    const outcome = evaluateHardFilters(plants, brief);
    infeasible.push(`${id} (${brief.sun}/${brief.water}/${brief.soil}, ${brief.bedWidthM}x${brief.bedLengthM}): ${(plan.diagnostics[0] ?? "no diagnostic").replace(/\|/g, "/")} [pool ${outcome.survivingCount}]`);
    continue;
  }
  for (const check of plan.engine?.hard ?? []) if (!check.pass) hardViolations[check.id] = (hardViolations[check.id] ?? 0) + 1;
  const layout = plan.layout!;
  for (const p of layout.placements) {
    if (p.xM - p.radiusM < -1e-6 || p.yM - p.radiusM < -1e-6 || p.xM + p.radiusM > layout.bedWidthM + 1e-6 || p.yM + p.radiusM > layout.bedLengthM + 1e-6) p1 += 1;
  }
  const ps = layout.placements;
  for (let i = 0; i < ps.length; i += 1) for (let j = i + 1; j < ps.length; j += 1) {
    if (Math.hypot(ps[i].xM - ps[j].xM, ps[i].yM - ps[j].yM) < minCentreDistance(ps[i].radiusM, ps[j].radiusM) - 1e-6) p2 += 1;
  }
  if (plan.engine?.dropped.length || plan.layout?.unplaced.length) degraded += 1;
  zs.push(plan.engine!.z);
  const g = plan.engine!.goals;
  goals.push([g.A1, g.A2, g.A3, g.A4, g.A5]);
  for (const q of plan.quantities!.quantities) distinct.add(q.id);
  const counts: Record<string, number> = { short: 0, medium: 0, tall: 0 };
  let total = 0;
  for (const q of plan.quantities!.quantities) {
    const p = byId.get(q.id);
    if (!p) continue;
    counts[tierOf(p.heightCm, tiers)] += q.quantity;
    total += q.quantity;
  }
  const styleKey = brief.style === "undecided" ? "generic" : brief.style;
  const tau = (RULES.styles as Record<string, { tau: Record<string, number> }>)[styleKey].tau;
  (tierGap[styleKey] ??= []).push((["short", "medium", "tall"] as const).reduce((s, t) => s + Math.abs((total ? counts[t] / total : 0) - tau[t]), 0));
  for (let i = 0; i < variants.length; i += 1) for (let j = i + 1; j < variants.length; j += 1) jacc.push(jaccard(speciesOf(variants[i]), speciesOf(variants[j])));
}

// The override reaches H1, A4 and the fail rule's cap: shown on the fixed case.
const fix = buildGardenPlan(plants, FIXED);
const h1 = fix.engine?.hard.find((c) => c.id === "H1");
const style = styles.fynbos;
const planted = (fix.quantities?.quantities ?? []).reduce((s, q) => s + q.quantity * Math.PI * ((byId.get(q.id)?.spreadCm ?? 0) / 200) ** 2, 0);
const a4Expected = Math.min(1, planted / (style.coverMin * FIXED.bedWidthM * FIXED.bedLengthM));
const reach = {
  h1Limit: h1?.limit ?? null,
  a4Engine: fix.engine?.goals.A4 ?? null,
  a4FromCoverMin: a4Expected,
  coverRangeInPlanText: fix.assumptions?.find((a: string) => a.includes("planted cover")) ?? null,
};

const L = layoutRows;
const summary = {
  variant: VARIANT,
  rulebook: RULES_VERSION,
  dataset: DATASET_VERSION,
  runAt: new Date().toISOString(),
  seconds: Math.round((performance.now() - started) / 1000),
  coverBefore,
  coverAfter: Object.fromEntries(Object.entries(styles).map(([k, s]) => [k, { coverMin: s.coverMin, coverMax: s.coverMax }])),
  rulesChanged: changed,
  reach,
  selection: {
    feasible: zs.length,
    degraded,
    infeasible,
    hardViolations, p1, p2,
    medianZ: median(zs),
    goalsMean: [0, 1, 2, 3, 4].map((i) => mean(goals.map((g) => g[i]))),
    goalsMin: [0, 1, 2, 3, 4].map((i) => Math.min(...goals.map((g) => g[i]))),
    tierGap: Object.fromEntries(Object.entries(tierGap).map(([k, v]) => [k, mean(v)])),
    jaccard: { pairs: jacc.length, distinct: jacc.filter((j) => j <= 0.7).length, mean: mean(jacc) },
    distinctSpecies: distinct.size,
    timesMs: { median: median(times), p95: pct(times, 0.95), max: Math.max(...times) },
  },
  layout: {
    options: L.length,
    cover: median(L.map((r) => r.cover)),
    cover75: L.filter((r) => r.cover >= 0.75).length,
    cover80: L.filter((r) => r.cover >= 0.8).length,
    patch: median(L.map((r) => r.patch)),
    emptyCells: median(L.map((r) => r.emptyCells)),
    sideGapCm: median(L.map((r) => r.sideGapCm)),
    tallFront: L.reduce((s, r) => s + r.tallFront, 0),
    treesFront: L.reduce((s, r) => s + r.treesFront, 0),
    plants: median(L.map((r) => r.plants)),
    species: median(L.map((r) => r.species)),
  },
  layouts: samples,
};
mkdirSync(join("reports", "cover_bar"), { recursive: true });
writeFileSync(join("reports", "cover_bar", `${VARIANT}.json`), JSON.stringify(summary, null, 1));
console.log(`${VARIANT}: rulebook ${RULES_VERSION} | dataset ${DATASET_VERSION} | feasible ${zs.length}/100 | median Z ${median(zs).toFixed(4)} | ${summary.seconds}s | rules changed: ${changed.length}`);
