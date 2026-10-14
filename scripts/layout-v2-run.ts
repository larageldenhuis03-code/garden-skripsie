/**
 * layout-v2 Step 4: one configuration over the 100 batch briefs plus the
 * fixed case (6 x 2 m fynbos, south view, part sun, moist). One CSV row
 * per brief and option, a 12-case summary, and option 1 of three sample
 * briefs as JSON for the figures. Same seeds as every other run.
 *
 * Kept free of anything newer than engine-final in its imports, so the
 * same file runs on the engine-final tag for configurations (a) and (a').
 *
 * Run:
 *   V2_OUT=v2_d V2_FLAGS="d29=1,curve=1" V2_SET="stage4.heightBands.curveK=0.15" \
 *     node --experimental-strip-types scripts/layout-v2-run.ts
 * V2_FLAGS sets LAYOUT_V2 flags in memory (unlisted flags keep their
 * engineConfig default); V2_SET overrides rulebook values in memory.
 * Neither is ever written back. V2_BANDS_JSON points at a rulebook JSON
 * to read the band edges from when the running engine has none (a, a').
 * Writes: reports/layout_v2/<V2_OUT>.csv, <V2_OUT>.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { plants } from "../app/data/plants.ts";
import { DATASET_VERSION } from "../app/data/datasetVersion.ts";
import * as engineConfig from "../app/lib/planning/engineConfig.ts";
import {
  buildGardenPlanVariants,
  computeHeightTiers,
  computeSpreadBands,
  minCentreDistance,
  RULES,
  RULES_VERSION,
  speciesInfo,
  viewingAxis,
  type GardenBrief,
  type GardenPlan,
} from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { GRID, plantedCells, spreadMetrics } from "./batch-test/metrics.ts";

const OUT_DIR = join("reports", "layout_v2");
const NAME = process.env.V2_OUT ?? "v2_run";
const SAMPLES = (process.env.V2_SAMPLES ?? "S001,S006,FIX").split(",");

// --- configuration, in memory only -----------------------------------------
const flags = (engineConfig as Record<string, unknown>).LAYOUT_V2 as Record<string, boolean> | undefined;
for (const pair of (process.env.V2_FLAGS ?? "").split(",").filter(Boolean)) {
  const [key, value] = pair.split("=");
  if (!flags) throw new Error(`V2_FLAGS given, but this engine has no LAYOUT_V2 (${key})`);
  if (!(key in flags)) throw new Error(`unknown LAYOUT_V2 flag ${key}`);
  flags[key] = value === "1" || value === "true";
}
for (const pair of (process.env.V2_SET ?? "").split(",").filter(Boolean)) {
  const [path, value] = pair.split("=");
  const keys = path.split(".");
  let target = RULES as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  if (!(keys.at(-1)! in target)) throw new Error(`unknown rulebook value ${path}`);
  target[keys.at(-1)!] = Number(value);
}
const stage4 = RULES.stage4 as unknown as Record<string, unknown>;
const bands = (stage4.heightBands ??
  (JSON.parse(readFileSync(process.env.V2_BANDS_JSON as string, "utf8")) as { stage4: { heightBands: unknown } }).stage4
    .heightBands) as { edgeFrontMid: number; edgeMidBack: number; hBackMin: number };
const configLine = `flags ${flags ? JSON.stringify(flags) : "none (engine-final)"}; curveK ${
  (stage4.heightBands as { curveK?: number } | undefined)?.curveK ?? "-"
}; contactBonus ${stage4.contactBonus}; sweepWeight ${stage4.sweepWeight ?? "-"}`;
console.error(`${NAME}: rulebook ${RULES_VERSION} | dataset ${DATASET_VERSION} | ${configLine}`);

// --- helpers ------------------------------------------------------------------
const byId = new Map(plants.map((p) => [p.id, p]));
const tiers = computeHeightTiers(plants);
const spreads = computeSpreadBands(plants);

function hardFailures(plan: GardenPlan): string[] {
  const out: string[] = [];
  for (const check of plan.engine?.hard ?? []) if (!check.pass) out.push(check.id);
  for (const check of plan.engine?.placementChecks ?? []) if (check.kind === "hard" && !check.pass) out.push(check.id);
  const layout = plan.layout;
  if (layout) {
    const list = layout.placements;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (Math.hypot(a.xM - b.xM, a.yM - b.yM) < minCentreDistance(a.radiusM, b.radiusM) - 1e-6) out.push("P2*");
      }
    }
  }
  return [...new Set(out)];
}

/** Planted share of each of 9 cells (3 x 3 over the 20 x 20 sample grid). */
function nineCells(cells: readonly boolean[]): number[] {
  const planted = new Array<number>(9).fill(0);
  const total = new Array<number>(9).fill(0);
  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      const k = Math.floor((row * 3) / GRID) * 3 + Math.floor((col * 3) / GRID);
      total[k] += 1;
      if (cells[row * GRID + col]) planted[k] += 1;
    }
  }
  return planted.map((p, k) => p / total[k]);
}

const median = (v: number[]) => {
  if (v.length === 0) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

function layerOf(id: string, area: number) {
  const plant = byId.get(id);
  return plant ? speciesInfo(plant, 0, tiers, spreads, area)?.layer : undefined;
}

/** The owner's 14 Oct rule: a climber next to an L1 host follows the host. */
function climberOnHost(
  p: { plantId: string; xM: number; yM: number; radiusM: number },
  all: readonly { plantId: string; xM: number; yM: number; radiusM: number }[],
  area: number,
) {
  if (layerOf(p.plantId, area) !== "L2") return false;
  return all.some(
    (h) => h !== p && layerOf(h.plantId, area) === "L1" &&
      Math.hypot(h.xM - p.xM, h.yM - p.yM) <= minCentreDistance(h.radiusM, p.radiusM) + 1e-3,
  );
}

/** The last placement's layout-v2 measures line, and whether that same
 * placement reported the fill pass running out. */
function v2Measures(plan: GardenPlan) {
  const d = plan.diagnostics;
  let last = -1;
  for (let i = d.length - 1; i >= 0; i -= 1) if (d[i].startsWith("layout-v2 measures")) { last = i; break; }
  if (last < 0) return null;
  let prev = -1;
  for (let i = last - 1; i >= 0; i -= 1) if (d[i].startsWith("layout-v2 measures")) { prev = i; break; }
  const num = (key: string) => Number(new RegExp(`${key}=(-?[\\d.]+)`).exec(d[last])?.[1] ?? NaN);
  return {
    tiebreaks: num("tiebreaks"),
    fallbacks: num("fallbacks"),
    straddling: num("straddling"),
    shareViolations: num("shareViolations"),
    fillRanOut: d.slice(prev + 1, last).some((x) => x.includes("front fill pass ran out")),
  };
}

// --- the run ------------------------------------------------------------------
const FIXED: GardenBrief = {
  biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none",
  viewingEdge: "south", sun: "part", water: "moist", bedWidthM: 6, bedLengthM: 2,
  style: "fynbos", colour: { mode: "none" }, extras: [],
};
const briefs = [
  ...buildScenarios().map((s) => ({ id: s.id, brief: s.brief })),
  { id: "FIX", brief: FIXED },
];

type Row = Record<string, string | number | boolean>;
const rows: Row[] = [];
const samples: unknown[] = [];
const started = performance.now();
const r4 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : Number(v.toFixed(4)));

for (const { id, brief } of briefs) {
  const variants = buildGardenPlanVariants(plants, brief);
  variants.forEach((plan, index) => {
    const layout = plan.layout;
    const feasible = plan.status === "provisional-plan" && layout !== null;
    const failures = feasible ? hardFailures(plan) : [];
    let tallFront = 0;
    let nineMin: number | "" = "";
    let nineMed: number | "" = "";
    let patch: number | "" = "";
    let cv: number | "" = "";
    if (layout) {
      const axis = viewingAxis(brief.viewingEdge, layout.bedWidthM, layout.bedLengthM);
      for (const p of layout.placements) {
        const h = byId.get(p.plantId)?.heightCm;
        if (h != null && h > bands.hBackMin && axis.depthOf(p.xM, p.yM) / axis.span < bands.edgeFrontMid) tallFront += 1;
      }
      const cells = plantedCells(layout.placements, layout.bedWidthM, layout.bedLengthM);
      const nine = nineCells(cells);
      nineMin = r4(Math.min(...nine));
      nineMed = r4(median(nine));
      const m = spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM);
      patch = r4(m.largestEmptyPatch);
      cv = r4(m.quadrantCV);
    }
    const v2 = v2Measures(plan);
    const degraded = (plan.engine?.dropped.length ?? 0) > 0 || (layout?.unplaced.length ?? 0) > 0 || layout?.status === "partial";
    rows.push({
      rulebook: RULES_VERSION,
      dataset: DATASET_VERSION,
      config: NAME,
      scenario: id,
      option: index + 1,
      character: plan.character,
      seed: plan.seed,
      status: plan.status,
      feasible,
      success: feasible && failures.length === 0 && !degraded,
      hard_failures: failures.join("+"),
      z: r4(plan.engine?.z),
      A4: r4(plan.engine?.goals?.A4),
      cover: feasible ? r4(1 - plan.openSpaceRatio) : "",
      largest_empty_patch: patch,
      quadrant_cv: cv,
      nine_cell_min: nineMin,
      nine_cell_median: nineMed,
      tall_in_front: tallFront,
      engine_dropped: plan.engine?.dropped.length ?? 0,
      tiebreaks: v2?.tiebreaks ?? "",
      fallbacks: v2?.fallbacks ?? "",
      straddling: v2?.straddling ?? "",
      share_violations: v2?.shareViolations ?? "",
      fill_ran_out: v2 ? v2.fillRanOut : "",
      species: (plan.quantities?.quantities ?? []).map((q) => `${q.id}x${q.quantity}`).join(" "),
    });
    if (index === 0 && SAMPLES.includes(id)) {
      samples.push({
        id, style: brief.style, wind: brief.wind, viewingEdge: brief.viewingEdge ?? "north",
        widthM: brief.bedWidthM, lengthM: brief.bedLengthM, status: plan.status, z: plan.engine?.z ?? null,
        cover: feasible ? 1 - plan.openSpaceRatio : null,
        largestEmptyPatch: patch === "" ? null : patch, quadrantCV: cv === "" ? null : cv,
        circles: (layout?.placements ?? []).map((p) => ({
          id: p.plantId, x: p.xM, y: p.yM, r: p.radiusM,
          heightCm: byId.get(p.plantId)?.heightCm ?? null,
          windbreak: Boolean((p as { windbreakRow?: boolean }).windbreakRow),
        })),
      });
    }
  });
}

// The 12-case layering test: 8 x 6 m fynbos, no wind, four viewing edges.
const twelve: string[] = [];
let twelvePass = 0;
let twelveTotal = 0;
for (const edge of ["north", "east", "south", "west"] as const) {
  const brief: GardenBrief = {
    biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none",
    viewingEdge: edge, sun: "full", water: "moderate", bedWidthM: 8, bedLengthM: 6,
    style: "fynbos", colour: { mode: "none" }, extras: [],
  };
  buildGardenPlanVariants(plants, brief).forEach((plan, i) => {
    twelveTotal += 1;
    const layout = plan.layout;
    if (!layout) { twelve.push(`${edge} ${i + 1}: no layout`); return; }
    const axis = viewingAxis(edge, layout.bedWidthM, layout.bedLengthM);
    const area = layout.bedWidthM * layout.bedLengthM;
    const mean = (pick: (h: number) => boolean) => {
      const xs = layout.placements.filter((p) => {
        const h = byId.get(p.plantId)?.heightCm;
        return h != null && pick(h) && !climberOnHost(p, layout.placements, area);
      });
      return xs.length ? xs.reduce((s, p) => s + axis.depthOf(p.xM, p.yM), 0) / xs.length : null;
    };
    const tall = mean((h) => h >= 100);
    const short = mean((h) => h < 50);
    const hardOk = (plan.engine?.placementChecks ?? []).every((c) => c.kind !== "hard" || c.pass);
    const ok = hardOk && (tall === null || short === null || tall > short);
    if (ok) twelvePass += 1;
    else twelve.push(`${edge} ${i + 1}: tall ${tall?.toFixed(2)} short ${short?.toFixed(2)} hard ${hardOk}`);
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const keys = Object.keys(rows[0]);
const esc = (v: unknown) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
writeFileSync(join(OUT_DIR, `${NAME}.csv`), [keys.join(","), ...rows.map((row) => keys.map((k) => esc(row[k])).join(","))].join("\n") + "\n");
writeFileSync(
  join(OUT_DIR, `${NAME}.json`),
  JSON.stringify({ config: NAME, rulebook: RULES_VERSION, dataset: DATASET_VERSION, configLine, bands, twelve: { pass: twelvePass, total: twelveTotal, failures: twelve }, layouts: samples }, null, 1),
);
console.log(
  `${NAME}: rulebook ${RULES_VERSION} | dataset ${DATASET_VERSION} | ${rows.length} rows | 12-case ${twelvePass}/${twelveTotal} | ${Math.round((performance.now() - started) / 1000)}s`,
);
