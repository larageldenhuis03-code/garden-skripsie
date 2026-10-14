/**
 * layout-v2d (D33b relaxation variants): one configuration over the 100 batch briefs plus the fixed
 * case (6 x 2 m fynbos, south view, part sun, moist). One CSV row per
 * brief and option, the layering checks (12-case, D24 (b) east option 1,
 * B1223 / B1172 depth), and option 1 of three sample briefs as JSON for
 * the figures. Same seeds as every other run.
 *
 * Imports nothing newer than engine-final, so the same file runs on
 * layout-v2d. V2D_RELAX sets engineConfig RELAX keys in memory, e.g.
 * "method=lloyd,edgeGuard=1,swaps=1"; V2B_FLAGS sets LAYOUT_V2B.
 *
 * Run:
 *   V2D_OUT=v1 V2D_RELAX="method=lloyd,edgeGuard=1" \
 *     node --experimental-strip-types scripts/layout-v2d-run.ts
 * V2B_FLAGS sets LAYOUT_V2B flags, V2_FLAGS sets layout-v2's LAYOUT_V2
 * flags, V2B_D32=1 turns D32 on, V2_SET overrides rulebook values - all in
 * memory, never written back. V2_BANDS_JSON: a rulebook JSON to read the
 * band edges from when the running engine has none (a').
 * Writes reports/layout_v2d/v2d_<V2D_OUT>.csv and .json.
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
  createRng,
  minCentreDistance,
  placeSelection,
  RULES,
  RULES_VERSION,
  scorePlantStage1,
  speciesInfo,
  viewingAxis,
  type GardenBrief,
  type GardenPlan,
  type SpeciesInfo,
} from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { GRID, plantedCells, spreadMetrics } from "./batch-test/metrics.ts";
import { cellCoverVariance } from "../app/lib/planning/relax.ts";

const OUT_DIR = join("reports", process.env.V2D_DIR ?? "layout_v2d");
const NAME = process.env.V2D_OUT ?? "run";
const SAMPLES = ["S001", "S006", "FIX"];
const FILLER_SPREAD_MAX_CM = 50; // D32's gap-filler threshold, for counting only

// --- configuration, in memory only -----------------------------------------
const config = engineConfig as Record<string, unknown>;
function setFlags(objectName: string, spec: string | undefined) {
  const target = config[objectName] as Record<string, boolean> | undefined;
  for (const pair of (spec ?? "").split(",").filter(Boolean)) {
    const [key, value] = pair.split("=");
    if (!target) throw new Error(`${objectName} flags given, but this engine has no ${objectName}`);
    if (!(key in target)) throw new Error(`unknown ${objectName} flag ${key}`);
    target[key] = value === "1" || value === "true";
  }
}
setFlags("LAYOUT_V2", process.env.V2_FLAGS);
setFlags("LAYOUT_V2B", process.env.V2B_FLAGS);
if (process.env.V2B_D32 === "1") {
  const d32 = config.D32 as { capacity: boolean } | undefined;
  if (!d32) throw new Error("V2B_D32 given, but this engine has no D32");
  d32.capacity = true;
}
for (const pair of (process.env.V2D_RELAX ?? "").split(",").filter(Boolean)) {
  const relax = config.RELAX as Record<string, unknown>;
  const [key, value] = pair.split("=");
  if (!(key in relax)) throw new Error(`unknown RELAX key ${key}`);
  relax[key] = typeof relax[key] === "boolean" ? value === "1" || value === "true" : typeof relax[key] === "number" ? Number(value) : value;
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
const configLine = [
  config.LAYOUT_V2 ? `LAYOUT_V2 ${JSON.stringify(config.LAYOUT_V2)}` : null,
  config.LAYOUT_V2B ? `LAYOUT_V2B ${JSON.stringify(config.LAYOUT_V2B)}` : null,
  config.D32 ? `D32 ${(config.D32 as { capacity: boolean }).capacity ? "on" : "off"}` : null,
  config.RELAX ? `RELAX ${JSON.stringify(config.RELAX)}` : null,
  `contactBonus ${stage4.contactBonus}; sweepWeight ${stage4.sweepWeight ?? "-"}`,
].filter(Boolean).join("; ");
console.error(`${NAME}: rulebook ${RULES_VERSION} | dataset ${DATASET_VERSION} | ${configLine}`);

// --- helpers ------------------------------------------------------------------
const byId = new Map(plants.map((p) => [p.id, p]));
const tiers = computeHeightTiers(plants);
const spreads = computeSpreadBands(plants);
const isTree = (id: string) => (byId.get(id)?.plantType ?? []).includes("tree");

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

/** Numbers from the last placement's "<prefix> measures" line. */
function measures(plan: GardenPlan, prefix: string): Record<string, number> | null {
  const line = [...plan.diagnostics].reverse().find((d) => d.startsWith(`${prefix} measures`));
  if (!line) return null;
  return Object.fromEntries([...line.matchAll(/(\w+)=(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
}

/** D29 (b) logged whether its front fill ran out, in the same placement. */
function fillRanOut(plan: GardenPlan): boolean | "" {
  const d = plan.diagnostics;
  let last = -1;
  for (let i = d.length - 1; i >= 0; i -= 1) if (d[i].startsWith("layout-v2 measures")) { last = i; break; }
  if (last < 0) return "";
  let prev = -1;
  for (let i = last - 1; i >= 0; i -= 1) if (d[i].startsWith("layout-v2 measures")) { prev = i; break; }
  return d.slice(prev + 1, last).some((x) => x.includes("front fill pass ran out"));
}

/** The last placement's D33 counts line (plants before / after). */
function countsOf(plan: GardenPlan): { removed: number | ""; added: number | "" } {
  const line = [...plan.diagnostics].reverse().find((d) => d.startsWith("D33 counts:"));
  if (!line) return { removed: "", added: "" };
  return { removed: Number(/removed=(\d+)/.exec(line)?.[1]), added: Number(/added=(\d+)/.exec(line)?.[1]) };
}

/** Edge, outside-bed and gap measures, and the tree-canopy check. */
function edgeAndGaps(layout: NonNullable<GardenPlan["layout"]>) {
  const W = layout.bedWidthM;
  const L = layout.bedLengthM;
  const ps = layout.placements;
  const atEdge = ps.filter((p) => Math.min(p.xM - p.radiusM, W - p.xM - p.radiusM, p.yM - p.radiusM, L - p.yM - p.radiusM) < 0.01).length;
  const outside = ps.filter((p) => p.xM - p.radiusM < -1e-6 || p.xM + p.radiusM > W + 1e-6 || p.yM - p.radiusM < -1e-6 || p.yM + p.radiusM > L + 1e-6).length;
  // 95th percentile of how far bare ground lies from the nearest canopy
  // (10 cm sample; covered points excluded), in cm.
  const far: number[] = [];
  for (let y = 0.05; y < L; y += 0.1) {
    for (let x = 0.05; x < W; x += 0.1) {
      let nearest = Infinity;
      for (const p of ps) nearest = Math.min(nearest, Math.hypot(p.xM - x, p.yM - y) - p.radiusM);
      if (nearest > 0) far.push(nearest * 100);
    }
  }
  far.sort((a, b) => a - b);
  const p95 = far.length ? far[Math.min(far.length - 1, Math.floor(0.95 * far.length))] : 0;
  // Tree canopies: overlapping tree pairs (same / different species), and
  // P5 breaks (a plant that does not take shade under a tree canopy).
  const trees = ps.filter((p) => isTree(p.plantId));
  let treeSame = 0;
  let treeDiff = 0;
  for (let i = 0; i < trees.length; i += 1) {
    for (let j = i + 1; j < trees.length; j += 1) {
      const a = trees[i];
      const b = trees[j];
      if (Math.hypot(a.xM - b.xM, a.yM - b.yM) < a.radiusM + b.radiusM - 1e-6) {
        if (a.plantId === b.plantId) treeSame += 1;
        else treeDiff += 1;
      }
    }
  }
  // Drift cohesion: each grouped plant's edge gap to its nearest plant of
  // the same species (cm); the median, and the share more than 10 cm away.
  const mateGaps: number[] = [];
  for (const p of ps) {
    let best = Infinity;
    for (const q of ps) if (q !== p && q.plantId === p.plantId) best = Math.min(best, Math.hypot(p.xM - q.xM, p.yM - q.yM) - p.radiusM - q.radiusM);
    if (Number.isFinite(best)) mateGaps.push(Math.max(0, best) * 100);
  }
  mateGaps.sort((a, b) => a - b);
  const mid = mateGaps.length ? (mateGaps.length % 2 ? mateGaps[(mateGaps.length - 1) / 2] : (mateGaps[mateGaps.length / 2 - 1] + mateGaps[mateGaps.length / 2]) / 2) : 0;
  return {
    drift_gap_cm: Number(mid.toFixed(1)),
    drift_loose_share: mateGaps.length ? Number((mateGaps.filter((g) => g > 10).length / mateGaps.length).toFixed(4)) : "",
    at_edge: atEdge,
    outside_bed: outside,
    gap_p95_cm: Number(p95.toFixed(1)),
    cell1m_var: Number(cellCoverVariance(ps.map((p) => ({ x: p.xM, y: p.yM, r: p.radiusM })), W, L).toFixed(5)),
    tree_overlap_same: treeSame,
    tree_overlap_diff: treeDiff,
  };
}

/** The last placement's D33 line: accepted / rejected, the median move. */
function relaxColumns(plan: GardenPlan) {
  const line = [...plan.diagnostics].reverse().find((d) => d.startsWith("D33 relax:"));
  return {
    relax: line ? (line.includes("accepted") ? "accepted" : "rejected") : "",
    relax_move_cm: line ? Number(/median move ([\d.]+) cm/.exec(line)?.[1] ?? NaN) : "",
    relax_iterations: line ? Number(/iterations (\d+)/.exec(line)?.[1] ?? NaN) : "",
    relax_moved: line ? Number(/moved (\d+) plants/.exec(line)?.[1] ?? NaN) : "",
    relax_moved_cm: line ? Number(/plants, median ([\d.]+) cm/.exec(line)?.[1] ?? NaN) : "",
    relax_swaps: line ? Number(/swaps (\d+)/.exec(line)?.[1] ?? NaN) : "",
  };
}

const r4 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : Number(v.toFixed(4)));

// --- the run ------------------------------------------------------------------
const FIXED: GardenBrief = {
  biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none",
  viewingEdge: "south", sun: "part", water: "moist", bedWidthM: 6, bedLengthM: 2,
  style: "fynbos", colour: { mode: "none" }, extras: [],
};
const briefs = [...buildScenarios().map((s) => ({ id: s.id, brief: s.brief })), { id: "FIX", brief: FIXED }];

type Row = Record<string, string | number | boolean>;
const rows: Row[] = [];
const samples: unknown[] = [];
const started = performance.now();

for (const { id, brief } of briefs) {
  const variants = buildGardenPlanVariants(plants, brief);
  variants.forEach((plan, index) => {
    const layout = plan.layout;
    const feasible = plan.status === "provisional-plan" && layout !== null;
    const failures = feasible ? hardFailures(plan) : [];
    let tallFront = 0;
    let treesFront = 0;
    let fillers = 0;
    let nineMin: number | "" = "";
    let nineMed: number | "" = "";
    let patch: number | "" = "";
    let cv: number | "" = "";
    let selectedArea: number | "" = "";
    const extra: Record<string, number | string> = {};
    if (layout) {
      const axis = viewingAxis(brief.viewingEdge, layout.bedWidthM, layout.bedLengthM);
      let area = 0;
      for (const p of layout.placements) {
        const plant = byId.get(p.plantId);
        const h = plant?.heightCm;
        const front = axis.depthOf(p.xM, p.yM) / axis.span < bands.edgeFrontMid;
        if (front && h != null && h >= bands.hBackMin) tallFront += 1;
        if (front && isTree(p.plantId)) treesFront += 1;
        if ((plant?.spreadCm ?? Infinity) <= FILLER_SPREAD_MAX_CM) fillers += 1;
        area += Math.PI * p.radiusM ** 2;
      }
      selectedArea = r4(area / (layout.bedWidthM * layout.bedLengthM));
      const nine = nineCells(plantedCells(layout.placements, layout.bedWidthM, layout.bedLengthM));
      nineMin = r4(Math.min(...nine));
      nineMed = r4(median(nine));
      const m = spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM);
      patch = r4(m.largestEmptyPatch);
      cv = r4(m.quadrantCV);
      Object.assign(extra, edgeAndGaps(layout));
    }
    const v2 = measures(plan, "layout-v2");
    const v2b = measures(plan, "layout-v2b");
    const degraded = (plan.engine?.dropped.length ?? 0) > 0 || (layout?.unplaced.length ?? 0) > 0 || layout?.status === "partial";
    rows.push({
      rulebook: RULES_VERSION,
      dataset: DATASET_VERSION,
      config: NAME,
      scenario: id,
      option: index + 1,
      seed: plan.seed,
      status: plan.status,
      feasible,
      success: feasible && failures.length === 0 && !degraded,
      hard_failures: failures.join("+"),
      z: r4(plan.engine?.z),
      A4: r4(plan.engine?.goals?.A4),
      cover: feasible ? r4(1 - plan.openSpaceRatio) : "",
      selected_area: selectedArea,
      filler_plants: layout ? fillers : "",
      largest_empty_patch: patch,
      quadrant_cv: cv,
      nine_cell_min: nineMin,
      nine_cell_median: nineMed,
      tall_in_front: tallFront,
      trees_in_front: treesFront,
      trees_in_front_eff: v2b?.treesFront ?? "",
      engine_dropped: plan.engine?.dropped.length ?? 0,
      d32_moves: plan.diagnostics.filter((d) => /^D32: (raised|added)/.test(d)).length,
      // Which D32 target the last search could not meet: "cover", "filler" or "".
      d32_short: (() => {
        const last = [...plan.diagnostics].reverse().find((d) => /^D32: .*stays below/.test(d));
        return !last ? "" : last.includes("filler share") ? "filler" : "cover";
      })(),
      drift_splits: v2b?.driftSplits ?? "",
      ...relaxColumns(plan),
      ...extra,
      d33_removed: countsOf(plan).removed,
      d33_added: countsOf(plan).added,
      tiebreaks: v2?.tiebreaks ?? "",
      fallbacks: v2?.fallbacks ?? "",
      straddling: v2?.straddling ?? "",
      share_violations: v2?.shareViolations ?? "",
      fill_ran_out: fillRanOut(plan),
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
          tree: isTree(p.plantId),
          windbreak: Boolean((p as { windbreakRow?: boolean }).windbreakRow),
        })),
      });
    }
  });
}

// --- layering checks, exactly as tests/engine.test.ts states them ----------
const base: Omit<GardenBrief, "wind" | "viewingEdge"> = {
  biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy",
  sun: "full", water: "moderate", bedWidthM: 8, bedLengthM: 6,
  style: "fynbos", colour: { mode: "none" }, extras: [],
};
function tallBehindShort(plan: GardenPlan, edge: GardenBrief["viewingEdge"]): { ok: boolean; note: string } {
  const layout = plan.layout;
  if (!layout) return { ok: false, note: "no layout" };
  const axis = viewingAxis(edge, layout.bedWidthM, layout.bedLengthM);
  const mean = (pick: (h: number) => boolean) => {
    const xs = layout.placements.filter((p) => {
      const h = byId.get(p.plantId)?.heightCm;
      return h != null && pick(h);
    });
    return xs.length ? xs.reduce((s, p) => s + axis.depthOf(p.xM, p.yM), 0) / xs.length : null;
  };
  const tall = mean((h) => h >= 100);
  const short = mean((h) => h < 50);
  const hardOk = (plan.engine?.placementChecks ?? []).every((c) => c.kind !== "hard" || c.pass);
  return {
    ok: hardOk && (tall === null || short === null || tall > short),
    note: `tall ${tall?.toFixed(2)} short ${short?.toFixed(2)}${hardOk ? "" : " hard check failed"}`,
  };
}
const twelve: string[] = [];
let twelvePass = 0;
let twelveTotal = 0;
for (const edge of ["north", "east", "south", "west"] as const) {
  buildGardenPlanVariants(plants, { ...base, wind: "none", viewingEdge: edge }).forEach((plan, i) => {
    twelveTotal += 1;
    const check = tallBehindShort(plan, edge);
    if (check.ok) twelvePass += 1;
    else twelve.push(`${edge} ${i + 1}: ${check.note}`);
  });
}
const d24b = (() => {
  const plan = buildGardenPlanVariants(plants, { ...base, wind: "affected", viewingEdge: "east" })[0];
  const check = tallBehindShort(plan, "east");
  return `${check.ok ? "pass" : "FAIL"} (${check.note})`;
})();
// B1223 (2 m) and B1172 (1 m) placed with two short species, every edge.
const b12: string[] = [];
{
  const shortIds = plants
    .filter((p) => p.heightCm !== null && p.heightCm < 30 && p.spreadCm !== null && p.spreadCm >= 30 && p.spreadCm <= 60)
    .slice(0, 2)
    .map((p) => p.id);
  for (const edge of ["north", "east", "south", "west"] as const) {
    const brief: GardenBrief = { ...base, viewingEdge: edge, wind: "none", water: "moist", style: "undecided" };
    const infos = new Map<string, SpeciesInfo>();
    for (const pid of ["B1223", "B1172", ...shortIds]) {
      const plant = byId.get(pid)!;
      infos.set(pid, speciesInfo(plant, scorePlantStage1(plant, { brief, savedPlantIds: [] }).score, tiers, spreads, 48)!);
    }
    const selection = new Map<string, number>([["B1223", 3], ["B1172", 1], ...shortIds.map((s) => [s, 3] as [string, number])]);
    const result = placeSelection(selection, infos, { widthM: 8, depthM: 6, windSite: 0, rowsAvailable: 0, frontEdge: edge }, createRng(`b1223-${edge}`));
    const axis = viewingAxis(edge, 8, 6);
    const depth = (pid: string) => {
      const xs = result.layout.placements.filter((p) => p.plantId === pid).map((p) => axis.depthOf(p.xM, p.yM) / axis.span);
      return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
    };
    const shortD = shortIds.map(depth).filter((x): x is number => x !== null);
    const shortMean = shortD.length ? shortD.reduce((s, x) => s + x, 0) / shortD.length : null;
    const tall = ["B1223", "B1172"].map((pid) => `${pid} ${depth(pid)?.toFixed(2) ?? "unplaced"}`).join(", ");
    b12.push(`${edge}: ${tall}; short ${shortMean?.toFixed(2)}`);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const keys = Object.keys(rows[0]);
const esc = (v: unknown) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
writeFileSync(join(OUT_DIR, `v2d_${NAME}.csv`), [keys.join(","), ...rows.map((row) => keys.map((k) => esc(row[k])).join(","))].join("\n") + "\n");
writeFileSync(
  join(OUT_DIR, `v2d_${NAME}.json`),
  JSON.stringify({
    config: NAME, rulebook: RULES_VERSION, dataset: DATASET_VERSION, configLine, bands,
    twelve: { pass: twelvePass, total: twelveTotal, failures: twelve }, d24b, b1223b1172: b12, layouts: samples,
  }, null, 1),
);
console.log(
  `${NAME}: rulebook ${RULES_VERSION} | dataset ${DATASET_VERSION} | ${rows.length} rows | 12-case ${twelvePass}/${twelveTotal} | D24(b) east 1 ${d24b} | ${Math.round((performance.now() - started) / 1000)}s`,
);
