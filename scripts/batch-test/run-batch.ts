/**
 * Batch verification: run all 100 scenarios through the real engine and
 * report what came back.
 *
 * There is no adapter layer. This calls buildGardenPlan and
 * buildGardenPlanVariants directly, the same functions the app calls, so
 * there is nothing between the test and the engine that could disagree
 * with it.
 *
 * Two kinds of check run on every scenario:
 *
 *   1. What the engine says about itself - engine.hard (H1-H5) and the
 *      hard entries of engine.placementChecks (P1-P14).
 *   2. An INDEPENDENT geometry check, recomputed here from the placement
 *      coordinates: no circle outside the bed, no pair closer than
 *      minCentreDistance, and cover within the style's limit. If (1) and
 *      (2) ever disagree, the engine is reporting a pass it did not earn -
 *      which is exactly what a verification run is for.
 *
 * Every threshold comes from RULES / engineConfig, never from a constant
 * typed in this file. A harness with its own tolerance would be testing a
 * different engine.
 *
 * Run: npm run test:batch
 * Writes: scripts/batch-test/results/results.csv and summary.txt
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { plants } from "../../app/data/plants.ts";
import {
  buildGardenPlan,
  buildGardenPlanVariants,
  minCentreDistance,
  P2_OVERLAP_TOLERANCE,
  RULES,
  type GardenPlan,
} from "../../app/lib/planning/index.ts";
import {
  areaBandIndex,
  MIN_GROUPED_SHARE,
  SINGLETON_K_BY_BAND,
} from "../../app/lib/planning/index.ts";
import { buildScenarios, LOCATION_COUNT, type Scenario } from "./scenarios.ts";
import { spreadMetrics } from "./metrics.ts";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "results");

/** A run slower than this is reported as SLOW; it is a reporting
 * threshold, not a hard limit, so a slow plan is still checked. */
const SLOW_MS = 3000;
/** Above this, the run is abandoned as TIMEOUT. */
const TIMEOUT_MS = 30000;
/** Two options sharing more than this fraction of their species are too
 * alike to be offered as alternatives (Jaccard similarity). */
const MAX_OPTION_SIMILARITY = 0.6;

type ResultCode =
  | "SUCCESS"
  | "SUCCESS_DEGRADED"
  | "INFEASIBLE_ENV"
  | "INFEASIBLE_SPACE"
  | "CONSTRAINT_FAIL"
  | "SLOW"
  | "ERROR"
  | "TIMEOUT";

type Row = {
  id: string;
  block: string;
  label: string;
  place: string;
  sun: string;
  water: string;
  soil: string;
  wind: string;
  style: string;
  bed: string;
  bedAreaM2: number;
  biomes: string;
  extras: string;
  colour: string;
  repeatChecked: "yes" | "no";
  repeatMatched: string;
  code: ResultCode;
  ms: number;
  species: number;
  plantsPlaced: number;
  unplaced: number;
  coverRatio: number;
  coverLimit: number;
  /** How evenly the cover is spread - see metrics.ts. Measurement only. */
  emptyCellShare: number;
  largestEmptyPatch: number;
  quadrantCV: number;
  z: number | null;
  options: number;
  maxSimilarity: number | null;
  variety: "ok" | "low" | "same-species" | "n/a";
  droppedSpecies: number;
  singleton_groups: number;
  all_same_size: string;
  plants_per_species: number;
  failures: string;
  notes: string;
};

/** The style's maximum cover, i.e. 1 - the minimum open space (A4). */
function coverLimitFor(plan: GardenPlan): number {
  const style = plan.brief.style === "undecided" ? "generic" : plan.brief.style;
  const styleRules = (RULES.styles as Record<string, { coverMin?: number; coverMax?: number }>)[style];
  return styleRules?.coverMax ?? styleRules?.coverMin ?? 1;
}

/**
 * Re-derive the geometry from the placement coordinates. Deliberately
 * does not consult engine.placementChecks - the point is to arrive at the
 * answer separately and compare.
 */
function verifyGeometry(plan: GardenPlan): string[] {
  const failures: string[] = [];
  const layout = plan.layout;
  if (!layout) return failures;

  const { placements, bedWidthM, bedLengthM } = layout;

  for (const p of placements) {
    const outside =
      p.xM - p.radiusM < -1e-6 ||
      p.yM - p.radiusM < -1e-6 ||
      p.xM + p.radiusM > bedWidthM + 1e-6 ||
      p.yM + p.radiusM > bedLengthM + 1e-6;
    if (outside) {
      failures.push(
        `out-of-bounds:${p.plantId}@(${p.xM.toFixed(2)},${p.yM.toFixed(2)})r${p.radiusM.toFixed(2)}`,
      );
    }
  }

  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      const distance = Math.hypot(a.xM - b.xM, a.yM - b.yM);
      const minimum = minCentreDistance(a.radiusM, b.radiusM);
      if (distance < minimum - 1e-6) {
        failures.push(
          `overlap:${a.plantId}/${b.plantId} ${distance.toFixed(3)}m < ${minimum.toFixed(3)}m`,
        );
      }
    }
  }

  // H3b, recomputed here rather than trusting engine.hard: at most
  // MIN(k_band, FLOOR((1 - min_grouped_share) x S)) single-plant groups.
  const groups = plan.quantities?.quantities ?? [];
  if (groups.length > 0) {
    const singles = groups.filter((q) => q.quantity === 1).length;
    const limit = Math.min(
      SINGLETON_K_BY_BAND[areaBandIndex(plan.bedAreaM2)] ?? 0,
      Math.floor((1 - MIN_GROUPED_SHARE) * groups.length),
    );
    if (singles > limit) {
      failures.push(`H3b: ${singles} single-plant groups of ${groups.length} species, limit ${limit}`);
    }
  }

  const cover = 1 - plan.openSpaceRatio;
  const limit = coverLimitFor(plan);
  if (cover > limit + 1e-6) {
    failures.push(`over-planted: cover ${cover.toFixed(3)} > ${limit.toFixed(3)}`);
  }

  return failures;
}

/** Jaccard similarity of two options' species sets. */
function similarity(a: GardenPlan, b: GardenPlan): number {
  const setA = new Set((a.quantities?.quantities ?? []).map((q) => q.id));
  const setB = new Set((b.quantities?.quantities ?? []).map((q) => q.id));
  if (setA.size === 0 && setB.size === 0) return 1;
  let shared = 0;
  for (const id of setA) if (setB.has(id)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

function classify(
  plan: GardenPlan,
  engineFailures: string[],
  geometryFailures: string[],
  ms: number,
): ResultCode {
  if (engineFailures.length > 0 || geometryFailures.length > 0) return "CONSTRAINT_FAIL";
  if (plan.status === "no-plan") {
    // Told apart by what actually ran out: candidates, or room.
    const noCandidates = plan.counts.candidate === 0;
    return noCandidates ? "INFEASIBLE_ENV" : "INFEASIBLE_SPACE";
  }
  if (ms > SLOW_MS) return "SLOW";
  const degraded =
    (plan.engine?.dropped.length ?? 0) > 0 ||
    (plan.layout?.unplaced.length ?? 0) > 0 ||
    plan.layout?.status === "partial";
  return degraded ? "SUCCESS_DEGRADED" : "SUCCESS";
}

function runOne(scenario: Scenario): Row {
  const { brief } = scenario;
  const base: Row = {
    id: scenario.id,
    block: scenario.block,
    label: scenario.label,
    place: scenario.place,
    sun: brief.sun,
    water: brief.water,
    soil: brief.soil,
    wind: brief.wind,
    style: brief.style,
    bed: `${brief.bedWidthM}x${brief.bedLengthM}`,
    bedAreaM2: Number((brief.bedWidthM * brief.bedLengthM).toFixed(2)),
    biomes: brief.biomes.join("; "),
    extras: brief.extras.join("; ") || "none",
    colour:
      brief.colour.mode === "none"
        ? "none"
        : brief.colour.mode === "scheme"
          ? `scheme:${brief.colour.scheme}`
          : `custom:${brief.colour.colours.join("/")}`,
    repeatChecked: "no",
    repeatMatched: "",
    code: "ERROR",
    ms: 0,
    species: 0,
    plantsPlaced: 0,
    unplaced: 0,
    coverRatio: 0,
    coverLimit: 0,
    emptyCellShare: 1,
    largestEmptyPatch: 1,
    quadrantCV: 0,
    z: null,
    options: 0,
    maxSimilarity: null,
    variety: "n/a",
    droppedSpecies: 0,
    singleton_groups: 0,
    all_same_size: "no",
    plants_per_species: 0,
    failures: "",
    notes: "",
  };

  const started = performance.now();
  try {
    const plan = buildGardenPlan(plants, brief);
    const ms = performance.now() - started;
    if (ms > TIMEOUT_MS) return { ...base, code: "TIMEOUT", ms: Math.round(ms) };

    const engineFailures = [
      ...(plan.engine?.hard ?? []).filter((c) => !c.pass).map((c) => `${c.id}:${c.detail}`),
      ...(plan.engine?.placementChecks ?? [])
        .filter((c) => c.kind === "hard" && !c.pass)
        .map((c) => `${c.id}:${c.detail}`),
    ];
    const geometryFailures = verifyGeometry(plan);

    // The three options must be distinct enough to be worth offering.
    const variants = plan.status === "provisional-plan" ? buildGardenPlanVariants(plants, brief) : [];
    let maxSimilarity: number | null = null;
    for (let i = 0; i < variants.length; i += 1) {
      for (let j = i + 1; j < variants.length; j += 1) {
        const value = similarity(variants[i], variants[j]);
        maxSimilarity = maxSimilarity === null ? value : Math.max(maxSimilarity, value);
      }
    }
    // Deliberately NOT a constraint failure. The engine's own test for a
    // distinct option is an exact species+quantity signature, so two
    // options may share every species and differ only in how many of each
    // (similarity 1.00). Whether that is enough variety to be worth
    // showing as "Option 1 / 2 / 3" is an owner decision, not a rule the
    // engine breaks, so it is reported separately.
    const variety: Row["variety"] =
      maxSimilarity === null ? "n/a" : maxSimilarity >= 1 ? "same-species" : maxSimilarity > MAX_OPTION_SIMILARITY ? "low" : "ok";

    return {
      ...base,
      code: classify(plan, engineFailures, geometryFailures, ms),
      ms: Math.round(ms),
      species: plan.quantities?.quantities.length ?? 0,
      plantsPlaced: plan.layout?.placements.length ?? 0,
      unplaced: plan.layout?.unplaced.length ?? 0,
      coverRatio: Number((1 - plan.openSpaceRatio).toFixed(3)),
      coverLimit: Number(coverLimitFor(plan).toFixed(3)),
      ...(() => {
        const layout = plan.layout;
        if (!layout) return { emptyCellShare: 1, largestEmptyPatch: 1, quadrantCV: 0 };
        const m = spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM);
        return {
          emptyCellShare: Number(m.emptyCellShare.toFixed(3)),
          largestEmptyPatch: Number(m.largestEmptyPatch.toFixed(3)),
          quadrantCV: Number(m.quadrantCV.toFixed(3)),
        };
      })(),
      z: plan.engine ? Number(plan.engine.z.toFixed(4)) : null,
      options: variants.length,
      maxSimilarity: maxSimilarity === null ? null : Number(maxSimilarity.toFixed(3)),
      variety,
      droppedSpecies: plan.engine?.dropped.length ?? 0,
      singleton_groups: (plan.quantities?.quantities ?? []).filter((q) => q.quantity === 1).length,
      all_same_size:
        (plan.quantities?.quantities.length ?? 0) > 1 &&
        new Set(plan.quantities!.quantities.map((q) => q.quantity)).size === 1
          ? "yes"
          : "no",
      plants_per_species: Number(
        (
          (plan.quantities?.totalPlants ?? 0) /
          Math.max(1, plan.quantities?.quantities.length ?? 1)
        ).toFixed(2),
      ),
      failures: [...engineFailures, ...geometryFailures].join(" | "),
      notes: plan.status === "no-plan" ? plan.diagnostics.join(" | ") : "",
    };
  } catch (error) {
    return {
      ...base,
      code: "ERROR",
      ms: Math.round(performance.now() - started),
      failures: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

/** The first ten scenarios, run again, must come back identical. */
function repeatabilityCheck(scenarios: Scenario[]): { checked: number; mismatches: string[] } {
  const mismatches: string[] = [];
  const subset = scenarios.slice(0, 10);
  for (const scenario of subset) {
    const first = buildGardenPlan(plants, scenario.brief);
    const second = buildGardenPlan(plants, scenario.brief);
    const fingerprint = (plan: GardenPlan) =>
      JSON.stringify({
        status: plan.status,
        seed: plan.seed,
        species: (plan.quantities?.quantities ?? []).map((q) => [q.id, q.quantity]),
        placements: (plan.layout?.placements ?? []).map((p) => [
          p.plantId,
          p.xM.toFixed(4),
          p.yM.toFixed(4),
          p.radiusM.toFixed(4),
        ]),
      });
    if (fingerprint(first) !== fingerprint(second)) mismatches.push(scenario.id);
  }
  return { checked: subset.length, mismatches };
}

function toCsv(rows: Row[]): string {
  const headers = Object.keys(rows[0]) as (keyof Row)[];
  const escape = (value: unknown) => {
    const text = value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

/** Success rate broken down by one field, for the summary. */
function breakdown(rows: Row[], key: keyof Row): string[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const value = String(row[key]);
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, group]) => {
      const ok = group.filter((r) => r.code === "SUCCESS" || r.code === "SUCCESS_DEGRADED").length;
      const percent = ((ok / group.length) * 100).toFixed(0);
      return `    ${value.padEnd(24)} ${String(ok).padStart(3)}/${String(group.length).padEnd(3)} (${percent}%)`;
    });
}

function main(): void {
  const scenarios = buildScenarios();
  console.log(
    `Running ${scenarios.length} scenarios against the live engine ` +
      `(${plants.length.toLocaleString()} plants, rules from ${RULES.source}, ` +
      `${LOCATION_COUNT} locations, P2 overlap ${P2_OVERLAP_TOLERANCE})\n`,
  );

  const rows: Row[] = [];
  for (const scenario of scenarios) {
    const row = runOne(scenario);
    rows.push(row);
    const mark = row.code.startsWith("SUCCESS") ? "." : row.code === "CONSTRAINT_FAIL" ? "X" : "!";
    process.stdout.write(mark);
    if (rows.length % 50 === 0) process.stdout.write(` ${rows.length}\n`);
  }
  process.stdout.write("\n\n");

  const repeat = repeatabilityCheck(scenarios);
  // Mark the rows the repeatability check covered, so the CSV shows which
  // scenarios were planned twice and whether the two runs matched.
  for (const row of rows.slice(0, repeat.checked)) {
    row.repeatChecked = "yes";
    row.repeatMatched = repeat.mismatches.includes(row.id) ? "MISMATCH" : "identical";
  }

  const counts = new Map<ResultCode, number>();
  for (const row of rows) counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
  const succeeded = rows.filter((r) => r.code === "SUCCESS" || r.code === "SUCCESS_DEGRADED");
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const failures = rows.filter((r) => r.failures);
  const lowVariety = rows.filter((r) => r.variety === "low" || r.variety === "same-species");

  const summary = [
    "Batch verification - 100 scenarios against the live engine",
    `Run: ${new Date().toISOString()}`,
    `Catalogue: ${plants.length} plants | rules from ${RULES.source} | P2 overlap ${P2_OVERLAP_TOLERANCE}`,
    "",
    "RESULT CODES",
    ...[...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => `    ${code.padEnd(20)} ${String(n).padStart(3)}  (${((n / rows.length) * 100).toFixed(0)}%)`),
    "",
    `Feasibility rate: ${succeeded.length}/${rows.length} (${((succeeded.length / rows.length) * 100).toFixed(1)}%)`,
    `Run time: median ${median} ms | 95th percentile ${p95} ms | slowest ${times[times.length - 1]} ms`,
    `Repeatability: ${repeat.checked} scenarios run twice, ${repeat.mismatches.length} mismatches` +
      (repeat.mismatches.length ? ` (${repeat.mismatches.join(", ")})` : " - identical"),
    "",
    "SUCCESS RATE BY INPUT",
    "  Sun:",
    ...breakdown(rows, "sun"),
    "  Water:",
    ...breakdown(rows, "water"),
    "  Soil:",
    ...breakdown(rows, "soil"),
    "  Wind:",
    ...breakdown(rows, "wind"),
    "  Style:",
    ...breakdown(rows, "style"),
    "  Block:",
    ...breakdown(rows, "block"),
    "  Location:",
    ...breakdown(rows, "place"),
    "",
    "OPTION VARIETY (reported, not a rule breach)",
    `    Options sharing every species, differing only in quantities: ${lowVariety.filter((r) => r.variety === "same-species").length}`,
    `    Options above ${MAX_OPTION_SIMILARITY} species similarity: ${lowVariety.length}`,
    ...(lowVariety.length
      ? lowVariety.map((r) => `    ${r.id} ${r.label} (${r.bed} m) - similarity ${r.maxSimilarity}`)
      : ["    none"]),
    "",
    `FAILURES AND NOTES (${failures.length})`,
    ...(failures.length
      ? failures.map((r) => `    ${r.id} [${r.code}] ${r.label} (${r.bed} m) - ${r.failures}`)
      : ["    none"]),
    "",
    "NO-PLAN DIAGNOSTICS",
    ...(rows.filter((r) => r.notes).length
      ? rows.filter((r) => r.notes).map((r) => `    ${r.id} [${r.code}] ${r.label} (${r.bed} m) - ${r.notes}`)
      : ["    none"]),
    "",
  ].join("\n");

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "results.csv"), toCsv(rows), "utf8");
  writeFileSync(join(OUT_DIR, "summary.txt"), summary, "utf8");

  console.log(summary);
  console.log(`Written to ${OUT_DIR}`);

  // A constraint failure, an error or a repeatability mismatch is a real
  // problem and should stop a pipeline. An infeasible site is not.
  const broken =
    rows.filter((r) => r.code === "CONSTRAINT_FAIL" || r.code === "ERROR" || r.code === "TIMEOUT").length +
    repeat.mismatches.length;
  process.exitCode = broken > 0 ? 1 : 0;
}

main();
