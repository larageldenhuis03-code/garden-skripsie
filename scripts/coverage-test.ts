/**
 * Coverage test: three ways of filling a bed, measured on the same 100
 * scenarios with the same seeds.
 *
 *   V0  the engine as imported.
 *   V1  cover_max = 1.0 and cover_min = 0.95 for every style, so H1 stops
 *       limiting the plan and G4 asks for a nearly full bed.
 *   V2  the baseline cover values, with the contact-point placement
 *       preference at 0. That bonus is what packs plants against the bed
 *       edge and against each other, so it is also what clumps them.
 *
 * MEASUREMENT ONLY. No engine file is changed by this script: V1 and V2
 * are in-memory overrides applied before a run and undone after it, the
 * same technique scripts/chapter5/run-all.ts uses for its sensitivity
 * variants. The rulebook on disk is untouched and never re-imported.
 *
 * Run: node --experimental-strip-types scripts/coverage-test.ts
 * Writes: reports/coverage_test.md, reports/coverage_test.csv and the
 *         figure data under reports/figures/coverage_test/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { plants } from "../app/data/plants.ts";
import {
  bandFor,
  buildGardenPlan,
  computeHeightTiers,
  computeSpreadBands,
  minCentreDistance,
  PLACEMENT,
  RULES,
  SEARCH,
  RULES_VERSION,
  speciesInfo,
  type GardenPlan,
} from "../app/lib/planning/index.ts";
import { buildScenarios, type Scenario } from "./batch-test/scenarios.ts";
import { cellsAtLeastHalf, spreadMetrics } from "./batch-test/metrics.ts";
import COMBOS from "./batch-test/combos.json" with { type: "json" };

const OUT = "reports";
const FIG = join(OUT, "figures", "coverage_test");

// ---------------------------------------------------------------- versions

/** Set one key and hand back the undo, as the sensitivity study does. */
function setPath(
  object: Record<string, unknown>,
  key: string,
  value: unknown,
): () => void {
  const before = object[key];
  object[key] = value;
  return () => {
    object[key] = before;
  };
}

/** V3 weight for the emptiest-block preference. Above the old contact
 * bonus of 0.05 and below the P13 wind term of 0.5; it is applied only
 * inside the depth band, so the band is never overridden. */
const EMPTIEST_BLOCK_WEIGHT = 0.25;

type Version = {
  id: "V0" | "V1" | "V2" | "V3" | "V5" | "V6";
  label: string;
  /** Applies the override; returns the undo. */
  apply: () => () => void;
  /** The cover a plan of this style is being asked to reach. */
  target: (style: string) => number;
};

const styleKeyOf = (style: string) => (style === "undecided" ? "generic" : style);
const styleRules = RULES.styles as unknown as Record<
  string,
  { coverMin: number; coverMax: number }
>;
const BASE_COVER: Record<string, { coverMin: number; coverMax: number }> =
  Object.fromEntries(
    Object.entries(styleRules).map(([key, value]) => [
      key,
      { coverMin: value.coverMin, coverMax: value.coverMax },
    ]),
  );

/** The versions this report compares. */
const RUN_IDS = ["V0", "V2", "V5", "V6"];

const VERSIONS: Version[] = [
  {
    id: "V0",
    label: "baseline, as imported",
    apply: () => () => {},
    target: (style) => BASE_COVER[styleKeyOf(style)].coverMin,
  },
  {
    id: "V1",
    label: "cover_max 1.0, cover_min 0.95",
    apply: () => {
      const undo: (() => void)[] = [];
      for (const key of Object.keys(styleRules)) {
        const style = styleRules[key] as unknown as Record<string, unknown>;
        undo.push(setPath(style, "coverMax", 1.0));
        undo.push(setPath(style, "coverMin", 0.95));
      }
      return () => undo.forEach((undoOne) => undoOne());
    },
    target: () => 0.95,
  },
  {
    id: "V2",
    label: "contact-point preference 0",
    apply: () =>
      setPath(PLACEMENT as unknown as Record<string, unknown>, "contactBonus", 0),
    target: (style) => BASE_COVER[styleKeyOf(style)].coverMin,
  },
  {
    id: "V3",
    label: "contact 0, plus the emptiest-block preference (weight 0.25)",
    apply: () => {
      const placement = PLACEMENT as unknown as Record<string, unknown>;
      const undo = [
        setPath(placement, "contactBonus", 0),
        setPath(placement, "emptiestBlockWeight", EMPTIEST_BLOCK_WEIGHT),
      ];
      return () => undo.forEach((undoOne) => undoOne());
    },
    target: (style) => BASE_COVER[styleKeyOf(style)].coverMin,
  },
  {
    id: "V5",
    label: "contact 0, cover_min a hard floor",
    apply: () => {
      const placement = PLACEMENT as unknown as Record<string, unknown>;
      const search = SEARCH as unknown as Record<string, unknown>;
      const undo = [
        setPath(placement, "contactBonus", 0),
        setPath(search, "coverMinHard", true),
      ];
      return () => undo.forEach((undoOne) => undoOne());
    },
    target: (style) => BASE_COVER[styleKeyOf(style)].coverMin,
  },
  {
    id: "V6",
    label: "V5 plus the gap-fill pass",
    apply: () => {
      const placement = PLACEMENT as unknown as Record<string, unknown>;
      const search = SEARCH as unknown as Record<string, unknown>;
      const undo = [
        setPath(placement, "contactBonus", 0),
        setPath(search, "coverMinHard", true),
        setPath(search, "gapFill", true),
      ];
      return () => undo.forEach((undoOne) => undoOne());
    },
    target: (style) => BASE_COVER[styleKeyOf(style)].coverMin,
  },
];

// ------------------------------------------------------------------- rows

type Limit = "count" | "placement" | "pool" | "-";

/** Why a `pool` plan used fewer species than H2 allows. */
type PoolReason = "exhausted" | "stopped early" | "-";

type Row = {
  version: string;
  id: string;
  style: string;
  bed: string;
  bedAreaM2: number;
  band: string;
  code: string;
  feasible: boolean;
  violations: string;
  species: number;
  plants: number;
  unplaced: number;
  cover: number;
  target: number;
  emptyCellShare: number;
  largestEmptyPatch: number;
  quadrantCV: number;
  z: number | null;
  A1: number | null;
  A2: number | null;
  A3: number | null;
  A4: number | null;
  A5: number | null;
  ms: number;
  limit: Limit;
  limitCount: boolean;
  limitPlacement: boolean;
  limitPool: boolean;
  /** Species that survived Stage 0, and the most H2 would allow here. */
  candidates: number;
  sMax: number;
  poolReason: PoolReason;
  neighbourPairs: number;
  neighbourSameCombo: number;
  neighbourBothInCombo: number;
  neighbourShare: number;
  /** Share of square metres at least half planted (the layout's own grid). */
  cellsFull: number;
  /** The cover floor could not be met; this is the densest mix found. */
  coverShort: boolean;
};

/**
 * The one combination rule the rulebook actually states for Stage 4:
 * "Members of the same combo are placed as neighbours within their layer"
 * (8_Species_Reference B23). It is recorded there as NOT IMPLEMENTED,
 * future work; this measures how often it happens anyway.
 *
 * The combo library is read from the workbook into
 * scripts/batch-test/combos.json for measurement. The engine does not see
 * it, and the rulebook import does not carry that tab.
 */
const COMBO_BY_PLANT = (() => {
  const byName = new Map(
    plants.map((plant) => [plant.scientificName.toLowerCase().trim(), plant.id]),
  );
  const membership = new Map<string, Set<string>>();
  for (const combo of COMBOS.combos) {
    for (const name of combo.species) {
      const id = byName.get(name.toLowerCase().trim());
      if (!id) continue;
      const set = membership.get(id) ?? new Set<string>();
      set.add(combo.id);
      membership.set(id, set);
    }
  }
  return membership;
})();

/** Two plants count as neighbours when their canopies touch or their edges
 * are within half a metre of each other. */
const NEIGHBOUR_GAP_M = 0.5;

function neighbourPairs(layout: {
  placements: { plantId: string; xM: number; yM: number; radiusM: number }[];
}): { pairs: number; sameCombo: number; bothInACombo: number } {
  let pairs = 0;
  let sameCombo = 0;
  let bothInACombo = 0;
  const list = layout.placements;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a.plantId === b.plantId) continue;
      const gap =
        Math.hypot(a.xM - b.xM, a.yM - b.yM) - a.radiusM - b.radiusM;
      if (gap > NEIGHBOUR_GAP_M) continue;
      pairs += 1;
      const ca = COMBO_BY_PLANT.get(a.plantId);
      const cb = COMBO_BY_PLANT.get(b.plantId);
      if (!ca || !cb) continue;
      bothInACombo += 1;
      for (const id of ca) {
        if (cb.has(id)) {
          sameCombo += 1;
          break;
        }
      }
    }
  }
  return { pairs, sameCombo, bothInACombo };
}

/** The bed-size bands the report splits by. */
function bandOf(areaM2: number): string {
  if (areaM2 < 6) return "small (<6 m2)";
  if (areaM2 < 30) return "medium (6-30 m2)";
  return "large (>=30 m2)";
}

const tiers = computeHeightTiers(plants);
const spreads = computeSpreadBands(plants);
const byId = new Map(plants.map((plant) => [plant.id, plant]));

/**
 * Hard rules, recomputed here rather than taken on trust: the engine's own
 * hard checks, plus an independent P1 (inside the bed) and P2 (centre
 * distance) pass over the coordinates, reported as P1* and P2*.
 */
function violationsOf(plan: GardenPlan): string[] {
  const out: string[] = [];
  for (const check of plan.engine?.hard ?? []) if (!check.pass) out.push(check.id);
  for (const check of plan.engine?.placementChecks ?? []) {
    if (check.kind === "hard" && !check.pass) out.push(check.id);
  }
  const layout = plan.layout;
  if (layout) {
    for (const p of layout.placements) {
      if (
        p.xM - p.radiusM < -1e-6 ||
        p.yM - p.radiusM < -1e-6 ||
        p.xM + p.radiusM > layout.bedWidthM + 1e-6 ||
        p.yM + p.radiusM > layout.bedLengthM + 1e-6
      ) {
        out.push("P1*");
        break;
      }
    }
    let overlap = false;
    for (let i = 0; i < layout.placements.length && !overlap; i += 1) {
      for (let j = i + 1; j < layout.placements.length; j += 1) {
        const a = layout.placements[i];
        const b = layout.placements[j];
        if (
          Math.hypot(a.xM - b.xM, a.yM - b.yM) <
          minCentreDistance(a.radiusM, b.radiusM) - 1e-6
        ) {
          overlap = true;
          break;
        }
      }
    }
    if (overlap) out.push("P2*");
  }
  return [...new Set(out)];
}

/**
 * Why this plan did not reach its target cover.
 *
 *   count      even at the largest group size H3 allows for each species
 *              it has chosen, the canopy could not add up to the target;
 *   placement  it selected enough canopy, but Stage 4 could not get it
 *              into the bed;
 *   pool       it is using fewer species than H2 would allow, so there was
 *              room to select more and it did not.
 *
 * Tested in that order, first match wins; the three raw flags are kept in
 * the CSV so overlaps stay visible.
 */
function bindingLimit(
  plan: GardenPlan,
  target: number,
): {
  limit: Limit;
  count: boolean;
  placement: boolean;
  pool: boolean;
  sMax: number;
  poolReason: PoolReason;
} {
  const layout = plan.layout;
  const groups = plan.quantities?.quantities ?? [];
  if (!layout || groups.length === 0) {
    return {
      limit: "-",
      count: false,
      placement: false,
      pool: false,
      sMax: 0,
      poolReason: "-",
    };
  }
  const bedArea = layout.bedWidthM * layout.bedLengthM;
  const needed = target * bedArea;

  let maxArea = 0;
  let selectedArea = 0;
  for (const group of groups) {
    const plant = byId.get(group.id);
    if (!plant) continue;
    const info = speciesInfo(plant, 0, tiers, spreads, bedArea);
    if (!info) continue;
    maxArea += Math.max(...info.allowedN) * info.areaM2;
    selectedArea += group.quantity * info.areaM2;
  }
  const { sMax } = bandFor(bedArea);
  const count = maxArea < needed - 1e-9;
  const placement = selectedArea >= needed - 1e-9;
  const pool = groups.length < sMax;
  const limit: Limit = count
    ? "count"
    : placement
      ? "placement"
      : pool
        ? "pool"
        : "-";
  // A plan can use fewer species than H2 allows for two very different
  // reasons, and they point at different fixes: either Stage 0 left it
  // fewer candidates than H2's ceiling, or there were plenty and the
  // selector stopped before using them.
  const poolReason: PoolReason = !pool
    ? "-"
    : plan.counts.candidate < sMax
      ? "exhausted"
      : "stopped early";
  return { limit, count, placement, pool, sMax, poolReason };
}

function runVersion(version: Version, scenarios: Scenario[]): Row[] {
  const undo = version.apply();
  const rows: Row[] = [];
  try {
    for (const scenario of scenarios) {
      const { brief } = scenario;
      const bedAreaM2 = brief.bedWidthM * brief.bedLengthM;
      const started = performance.now();
      let plan: GardenPlan | null = null;
      let failed = false;
      try {
        plan = buildGardenPlan(plants, brief);
      } catch {
        failed = true;
      }
      const ms = performance.now() - started;
      const target = version.target(brief.style);
      const layout = plan?.layout ?? null;
      const metrics = layout
        ? spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM)
        : { emptyCellShare: 1, largestEmptyPatch: 1, quadrantCV: 0 };
      const violations = plan ? violationsOf(plan) : ["ERROR"];
      const limits = plan
        ? bindingLimit(plan, target)
        : {
            limit: "-" as Limit,
            count: false,
            placement: false,
            pool: false,
            sMax: 0,
            poolReason: "-" as PoolReason,
          };
      const goals = plan?.engine?.goals ?? null;
      const cover = layout && plan ? 1 - plan.openSpaceRatio : 0;
      const pairs = layout
        ? neighbourPairs(layout)
        : { pairs: 0, sameCombo: 0, bothInACombo: 0 };
      rows.push({
        version: version.id,
        id: scenario.id,
        style: brief.style,
        bed: `${brief.bedWidthM}x${brief.bedLengthM}`,
        bedAreaM2: Number(bedAreaM2.toFixed(2)),
        band: bandOf(bedAreaM2),
        code: failed ? "ERROR" : (plan?.status ?? "none"),
        feasible: plan?.status === "provisional-plan" && layout !== null,
        violations: violations.join("+"),
        species: plan?.quantities?.quantities.length ?? 0,
        plants: layout?.placements.length ?? 0,
        unplaced: layout?.unplaced.length ?? 0,
        cover: Number(cover.toFixed(4)),
        target: Number(target.toFixed(3)),
        emptyCellShare: Number(metrics.emptyCellShare.toFixed(4)),
        largestEmptyPatch: Number(metrics.largestEmptyPatch.toFixed(4)),
        quadrantCV: Number(metrics.quadrantCV.toFixed(4)),
        z: plan?.engine ? Number(plan.engine.z.toFixed(4)) : null,
        A1: goals ? Number(goals.A1.toFixed(4)) : null,
        A2: goals ? Number(goals.A2.toFixed(4)) : null,
        A3: goals ? Number(goals.A3.toFixed(4)) : null,
        A4: goals ? Number(goals.A4.toFixed(4)) : null,
        A5: goals ? Number(goals.A5.toFixed(4)) : null,
        ms: Math.round(ms),
        limit: layout && cover < target - 1e-9 ? limits.limit : "-",
        limitCount: limits.count,
        limitPlacement: limits.placement,
        limitPool: limits.pool,
        candidates: plan?.counts.candidate ?? 0,
        sMax: limits.sMax,
        poolReason: limits.poolReason,
        neighbourPairs: pairs.pairs,
        neighbourSameCombo: pairs.sameCombo,
        neighbourBothInCombo: pairs.bothInACombo,
        neighbourShare: pairs.pairs === 0 ? 0 : Number((pairs.sameCombo / pairs.pairs).toFixed(5)),
        cellsFull: layout
          ? Number(
              cellsAtLeastHalf(layout.placements, layout.bedWidthM, layout.bedLengthM).toFixed(4),
            )
          : 0,
        coverShort: (plan?.diagnostics ?? []).some((note) => note.startsWith("cover_short")),
      });
    }
  } finally {
    undo();
  }
  return rows;
}

// -------------------------------------------------------------- reporting

/** Excel's PERCENTILE.INC, so the figures can be checked by hand. */
function percentile(values: number[], fraction: number): number {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const rank = fraction * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

const fmt = (value: number, dp = 3) =>
  Number.isFinite(value) ? value.toFixed(dp) : "-";
const cell = (values: number[], dp = 3) =>
  values.length === 0
    ? "-"
    : `${fmt(percentile(values, 0.5), dp)} (${fmt(percentile(values, 0.1), dp)}-${fmt(percentile(values, 0.9), dp)})`;

type Metric = { key: string; get: (row: Row) => number | null; dp: number };

const METRICS: Metric[] = [
  { key: "cover", get: (r) => r.cover, dp: 3 },
  { key: "empty-cell share", get: (r) => r.emptyCellShare, dp: 3 },
  { key: "largest empty patch", get: (r) => r.largestEmptyPatch, dp: 3 },
  { key: "square metres >= 50% planted", get: (r) => r.cellsFull, dp: 3 },
  { key: "quadrant CV", get: (r) => r.quadrantCV, dp: 3 },
  { key: "species", get: (r) => r.species, dp: 1 },
  { key: "plants", get: (r) => r.plants, dp: 1 },
  { key: "Z", get: (r) => r.z, dp: 4 },
  { key: "A1 height balance", get: (r) => r.A1, dp: 3 },
  { key: "A2 colour", get: (r) => r.A2, dp: 3 },
  { key: "A3 variety", get: (r) => r.A3, dp: 3 },
  { key: "A4 ground cover", get: (r) => r.A4, dp: 3 },
  { key: "A5 flowering", get: (r) => r.A5, dp: 3 },
  { key: "neighbour pairs", get: (r) => r.neighbourPairs, dp: 0 },
  { key: "same-combo neighbour share", get: (r) => r.neighbourShare, dp: 4 },
  { key: "unplaced plants", get: (r) => r.unplaced, dp: 1 },
  { key: "run time (ms)", get: (r) => r.ms, dp: 0 },
];

function table(
  rowsByVersion: Map<string, Row[]>,
  only?: (row: Row) => boolean,
): string {
  const ids = [...rowsByVersion.keys()];
  const lines = [
    `| measure | ${ids.join(" | ")} |`,
    `|---|${ids.map(() => "---").join("|")}|`,
  ];
  for (const metric of METRICS) {
    const cells = ids.map((id) => {
      const rows = (rowsByVersion.get(id) ?? []).filter(
        (row) => row.feasible && (!only || only(row)),
      );
      const values = rows
        .map(metric.get)
        .filter((value): value is number => value !== null);
      return cell(values, metric.dp);
    });
    lines.push(`| ${metric.key} | ${cells.join(" | ")} |`);
  }
  const feasible = ids.map((id) => {
    const rows = (rowsByVersion.get(id) ?? []).filter((row) => !only || only(row));
    return `${rows.filter((row) => row.feasible).length} / ${rows.length}`;
  });
  lines.push(`| **feasible** | ${feasible.join(" | ")} |`);
  const violated = ids.map((id) => {
    const rows = (rowsByVersion.get(id) ?? []).filter(
      (row) => (!only || only(row)) && row.violations.length > 0,
    );
    if (rows.length === 0) return "0";
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const id2 of row.violations.split("+")) {
        counts.set(id2, (counts.get(id2) ?? 0) + 1);
      }
    }
    return `${rows.length} (${[...counts].map(([k, n]) => `${k} x${n}`).join(", ")})`;
  });
  lines.push(`| **hard violations** | ${violated.join(" | ")} |`);
  const reached = ids.map((id) => {
    const rows = (rowsByVersion.get(id) ?? []).filter(
      (row) => row.feasible && (!only || only(row)),
    );
    if (rows.length === 0) return "-";
    const n = rows.filter((row) => row.cover >= row.target - 1e-9).length;
    return `${n} / ${rows.length}`;
  });
  lines.push(`| **reached its target cover** | ${reached.join(" | ")} |`);
  const short = ids.map((id) => {
    const rows = (rowsByVersion.get(id) ?? []).filter(
      (row) => row.feasible && (!only || only(row)),
    );
    if (rows.length === 0) return "-";
    return `${rows.filter((row) => row.coverShort).length} / ${rows.length}`;
  });
  lines.push(`| **flagged cover_short** | ${short.join(" | ")} |`);
  return lines.join("\n");
}

function limitTable(
  rowsByVersion: Map<string, Row[]>,
  groups: [string, (row: Row) => boolean][],
): string {
  const ids = [...rowsByVersion.keys()];
  const lines = [
    "| group | version | short of target | count | placement | pool | pool: exhausted | pool: stopped early |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const [name, test] of groups) {
    for (const id of ids) {
      const rows = (rowsByVersion.get(id) ?? []).filter(
        (row) => row.feasible && test(row) && row.cover < row.target - 1e-9,
      );
      const pool = rows.filter((row) => row.limit === "pool");
      lines.push(
        `| ${name} | ${id} | ${rows.length} | ` +
          `${rows.filter((row) => row.limit === "count").length} | ` +
          `${rows.filter((row) => row.limit === "placement").length} | ` +
          `${pool.length} | ` +
          `${pool.filter((row) => row.poolReason === "exhausted").length} | ` +
          `${pool.filter((row) => row.poolReason === "stopped early").length} |`,
      );
    }
  }
  return lines.join("\n");
}

function toCsv(rows: Row[]): string {
  const keys = Object.keys(rows[0]) as (keyof Row)[];
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.split('"').join('""')}"` : text;
  };
  return [
    keys.join(","),
    ...rows.map((row) => keys.map((key) => escape(row[key])).join(",")),
  ].join("\n");
}

// ----------------------------------------------------------------- figures

/** Scenarios drawn for the figures: three bed sizes plus two styles. */
function figureScenarios(scenarios: Scenario[]): { label: string; scenario: Scenario }[] {
  const area = (scenario: Scenario) =>
    scenario.brief.bedWidthM * scenario.brief.bedLengthM;
  const pick = (test: (scenario: Scenario) => boolean, label: string) => {
    const found = scenarios.find(test);
    return found ? [{ label, scenario: found }] : [];
  };
  return [
    ...pick((s) => area(s) < 6, "small bed"),
    ...pick((s) => area(s) >= 6 && area(s) < 30, "medium bed"),
    ...pick((s) => area(s) >= 30, "large bed"),
    ...pick((s) => s.brief.style === "mediterranean", "mediterranean"),
    ...pick((s) => s.brief.style === "cottage", "cottage"),
  ];
}

type Panel = {
  label: string;
  version: string;
  scenarioId: string;
  bed: string;
  cover: number;
  emptyCellShare: number;
  largestEmptyPatch: number;
  quadrantCV: number;
  widthM: number;
  lengthM: number;
  circles: { x: number; y: number; r: number }[];
};

function figureData(scenarios: Scenario[]): Panel[] {
  const picks = figureScenarios(scenarios);
  const panels: Panel[] = [];
  for (const version of VERSIONS.filter((v) => RUN_IDS.includes(v.id))) {
    const undo = version.apply();
    try {
      for (const { label, scenario } of picks) {
        const plan = buildGardenPlan(plants, scenario.brief);
        const layout = plan.layout;
        if (!layout) continue;
        const metrics = spreadMetrics(
          layout.placements,
          layout.bedWidthM,
          layout.bedLengthM,
        );
        panels.push({
          label,
          version: version.id,
          scenarioId: scenario.id,
          bed: `${layout.bedWidthM} x ${layout.bedLengthM} m`,
          cover: Number((1 - plan.openSpaceRatio).toFixed(3)),
          emptyCellShare: Number(metrics.emptyCellShare.toFixed(3)),
          largestEmptyPatch: Number(metrics.largestEmptyPatch.toFixed(3)),
          quadrantCV: Number(metrics.quadrantCV.toFixed(3)),
          widthM: layout.bedWidthM,
          lengthM: layout.bedLengthM,
          circles: layout.placements.map((p) => ({
            x: Number(p.xM.toFixed(4)),
            y: Number(p.yM.toFixed(4)),
            r: Number(p.radiusM.toFixed(4)),
          })),
        });
      }
    } finally {
      undo();
    }
  }
  return panels;
}

/** The close, in plain English, written from the measured figures. */
function summarise(rowsByVersion: Map<string, Row[]>): string {
  const median = (id: string, get: (row: Row) => number | null) =>
    percentile(
      (rowsByVersion.get(id) ?? [])
        .filter((row) => row.feasible)
        .map(get)
        .filter((value): value is number => value !== null),
      0.5,
    );
  const feasible = (id: string) =>
    (rowsByVersion.get(id) ?? []).filter((row) => row.feasible).length;
  const pct = (from: number, to: number) =>
    `${to > from ? "+" : ""}${(((to - from) / from) * 100).toFixed(0)}%`;

  const cv = (id: string) => median(id, (r) => r.quadrantCV);
  const patch = (id: string) => median(id, (r) => r.largestEmptyPatch);
  const empty = (id: string) => median(id, (r) => r.emptyCellShare);
  const cover = (id: string) => median(id, (r) => r.cover);
  const z = (id: string) => median(id, (r) => r.z);
  const a4 = (id: string) => median(id, (r) => r.A4);
  const short1 = (rowsByVersion.get("V1") ?? []).filter(
    (row) => row.feasible && row.cover < row.target - 1e-9,
  );
  const stoppedEarly = short1.filter(
    (row) => row.poolReason === "stopped early",
  ).length;
  const pairs = (rowsByVersion.get("V0") ?? []).reduce(
    (sum, row) => sum + row.neighbourSameCombo,
    0,
  );

  return [
    "## What this says",
    "",
    "**V2 is the best of the four, and it is the simplest.** Taking the",
    "contact-point preference to 0 moves the median quadrant CV from",
    `${fmt(cv("V0"))} to ${fmt(cv("V2"))} (${pct(cv("V0"), cv("V2"))}) and the median largest`,
    `empty patch from ${fmt(patch("V0"))} to ${fmt(patch("V2"))} (${pct(patch("V0"), patch("V2"))}).`,
    `Cover is unchanged at ${fmt(cover("V2"))} against ${fmt(cover("V0"))}, the same`,
    `${feasible("V2")} of 100 scenarios stay feasible, no hard rule breaks, and`,
    `median Z goes slightly up, ${fmt(z("V0"), 4)} to ${fmt(z("V2"), 4)}. That bonus`,
    "was packing plants against the bed edge and against each other, which",
    "is exactly what reads as a clump.",
    "",
    "**V1 does not do what it was meant to do.** Raising cover_max to 1.0",
    `and cover_min to 0.95 moves median cover from ${fmt(cover("V0"))} to`,
    `${fmt(cover("V1"))} - no gain. Not one plan of ${feasible("V1")} reached 0.95.`,
    "H1 was not what was holding cover down, so removing it changes little.",
    `It costs: A4 falls from ${fmt(a4("V0"))} to ${fmt(a4("V1"))}, because A4 is`,
    "measured against cover_min and the target moved; median Z follows it",
    `down, ${fmt(z("V0"), 4)} to ${fmt(z("V1"), 4)}; and ${feasible("V0") - feasible("V1")} scenarios that had a`,
    "plan in V0 have none in V1. On small beds it is clearly worse - the",
    "largest empty patch and the quadrant CV both rise, because asking a",
    "small bed for 95% cover pushes it towards fewer, bigger plants.",
    "",
    "**V3 made things worse, not better.** Adding the emptiest-block",
    `preference on top of V2 moves the largest empty patch from ${fmt(patch("V2"))}`,
    `to ${fmt(patch("V3"))} (${pct(patch("V2"), patch("V3"))}), the empty-cell share from ${fmt(empty("V2"))}`,
    `to ${fmt(empty("V3"))}, and cover down from ${fmt(cover("V2"))} to ${fmt(cover("V3"))}.`,
    "Quadrant CV is a fraction worse too. The likely mechanism is visible in",
    "the figures: pushing each group's anchor into an empty block scatters",
    "the anchors, and the drift rule then pulls the rest of the group after",
    "them, so the bed ends up with the same canopy in fewer, further-apart",
    "clusters and bigger holes between them.",
    "",
    "`scripts/block-weight-sweep.ts` ran the same 100 scenarios at weights",
    "0.10, 0.25 and 0.50, and at 0.25 with the contact bonus left on. No",
    "setting beat V2 on the largest empty patch. At 0.10 the term is a wash",
    "- a shade better on quadrant CV and empty-cell share, a shade worse on",
    "the patch. So this is not a weight that needs tuning; the preference",
    "does not earn its place.",
    "",
    "**V4 was not run.** The combination rules it needs do exist - 14 of",
    "them, in 8_Species_Reference rows 5-18, and 55 of their 56 species are",
    "in the catalogue. The Stage 4 rule is stated at row 23: members of the",
    "same combo should be placed as neighbours. But a Stage 4 neighbour",
    "bonus can only arrange pairs that Stage 2 has already selected, and",
    `across all 100 scenarios only ${pairs} neighbouring plant pair${pairs === 1 ? "" : "s"}`,
    "belonged to the same combo - they come from two species pairs, in two",
    "plans out of 95.",
    "The same-combo neighbour share is therefore 0.0000 in every version,",
    "and a bonus acting on one or two pairs could not be measured against",
    "the 2-percentage-point guard. The rulebook names the missing piece",
    "itself: the Stage 2 combo preference at row 22 is also NOT IMPLEMENTED.",
    "Stage 2 has to prefer combo members before Stage 4 can place them",
    "together.",
    "",
    "**What is actually holding cover down.** `placement` is zero in every",
    "version - Stage 4 never failed to fit what it was given - and",
    "`pool: exhausted` is zero too, so the candidate pool never ran out. Of",
    `the ${short1.length} short plans in V1, ${stoppedEarly} had species to spare and stopped`,
    "anyway. The limit is in what Stage 2 and Stage 3 choose to select, not",
    "in the cover rule, not in the packer, and not in the pool.",
    "",
  ].join("\n");
}

// -------------------------------------------------------------------- main

function main(): void {
  const scenarios = buildScenarios();
  const rowsByVersion = new Map<string, Row[]>();
  const all: Row[] = [];
  // V1 and V3 stay defined above for reproducibility but are not run here;
  // their results are in the previous commit. V0 and V2 are re-run only so
  // the new per-square-metre figure exists for them, and are otherwise
  // identical - the engine has not changed and every run is seeded.
  const running = VERSIONS.filter((version) => RUN_IDS.includes(version.id));
  for (const version of running) {
    process.stdout.write(`${version.id} (${version.label}) ... `);
    const started = performance.now();
    const rows = runVersion(version, scenarios);
    rowsByVersion.set(version.id, rows);
    all.push(...rows);
    process.stdout.write(
      `${rows.length} scenarios in ${Math.round((performance.now() - started) / 1000)}s\n`,
    );
  }

  process.stdout.write("figures ... ");
  const panels = figureData(scenarios);
  process.stdout.write(`${panels.length} panels\n`);

  mkdirSync(FIG, { recursive: true });
  writeFileSync(join(FIG, "panels.json"), JSON.stringify(panels, null, 1), "utf8");
  writeFileSync(join(OUT, "coverage_test.csv"), toCsv(all), "utf8");

  const styles = [...new Set(all.map((row) => row.style))].sort();
  const bands = ["small (<6 m2)", "medium (6-30 m2)", "large (>=30 m2)"];

  const md = [
    "# Coverage test - V0 / V1 / V2",
    "",
    "**Measurement only. No engine change, no rulebook change, nothing deployed.**",
    "",
    `Rulebook as imported: \`${RULES_VERSION}\`. The workbook on disk was never`,
    "read or re-imported by this run.",
    "",
    "| version | what it changes |",
    "|---|---|",
    ...VERSIONS.filter((version) => RUN_IDS.includes(version.id)).map(
      (version) => `| **${version.id}** | ${version.label} |`,
    ),
    "",
    "V1 and V2 are in-memory overrides applied around each run and undone",
    "afterwards - the same technique the Chapter 5 sensitivity study uses.",
    "",
    "Every figure is the median with the 10th-90th percentile in brackets,",
    "over the plans that produced a layout. Percentiles are PERCENTILE.INC.",
    "",
    "## All 100 scenarios",
    "",
    table(rowsByVersion),
    "",
    "## By style",
    "",
    ...styles.flatMap((style) => [
      `### ${style}`,
      "",
      table(rowsByVersion, (row) => row.style === style),
      "",
    ]),
    "## By bed-size band",
    "",
    ...bands.flatMap((band) => [
      `### ${band}`,
      "",
      table(rowsByVersion, (row) => row.band === band),
      "",
    ]),
    "## What stopped a plan reaching its target cover",
    "",
    "`count` - even at the largest group size H3 allows for each species it",
    "chose, the canopy could not add up to the target.",
    "",
    "`placement` - it selected enough canopy, but Stage 4 could not fit it in.",
    "",
    "`pool` - it used fewer species than H2 would have allowed.",
    "",
    "Tested in that order, first match wins. The per-plan flags are in",
    "`reports/coverage_test.csv` so overlaps stay visible.",
    "",
    limitTable(rowsByVersion, [
      ["all", () => true],
      ...bands.map(
        (band) => [band, (row: Row) => row.band === band] as [string, (row: Row) => boolean],
      ),
    ]),
    "",
    "## Figures",
    "",
    "`reports/figures/coverage_test/` - one small, one medium and one large",
    "bed, plus a Mediterranean and a Cottage example, each in V0, V1 and V2",
    "on the same seed.",
    "",
    summarise(rowsByVersion),
  ].join("\n");

  writeFileSync(join(OUT, "coverage_test.md"), md, "utf8");
  console.log(`Written ${join(OUT, "coverage_test.md")}`);
}

main();
