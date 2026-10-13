/**
 * Final engine run: the 100 batch scenarios, every option, one CSV row
 * per scenario and option. Used for the baseline (before the final engine
 * changes) and the after run, with the same seeds.
 *
 * Every row carries the rulebook and dataset hashes it was run on.
 *
 * Run: FINAL_OUT=final_baseline node --experimental-strip-types scripts/final-run.ts
 * Writes: reports/<FINAL_OUT>.csv
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { plants } from "../app/data/plants.ts";
import { DATASET_VERSION } from "../app/data/datasetVersion.ts";
import {
  areaBandIndex,
  buildGardenPlanVariants,
  minCentreDistance,
  pickedColours,
  RULES,
  RULES_VERSION,
  type GardenPlan,
} from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { spreadMetrics } from "./batch-test/metrics.ts";
import { bindingLimit, neighbourPairs } from "./batch-test/plan-metrics.ts";

const OUT = join("reports", `${process.env.FINAL_OUT ?? "final_run"}.csv`);
const BANDS = ["small", "medium", "large"];
const byId = new Map(plants.map((plant) => [plant.id, plant]));
const styleKey = (style: string) => (style === "undecided" ? "generic" : style);

/** Engine hard checks that failed (Stage 2 on the selection, Stage 4 on
 * placement), plus an independent P1/P2 pass over the coordinates,
 * reported as P1* and P2*. */
function hardFailures(plan: GardenPlan): string[] {
  const out: string[] = [];
  for (const check of plan.engine?.hard ?? []) if (!check.pass) out.push(check.id);
  for (const check of plan.engine?.placementChecks ?? []) {
    if (check.kind === "hard" && !check.pass) out.push(check.id);
  }
  const layout = plan.layout;
  if (layout) {
    const list = layout.placements;
    if (
      list.some(
        (p) =>
          p.xM - p.radiusM < -1e-6 ||
          p.yM - p.radiusM < -1e-6 ||
          p.xM + p.radiusM > layout.bedWidthM + 1e-6 ||
          p.yM + p.radiusM > layout.bedLengthM + 1e-6,
      )
    ) {
      out.push("P1*");
    }
    outer: for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (Math.hypot(a.xM - b.xM, a.yM - b.yM) < minCentreDistance(a.radiusM, b.radiusM) - 1e-6) {
          out.push("P2*");
          break outer;
        }
      }
    }
  }
  return [...new Set(out)];
}

const r = (value: number | null | undefined, dp = 4) =>
  value === null || value === undefined || !Number.isFinite(value) ? "" : Number(value.toFixed(dp));

type Row = Record<string, string | number | boolean>;
const rows: Row[] = [];
const started = performance.now();

for (const scenario of buildScenarios()) {
  const { brief } = scenario;
  const area = brief.bedWidthM * brief.bedLengthM;
  const coloursChosen = pickedColours(brief.colour).length > 0;
  const target = RULES.styles[styleKey(brief.style) as keyof typeof RULES.styles].coverMin;
  const t0 = performance.now();
  const variants = buildGardenPlanVariants(plants, brief);
  const ms = performance.now() - t0;

  variants.forEach((plan, index) => {
    const layout = plan.layout;
    const feasible = plan.status === "provisional-plan" && layout !== null;
    const quantities = plan.quantities?.quantities ?? [];
    const plantCount = quantities.reduce((sum, q) => sum + q.quantity, 0);
    const unknown = quantities.filter((q) => (byId.get(q.id)?.flowerColour ?? []).length === 0);
    const metrics = layout
      ? spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM)
      : null;
    const goals = plan.engine?.goals;
    const limit = feasible ? bindingLimit(plan, target) : null;
    const cover = feasible ? 1 - plan.openSpaceRatio : null;
    rows.push({
      rulebook: RULES_VERSION,
      dataset: DATASET_VERSION,
      scenario: scenario.id,
      block: scenario.block,
      style: brief.style,
      bed: `${brief.bedWidthM}x${brief.bedLengthM}`,
      area_m2: r(area, 2),
      band: BANDS[areaBandIndex(area)],
      wind: brief.wind,
      viewing_edge: brief.viewingEdge ?? "north",
      colours_chosen: coloursChosen,
      option: index + 1,
      options_found: variants.length,
      character: plan.character,
      seed: plan.seed,
      status: plan.status,
      pool_size: plan.counts.candidate,
      species: quantities.length,
      plants: plantCount,
      cover: r(cover),
      cover_target: target,
      empty_cell_share: r(metrics?.emptyCellShare),
      largest_empty_patch: r(metrics?.largestEmptyPatch),
      quadrant_cv: r(metrics?.quadrantCV),
      unknown_colour_share:
        coloursChosen && plantCount > 0
          ? r(unknown.reduce((sum, q) => sum + q.quantity, 0) / plantCount)
          : "",
      unknown_colour_species_share:
        coloursChosen && quantities.length > 0 ? r(unknown.length / quantities.length) : "",
      z: r(plan.engine?.z),
      s_bar: r(plan.engine?.sBar),
      A1: r(goals?.A1),
      A2: r(goals?.A2),
      A3: r(goals?.A3),
      A4: r(goals?.A4),
      A5: r(goals?.A5),
      wind_profile: plan.engine?.windProfile ?? "",
      hard_failures: feasible ? hardFailures(plan).join("+") : "",
      unplaced: layout?.unplaced.length ?? 0,
      neighbour_pairs: layout ? neighbourPairs(layout).pairs : "",
      binding_limit: limit && cover !== null && cover < target - 1e-9 ? limit.limit : "-",
      pool_reason: limit?.poolReason ?? "-",
      brief_ms: Math.round(ms),
    });
  });
}

const keys = Object.keys(rows[0]);
const escape = (value: unknown) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
writeFileSync(
  OUT,
  [keys.join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n") + "\n",
  "utf8",
);
console.log(
  `rulebook ${RULES_VERSION} | dataset ${DATASET_VERSION} | ${rows.length} rows from 100 scenarios | ${Math.round((performance.now() - started) / 1000)}s -> ${OUT}`,
);
