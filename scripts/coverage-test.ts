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
const FIG = join(OUT, "figures", process.env.COVERAGE_OUT ?? "coverage_test");

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
  id: "V0" | "V1" | "V2" | "V3" | "V5" | "V6" | "V7" | "V8";
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

/** The versions this report compares. COVERAGE_RUN overrides it, e.g.
 * COVERAGE_RUN=V0,V2,V5,V7 for the V7 comparison. */
const RUN_IDS = (process.env.COVERAGE_RUN ?? "V0,V1,V2,V3,V5,V6").split(",").map((v) => v.trim());
/** Report name: reports/<name>.md and .csv, figures in reports/figures/<name>. */
const REPORT_NAME = process.env.COVERAGE_OUT ?? "coverage_test";

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
  {
    id: "V7",
    label: "contact 0, cover floor on beds of 6 m2 or more only",
    apply: () => {
      const placement = PLACEMENT as unknown as Record<string, unknown>;
      const search = SEARCH as unknown as Record<string, unknown>;
      const undo = [
        setPath(placement, "contactBonus", 0),
        setPath(search, "coverMinHard", true),
        setPath(search, "coverMinHardFromM2", 6),
      ];
      return () => undo.forEach((undoOne) => undoOne());
    },
    target: (style) => BASE_COVER[styleKeyOf(style)].coverMin,
  },
  {
    id: "V8",
    label: "contact 0, every style cover_min 0.80 as a hard floor, cover_max 1.0",
    apply: () => {
      const undo: (() => void)[] = [
        setPath(PLACEMENT as unknown as Record<string, unknown>, "contactBonus", 0),
        setPath(SEARCH as unknown as Record<string, unknown>, "coverMinHard", true),
      ];
      for (const key of Object.keys(styleRules)) {
        const style = styleRules[key] as unknown as Record<string, unknown>;
        undo.push(setPath(style, "coverMin", 0.8));
        undo.push(setPath(style, "coverMax", 1.0));
      }
      return () => undo.forEach((undoOne) => undoOne());
    },
    target: () => 0.8,
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

/** The close: a decision aid, written from the measured figures. */
function summarise(rowsByVersion: Map<string, Row[]>): string {
  const ids = [...rowsByVersion.keys()];
  const feasibleRows = (id: string) =>
    (rowsByVersion.get(id) ?? []).filter((row) => row.feasible);
  const median = (id: string, get: (row: Row) => number | null) =>
    percentile(
      feasibleRows(id)
        .map(get)
        .filter((value): value is number => value !== null),
      0.5,
    );
  const count = (id: string, test: (row: Row) => boolean) =>
    feasibleRows(id).filter(test).length;
  const pct = (from: number, to: number) =>
    `${to > from ? "+" : ""}${(((to - from) / from) * 100).toFixed(0)}%`;

  /** The version(s) with the best median on one measure, ties included -
   * picking the first of a tie would credit one version with a result two
   * share. */
  const best = (get: (row: Row) => number | null, lowerIsBetter: boolean) => {
    const values = ids.map((id) => ({ id, value: median(id, get) }));
    const top = values.reduce(
      (acc, v) => (lowerIsBetter ? Math.min(acc, v.value) : Math.max(acc, v.value)),
      lowerIsBetter ? Infinity : -Infinity,
    );
    const winners = values.filter((v) => Math.abs(v.value - top) < 5e-4).map((v) => v.id);
    return winners.length === 1 ? winners[0] : `${winners.join(" and ")}, tied at ${fmt(top)}`;
  };

  const cv = (r: Row) => r.quadrantCV;
  const patch = (r: Row) => r.largestEmptyPatch;
  const full = (r: Row) => r.cellsFull;
  const empty = (r: Row) => r.emptyCellShare;
  const z = (r: Row) => r.z;

  const row = (id: string) =>
    `| **${id}** | ${fmt(median(id, (r) => r.cover))} | ${fmt(median(id, empty))} | ` +
    `${fmt(median(id, patch))} | ${fmt(median(id, full))} | ${fmt(median(id, cv))} | ` +
    `${fmt(median(id, z), 4)} | ${fmt(median(id, (r) => r.A1))} | ${fmt(median(id, (r) => r.A4))} | ` +
    `${feasibleRows(id).length} | ${count(id, (r) => r.cover >= r.target - 1e-9)} | ` +
    `${count(id, (r) => r.coverShort)} | ${fmt(median(id, (r) => r.plants), 0)} | ` +
    `${fmt(median(id, (r) => r.ms), 0)} |`;

  const v0cv = median("V0", cv);
  const v0patch = median("V0", patch);
  const v0z = median("V0", z);

  return [
    "## Decision table",
    "",
    "Medians over plans that produced a layout. The best on each measure is",
    "named under the table, with ties shown. Lower is better for empty share,",
    "largest patch and quadrant CV; higher",
    "is better for cover, square metres at least half planted, Z, A1 and A4.",
    "",
    "| | cover | empty | largest patch | m2 >=50% | quadrant CV | Z | A1 | A4 | feasible | reached target | cover_short | plants | ms |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...ids.map(row),
    "",
    `Best on each spatial measure: quadrant CV **${best(cv, true)}**, largest empty`,
    `patch **${best(patch, true)}**, empty-cell share **${best(empty, true)}**, square`,
    `metres at least half planted **${best(full, false)}**. Highest Z: **${best(z, false)}**.`,
    "",
    "Note that \"reached target\" is not comparable across every column: V1",
    "asks for 0.95 cover where the others ask for the style's cover_min.",
    "",
    "## What each version does, and what it costs",
    "",
    "**V2 - contact bonus 0 (D26).** The simplest change, and the base for V3,",
    "V5 and V6. Against V0 it moves quadrant CV",
    `${fmt(v0cv)} to ${fmt(median("V2", cv))} (${pct(v0cv, median("V2", cv))}) and the largest`,
    `empty patch ${fmt(v0patch)} to ${fmt(median("V2", patch))} (${pct(v0patch, median("V2", patch))}),`,
    `with Z ${fmt(v0z, 4)} to ${fmt(median("V2", z), 4)} and no loss of feasibility. The`,
    "contact bonus was packing plants against the bed edge and each other,",
    "which is what reads as a clump.",
    "",
    "**V1 - cover_max 1.0, cover_min 0.95.** Does not work. Median cover",
    `${fmt(median("V0", (r) => r.cover))} to ${fmt(median("V1", (r) => r.cover))}, and`,
    `${count("V1", (r) => r.cover >= 0.95 - 1e-9)} plans of ${feasibleRows("V1").length} reach 0.95.`,
    "H1 was never the limit. It costs A4, because A4 is measured against",
    `cover_min and the target moved (${fmt(median("V0", (r) => r.A4))} to`,
    `${fmt(median("V1", (r) => r.A4))}), and ${feasibleRows("V0").length - feasibleRows("V1").length}`,
    "feasible scenario(s).",
    "",
    `**V3 - V2 plus the emptiest-block preference.** ${median("V3", patch) > median("V2", patch) ? "Worse" : "No better"} than V2 on the`,
    `largest empty patch (${fmt(median("V2", patch))} to ${fmt(median("V3", patch))}). Pushing`,
    "each group's anchor into an empty block scatters the anchors, and the",
    "drift rule then drags each group after its anchor. The weight sweep",
    "(scripts/block-weight-sweep.ts) found no weight that beats V2.",
    "",
    "**V5 - V2 plus cover_min as a hard floor in Stage 2/3.** Feasible plans:",
    `${feasibleRows("V5").length}, against ${feasibleRows("V2").length} for V2. Plans reaching the target:`,
    `${count("V5", (r) => r.cover >= r.target - 1e-9)}, against ${count("V2", (r) => r.cover >= r.target - 1e-9)}. In`,
    `${count("V5", (r) => r.coverShort)} of ${feasibleRows("V5").length} no selection could reach the floor, so the`,
    "densest one found is used and flagged cover_short. Median cover barely",
    `moves (${fmt(median("V2", (r) => r.cover))} to ${fmt(median("V5", (r) => r.cover))}) because`,
    "the search already aims at cover_min - A4 saturates there, so it had no",
    "reason to go further - and because what falls short is lost in",
    "placement, when groups shrink to fit. It costs height balance:",
    `A1 ${fmt(median("V2", (r) => r.A1))} to ${fmt(median("V5", (r) => r.A1))}, and Z`,
    `${fmt(median("V2", z), 4)} to ${fmt(median("V5", z), 4)}.`,
    "",
    "**V6 - V5 plus gap fill.** Adds plants of a ground cover or matrix",
    "species already in the plan, two at a time, into square metres under",
    "half canopy, and stops at the 50% mark, at H1, or at H5 - whichever",
    "comes first. Which one stopped it is not recorded per plan; in the one",
    "bed traced by hand it was H5, because the filler is already one of the",
    "bigger groups and a few more plants push it to the share limit.",
    `Median plants ${fmt(median("V5", (r) => r.plants), 0)} to`,
    `${fmt(median("V6", (r) => r.plants), 0)}; run time ${fmt(median("V5", (r) => r.ms), 0)} ms to`,
    `${fmt(median("V6", (r) => r.ms), 0)} ms. It never introduces a species and never`,
    "breaks P1, P2, H1 or H5.",
    "",
    "## What stops a bed reaching its target cover",
    "",
    "**Corrected 13 October.** This section used to say Stage 4 fits what",
    "it is given. That was wrong: the `placement` check looked only at each",
    "plan's final mix, which the fail rule had already cut down, so it hid",
    "every failed attempt. Measured directly (scripts/coverage-wall.ts), the",
    "packer cannot fit the first mix the search picks in 57 of 95 plans",
    "under today's rules, and in 71 of 93 with every style forced to an 80%",
    "floor. Each time, the fail rule lowers the cover ceiling and searches",
    "again, so the plan comes out sparser than the search intended. Turning",
    "off H5 or doubling H2 does not help. The limit on cover is the packer",
    "and the fail rule's response to it - which is why V1, which only raises",
    "the target, changes nothing. The candidate pool never runs out.",
    "",
    "## V4 was not run",
    "",
    "The combination rules exist - 14 combos in 8_Species_Reference rows",
    "5-18, the Stage 4 rule at row 23 - and 55 of their 56 species are in the",
    "catalogue. But Stage 2 selects same-combo species together in only 2",
    "plans of 95, so a Stage 4 neighbour bonus has almost nothing to act on",
    "and could not be measured against the 2-point guard. The Stage 2 half",
    "(row 22) is also NOT IMPLEMENTED; it has to come first.",
    "",
  ].join("\n");
}

/** The V7 close: does turning the floor off for small beds keep V5's gain
 * on medium and large beds without its damage on small ones? Every
 * comparison is computed from the run. */
function summariseV7(rowsByVersion: Map<string, Row[]>): string {
  const ids = [...rowsByVersion.keys()];
  const rowsOf = (id: string, only?: (row: Row) => boolean) =>
    (rowsByVersion.get(id) ?? []).filter((row) => row.feasible && (!only || only(row)));
  const med = (id: string, get: (row: Row) => number | null, only?: (row: Row) => boolean) =>
    percentile(
      rowsOf(id, only)
        .map(get)
        .filter((value): value is number => value !== null),
      0.5,
    );
  const count = (id: string, test: (row: Row) => boolean, only?: (row: Row) => boolean) =>
    rowsOf(id, only).filter(test).length;
  const patch = (r: Row) => r.largestEmptyPatch;
  const cv = (r: Row) => r.quadrantCV;
  const full = (r: Row) => r.cellsFull;
  const z = (r: Row) => r.z;
  const reached = (r: Row) => r.cover >= r.target - 1e-9;
  const small = (r: Row) => r.bedAreaM2 < 6;
  const notSmall = (r: Row) => r.bedAreaM2 >= 6;
  const better = (a: number, b: number, lower: boolean) =>
    Math.abs(a - b) < 5e-4 ? "level with" : (lower ? a < b : a > b) ? "better than" : "worse than";

  const tableRow = (id: string) =>
    `| **${id}** | ${fmt(med(id, (r) => r.cover))} | ${fmt(med(id, (r) => r.emptyCellShare))} | ` +
    `${fmt(med(id, patch))} | ${fmt(med(id, full))} | ${fmt(med(id, cv))} | ${fmt(med(id, z), 4)} | ` +
    `${fmt(med(id, (r) => r.A1))} | ${fmt(med(id, (r) => r.A4))} | ${rowsOf(id).length} | ` +
    `${count(id, reached)} | ${count(id, (r) => r.coverShort)} | ${fmt(med(id, (r) => r.plants), 0)} | ` +
    `${fmt(med(id, (r) => r.ms), 0)} |`;

  const bandLine = (name: string, only: (row: Row) => boolean) =>
    `| ${name} | ${ids.map((id) => `${fmt(med(id, patch, only))} / ${fmt(med(id, cv, only))}`).join(" | ")} |`;

  /** Do two versions build the same plan for every scenario in a group? */
  const identical = (a: string, b: string, only: (row: Row) => boolean) => {
    const byId = new Map((rowsByVersion.get(b) ?? []).map((row) => [row.id, row]));
    const group = (rowsByVersion.get(a) ?? []).filter(only);
    const differ = group.filter((row) => {
      const other = byId.get(row.id);
      return !other || other.z !== row.z || other.cover !== row.cover || other.plants !== row.plants;
    });
    return differ.length === 0
      ? `all ${group.length} identical to ${b}`
      : `${differ.length} of ${group.length} differ from ${b} (${differ.map((row) => row.id).join(", ")})`;
  };

  const v7SmallPatch = med("V7", patch, small);
  const v2SmallPatch = med("V2", patch, small);
  const v5SmallPatch = med("V5", patch, small);
  const v7BigPatch = med("V7", patch, notSmall);
  const v5BigPatch = med("V5", patch, notSmall);
  const v2BigPatch = med("V2", patch, notSmall);

  return [
    "## Decision table",
    "",
    "Medians over plans that produced a layout. Lower is better for empty",
    "share, largest patch and quadrant CV; higher for cover, square metres",
    "at least half planted, Z, A1 and A4.",
    "",
    "| | cover | empty | largest patch | m2 >=50% | quadrant CV | Z | A1 | A4 | feasible | reached target | cover_short | plants | ms |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...ids.map(tableRow),
    "",
    "## Largest empty patch / quadrant CV, by bed size",
    "",
    `| bed | ${ids.join(" | ")} |`,
    `|---|${ids.map(() => "---").join("|")}|`,
    bandLine("small (<6 m2)", small),
    bandLine("medium (6-30 m2)", (r) => r.bedAreaM2 >= 6 && r.bedAreaM2 < 30),
    bandLine("large (>=30 m2)", (r) => r.bedAreaM2 >= 30),
    "",
    "## What V7 does",
    "",
    "V7 is V5 with the cover floor switched off for beds under 6 m2. The",
    "question it answers: does that keep V5's gain on medium and large beds",
    "while removing the damage V5 did to small ones?",
    "",
    `**Small beds.** V7's largest empty patch is ${fmt(v7SmallPatch)}, ${better(v7SmallPatch, v5SmallPatch, true)} V5`,
    `(${fmt(v5SmallPatch)}) and ${better(v7SmallPatch, v2SmallPatch, true)} V2 (${fmt(v2SmallPatch)}). With no floor and`,
    "the same seeds, a small bed under V7 should be built exactly as V2 builds",
    `it. Checked scenario by scenario: ${identical("V7", "V2", small)}.`,
    "",
    `**Beds of 6 m2 or more.** V7's largest empty patch is ${fmt(v7BigPatch)}, ${better(v7BigPatch, v5BigPatch, true)}`,
    `V5 (${fmt(v5BigPatch)}) and ${better(v7BigPatch, v2BigPatch, true)} V2 (${fmt(v2BigPatch)}). On these beds V7 and V5`,
    `apply the same rule with the same seeds. Checked: ${identical("V7", "V5", notSmall)}.`,
    "So V7 is an exact splice - V2 on small beds, V5 on the rest - and its",
    "figures are what that splice gives, not a new behaviour.",
    "",
    `**Cost.** Median Z ${fmt(med("V2", z), 4)} for V2, ${fmt(med("V5", z), 4)} for V5, ${fmt(med("V7", z), 4)} for V7.`,
    `Beds reaching their target: V2 ${count("V2", reached)}, V5 ${count("V5", reached)}, V7 ${count("V7", reached)}.`,
    `Flagged cover_short: V5 ${count("V5", (r) => r.coverShort)}, V7 ${count("V7", (r) => r.coverShort)}.`,
    "",
    "Only 5 scenarios are small beds, so the small-bed figures are a",
    "warning sign rather than a measurement.",
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
  writeFileSync(join(OUT, `${REPORT_NAME}.csv`), toCsv(all), "utf8");

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
    RUN_IDS.includes("V7") ? summariseV7(rowsByVersion) : summarise(rowsByVersion),
  ].join("\n");

  writeFileSync(join(OUT, `${REPORT_NAME}.md`), md, "utf8");
  console.log(`Written ${join(OUT, `${REPORT_NAME}.md`)}`);
}

main();
