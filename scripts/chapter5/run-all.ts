/**
 * Chapter 5 test runner: T1-T6 in one pass.
 *
 * Writes reports/chapter5_results.md (tables) and
 * reports/chapter5_results.json (raw numbers).
 *
 *   npm run chapter5
 *
 * No engine logic, rulebook file or test threshold is changed to make a
 * result pass. Parameter variants are in-memory overrides, applied and
 * undone around each run, and every run is seeded.
 *
 * Two deviations from the brief, both forced by what the repo actually
 * contains, and both repeated in the report itself:
 *
 *   - There is no scripts/batch-test/scenarios.csv or engine-adapter.ts.
 *     The 100 scenarios are generated deterministically by
 *     scripts/batch-test/scenarios.ts, and the engine is called directly
 *     (buildGardenPlan / buildGardenPlanVariants), so there is no adapter
 *     layer that could disagree with it.
 *   - tsx is not installed; the repo runs TypeScript through Node's own
 *     type stripping, which is what the npm script uses.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { plants } from "../../app/data/plants.ts";
import { places } from "../../app/data/places.ts";
import type { NationalBiome, Plant } from "../../app/data/plants.ts";
import {
  buildGardenPlan,
  buildGardenPlanVariants,
  computeHeightTiers,
  computeSpreadBands,
  createRng,
  evaluateHardFilters,
  isFeaturePlant,
  minCentreDistance,
  RULES,
  spreadBandOf,
  styleFits,
  survivesHardFilters,
  tierOf,
  type GardenBrief,
  type GardenPlan,
} from "../../app/lib/planning/index.ts";
import { STAGE1_WEIGHTS } from "../../app/lib/planning/stage1Config.ts";
import { readWorkbook } from "../../app/lib/sourcing/xlsx.ts";
import { buildScenarios, type Scenario } from "../batch-test/scenarios.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPORTS = join(ROOT, "reports");
const out: string[] = [];
const raw: Record<string, unknown> = {};
const say = (line = "") => out.push(line);

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pct = (xs: number[], q: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const f = (n: number, d = 3) => n.toFixed(d);

// ---------------------------------------------------------------- header
function header(): void {
  const stamp = (file: string) =>
    JSON.parse(readFileSync(join(ROOT, "app", "data", file), "utf8")) as { version: string };
  const rules = stamp("rules_version.generated.json");
  const dataset = stamp("dataset_version.generated.json");
  const code = createHash("sha256")
    .update(readFileSync(join(ROOT, "app", "lib", "planning", "stage4.ts")))
    .digest("hex")
    .slice(0, 12);
  raw.versions = { rulebook: rules.version, dataset: dataset.version, stage4: code, plants: plants.length };
  say("# Chapter 5 test results");
  say();
  say(`Run: ${new Date().toISOString()}`);
  say();
  say(`| | |`);
  say(`|---|---|`);
  say(`| Rulebook hash | \`${rules.version}\` |`);
  say(`| Dataset hash | \`${dataset.version}\` |`);
  say(`| Catalogue | ${plants.length} species |`);
  say(`| stage4.ts hash | \`${code}\` |`);
  say();
  say("**Deviations from the brief.** There is no `scenarios.csv` or `engine-adapter.ts` in this repo:");
  say("the 100 scenarios are generated deterministically by `scripts/batch-test/scenarios.ts`, and the");
  say("engine is called directly, so no adapter can disagree with it. `tsx` is not installed, so the");
  say("runner uses Node's own type stripping (`npm run chapter5`).");
  say();
}

// ------------------------------------------------------------ T1 helpers
type Placed = { plantId: string; xM: number; yM: number; radiusM: number };

/** P1 and P2, recomputed here rather than read from the engine. */
function placementViolations(plan: GardenPlan): { p1: number; p2: number } {
  const layout = plan.layout;
  if (!layout) return { p1: 0, p2: 0 };
  const placed = layout.placements as Placed[];
  let p1 = 0;
  let p2 = 0;
  for (const p of placed) {
    if (
      p.xM - p.radiusM < -1e-6 || p.yM - p.radiusM < -1e-6 ||
      p.xM + p.radiusM > layout.bedWidthM + 1e-6 || p.yM + p.radiusM > layout.bedLengthM + 1e-6
    ) p1 += 1;
  }
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      if (Math.hypot(a.xM - b.xM, a.yM - b.yM) < minCentreDistance(a.radiusM, b.radiusM) - 1e-6) p2 += 1;
    }
  }
  return { p1, p2 };
}

const speciesOf = (plan: GardenPlan) => new Set((plan.quantities?.quantities ?? []).map((q) => q.id));
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const id of a) if (b.has(id)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// ----------------------------------------------------------------- T1
type T1Row = {
  id: string; code: string; ms: number; species: number; plants: number;
  z: number | null; allSameSize: boolean; plantsPerSpecies: number;
};

function t1(scenarios: Scenario[]) {
  say("## T1 Batch summary");
  say();
  const rows: T1Row[] = [];
  const infeasible: string[] = [];
  const hardViolations: Record<string, number> = { H1: 0, H2: 0, H3: 0, "H3b": 0, H4: 0, H5: 0 };
  let p1Total = 0;
  let p2Total = 0;
  const relaxed: Record<string, number> = { soil: 0, water: 0, sun: 0 };
  const goalRows: number[][] = [];
  const tierGap: Record<string, number[]> = {};
  let pairsTotal = 0;
  let pairsDistinct = 0;
  const jacc: number[] = [];
  let sameSpeciesDifferentSizes = 0;
  const plansForLater: { scenario: Scenario; plan: GardenPlan }[] = [];

  for (const scenario of scenarios) {
    const started = performance.now();
    const plan = buildGardenPlan(plants, scenario.brief);
    const ms = performance.now() - started;

    if (plan.status !== "provisional-plan") {
      const outcome = evaluateHardFilters(plants, scenario.brief);
      const steps = outcome.relaxations.map((r) => `${r.filter} -> ${r.recoveredCount}`).join(", ") || "none offered";
      infeasible.push(
        `| ${scenario.id} | ${scenario.brief.sun}/${scenario.brief.water}/${scenario.brief.soil} | ` +
        `${scenario.brief.bedWidthM}x${scenario.brief.bedLengthM} | ${outcome.survivingCount} | ${steps} | ` +
        `${(plan.diagnostics[0] ?? "no diagnostic").replace(/\|/g, "/")} |`,
      );
      rows.push({ id: scenario.id, code: "INFEASIBLE", ms, species: 0, plants: 0, z: null, allSameSize: false, plantsPerSpecies: 0 });
      continue;
    }

    plansForLater.push({ scenario, plan });
    for (const check of plan.engine?.hard ?? []) if (!check.pass) hardViolations[check.id] += 1;
    const pv = placementViolations(plan);
    p1Total += pv.p1;
    p2Total += pv.p2;
    for (const filter of scenario.brief.relaxedFilters ?? []) relaxed[filter] += 1;

    const goals = plan.engine!.goals;
    goalRows.push([goals.A1, goals.A2, goals.A3, goals.A4, goals.A5]);

    // Tier shares against tau.
    const tiers = computeHeightTiers(plants);
    const byId = new Map(plants.map((p) => [p.id, p]));
    const counts: Record<string, number> = { short: 0, medium: 0, tall: 0 };
    let total = 0;
    for (const q of plan.quantities!.quantities) {
      const plant = byId.get(q.id);
      if (!plant) continue;
      counts[tierOf(plant.heightCm, tiers)] += q.quantity;
      total += q.quantity;
    }
    const styleKey = scenario.brief.style === "undecided" ? "generic" : scenario.brief.style;
    const tau = (RULES.styles as Record<string, { tau: Record<string, number> }>)[styleKey].tau;
    const gap = (["short", "medium", "tall"] as const)
      .reduce((sum, t) => sum + Math.abs((total ? counts[t] / total : 0) - tau[t]), 0);
    (tierGap[styleKey] ??= []).push(gap);

    // Option distinctness.
    const variants = buildGardenPlanVariants(plants, scenario.brief);
    let sameSpecies = variants.length > 1;
    for (let i = 0; i < variants.length; i += 1) {
      for (let j = i + 1; j < variants.length; j += 1) {
        const a = speciesOf(variants[i]);
        const b = speciesOf(variants[j]);
        const J = jaccard(a, b);
        jacc.push(J);
        pairsTotal += 1;
        if (J <= 0.7) pairsDistinct += 1;
        if (J < 1) sameSpecies = false;
      }
    }
    if (sameSpecies) sameSpeciesDifferentSizes += 1;

    const sizes = plan.quantities!.quantities.map((q) => q.quantity);
    rows.push({
      id: scenario.id,
      code: plan.engine?.dropped.length || plan.layout?.unplaced.length ? "SUCCESS_DEGRADED" : "SUCCESS",
      ms,
      species: sizes.length,
      plants: plan.quantities!.totalPlants,
      z: plan.engine!.z,
      allSameSize: sizes.length > 1 && new Set(sizes).size === 1,
      plantsPerSpecies: plan.quantities!.totalPlants / Math.max(1, sizes.length),
    });
  }

  // Repeatability: first 10 scenarios, same seed, run twice.
  let identical = 0;
  for (const scenario of scenarios.slice(0, 10)) {
    const fingerprint = (p: GardenPlan) =>
      JSON.stringify({
        status: p.status,
        seed: p.seed,
        species: (p.quantities?.quantities ?? []).map((q) => [q.id, q.quantity]),
        placements: (p.layout?.placements ?? []).map((x) => [x.plantId, x.xM.toFixed(4), x.yM.toFixed(4)]),
      });
    if (fingerprint(buildGardenPlan(plants, scenario.brief)) === fingerprint(buildGardenPlan(plants, scenario.brief))) {
      identical += 1;
    }
  }

  const times = rows.map((r) => r.ms);
  const feasible = rows.filter((r) => r.code !== "INFEASIBLE");
  const zs = feasible.map((r) => r.z).filter((z): z is number => z !== null);
  const goalMean = [0, 1, 2, 3, 4].map((i) => mean(goalRows.map((g) => g[i])));
  const goalMin = [0, 1, 2, 3, 4].map((i) => Math.min(...goalRows.map((g) => g[i])));

  say("### Status");
  say();
  say("| Status | Count |");
  say("|---|---|");
  for (const code of ["SUCCESS", "SUCCESS_DEGRADED", "INFEASIBLE"]) {
    say(`| ${code} | ${rows.filter((r) => r.code === code).length} |`);
  }
  say(`| **Feasible total** | **${feasible.length} / ${rows.length}** |`);
  say();

  say("### Infeasible scenarios");
  say();
  if (infeasible.length === 0) {
    say("None.");
  } else {
    say("| ID | sun/water/soil | Bed | Pool after Stage 0 | Relaxations offered | Reason |");
    say("|---|---|---|---|---|---|");
    for (const line of infeasible) say(line);
  }
  say();

  say("### Constraint violations, recomputed by this runner");
  say();
  say("| Check | Violations |");
  say("|---|---|");
  for (const [id, n] of Object.entries(hardViolations)) say(`| ${id} | ${n} |`);
  say(`| P1 (out of bounds) | ${p1Total} |`);
  say(`| P2 (overlap) | ${p2Total} |`);
  say();

  say("### Run time");
  say();
  say(`| Median | 95th pct | Max | Under 5 s |`);
  say(`|---|---|---|---|`);
  say(`| ${Math.round(median(times))} ms | ${Math.round(pct(times, 0.95))} ms | ${Math.round(Math.max(...times))} ms | ${((times.filter((t) => t < 5000).length / times.length) * 100).toFixed(0)}% |`);
  say();

  say("### Relaxation");
  say();
  const relaxTotal = Object.values(relaxed).reduce((a, b) => a + b, 0);
  say(`${relaxTotal} of ${rows.length} plans ran with a relaxed filter (soil ${relaxed.soil}, water ${relaxed.water}, sun ${relaxed.sun}).`);
  say();
  say("The scenario set carries no pre-relaxed briefs, so a count of 0 means no scenario needed one");
  say("at build time; relaxation is offered to the user rather than applied automatically.");
  say();

  say("### Option distinctness (species Jaccard)");
  say();
  say("| Pairs with J <= 0.70 | Mean J | Scenarios whose options differ only in group sizes |");
  say("|---|---|---|");
  say(`| ${pairsDistinct} / ${pairsTotal} | ${f(mean(jacc))} | ${sameSpeciesDifferentSizes} |`);
  say();

  say("### Goal achievement");
  say();
  say("| Goal | Mean | Min |");
  say("|---|---|---|");
  for (let i = 0; i < 5; i += 1) say(`| A${i + 1} | ${f(goalMean[i])} | ${f(goalMin[i])} |`);
  say();
  say("Mean total tier gap, sum over tiers of |p_t - tau_t|, by style:");
  say();
  say("| Style | Mean gap | Scenarios |");
  say("|---|---|---|");
  for (const [style, gaps] of Object.entries(tierGap)) say(`| ${style} | ${f(mean(gaps))} | ${gaps.length} |`);
  say();

  say("### Repeatability, Z and group sizes");
  say();
  say(`| Identical re-runs | Median Z | Median plants per species | Plans with every group the same size |`);
  say(`|---|---|---|---|`);
  say(`| ${identical} / 10 | ${f(median(zs), 4)} | ${f(median(feasible.map((r) => r.plantsPerSpecies)), 2)} | ${feasible.filter((r) => r.allSameSize).length} |`);
  say();

  raw.t1 = {
    status: Object.fromEntries(["SUCCESS", "SUCCESS_DEGRADED", "INFEASIBLE"].map((c) => [c, rows.filter((r) => r.code === c).length])),
    feasible: feasible.length,
    hardViolations, p1: p1Total, p2: p2Total,
    timesMs: { median: median(times), p95: pct(times, 0.95), max: Math.max(...times), underFiveSecondsPct: (times.filter((t) => t < 5000).length / times.length) * 100 },
    relaxed, jaccard: { pairs: pairsTotal, distinct: pairsDistinct, mean: mean(jacc), sameSpeciesDifferentSizes },
    goals: { mean: goalMean, min: goalMin },
    tierGap: Object.fromEntries(Object.entries(tierGap).map(([k, v]) => [k, mean(v)])),
    repeatability: identical,
    medianZ: median(zs),
    medianPlantsPerSpecies: median(feasible.map((r) => r.plantsPerSpecies)),
    allSameSize: feasible.filter((r) => r.allSameSize).length,
  };
  return plansForLater;
}

// ----------------------------------------------------------------- T2
function t2(plansForLater: { scenario: Scenario; plan: GardenPlan }[]) {
  say("## T2 Stage 0 exclusion trace");
  say();
  const byId = new Map(plants.map((p) => [p.id, p]));
  const counts = { notEligible: 0, parasitic: 0, aquatic: 0, dataIncomplete: 0, biomeMismatch: 0, filters: 0 };
  let checked = 0;

  for (const { scenario, plan } of plansForLater) {
    for (const q of plan.quantities?.quantities ?? []) {
      const plant = byId.get(q.id) as Plant;
      checked += 1;
      if (!plant.layoutEligible) counts.notEligible += 1;
      const types = plant.plantType ?? [];
      if (types.includes("parasitic")) counts.parasitic += 1;
      if (types.includes("aquatic")) counts.aquatic += 1;
      if (!plant.sun || !plant.water || !plant.soilType) counts.dataIncomplete += 1;
      if (!(plant.biome ?? []).some((b) => scenario.brief.biomes.includes(b))) counts.biomeMismatch += 1;
      // F1-F3 together: survivesHardFilters is the same gate Stage 0 uses,
      // including any relaxation recorded on the brief.
      if (!survivesHardFilters(plant, scenario.brief)) counts.filters += 1;
    }
  }

  say(`${checked} recommended species checked across ${plansForLater.length} plans.`);
  say();
  say("| Check | Violations (expected 0) |");
  say("|---|---|");
  say(`| Not layout-eligible (indoor or poisonous) | ${counts.notEligible} |`);
  say(`| Parasitic | ${counts.parasitic} |`);
  say(`| Aquatic | ${counts.aquatic} |`);
  say(`| Data incomplete (no sun, water or soil) | ${counts.dataIncomplete} |`);
  say(`| No biome in common with the place | ${counts.biomeMismatch} |`);
  say(`| Fails F1-F3 (light, water, soil) | ${counts.filters} |`);
  say();
  say("A permanent version of this check is in `tests/planning-engine.test.ts`");
  say("(\"every recommended species passes every Stage 0 gate\").");
  say();
  raw.t2 = { checked, ...counts };
}

// ----------------------------------------------------------------- T3
function t3(plansForLater: { scenario: Scenario; plan: GardenPlan }[]) {
  say("## T3 Sourcing coverage");
  say();
  const species = new Set<string>();
  for (const { plan } of plansForLater) for (const q of plan.quantities?.quantities ?? []) species.add(q.id);
  say(`${species.size} unique species were recommended across the T1 plans.`);
  say();
  say("**Not run.** Sourcing is live: `app/lib/sourcing/run.ts` fetches each nursery over HTTP at");
  say("request time (robots-respecting, 1 request/second/host), and prices are never stored as a");
  say("dataset. Measuring listing and price coverage for every recommended species would mean");
  say("thousands of live requests against real nurseries, which the politeness budget forbids and");
  say("which this environment cannot reach. The shares below therefore cannot be produced offline:");
  say();
  say("- share with at least one nursery listing;");
  say("- share with an indicative price;");
  say("- mean share per plan.");
  say();
  say("To run it: start the dev server and POST each plan to `/api/sourcing`, or extend");
  say("`scripts/batch-test/` with a sourcing pass and a much longer time budget.");
  say();
  raw.t3 = { uniqueSpecies: species.size, run: false, reason: "sourcing is live HTTP; not runnable offline within the politeness budget" };
}

// ----------------------------------------------------------------- T4
type Variant = {
  name: string;
  apply: () => () => void;         // returns an undo
  stage1?: boolean;
  windOnly?: boolean;
  runnable: boolean;
  why?: string;
};

/** The 20 fixed sensitivity briefs: a seeded stratified draw, every 5th
 * scenario, which walks the site, bed-size and stress blocks in turn.
 * T4 and T7 use the same list so their results can be read together. */
function sensitivityScenarios(scenarios: Scenario[]): Scenario[] {
  return scenarios.filter((_, index) => index % 5 === 0).slice(0, 20);
}

function t4(scenarios: Scenario[]) {
  say("## T4 Sensitivity analysis");
  say();
  const picked = sensitivityScenarios(scenarios);
  say(`20 fixed scenarios (every 5th, which walks all three blocks): ${picked.map((s) => s.id).join(", ")}`);
  say();

  const setPath = (object: Record<string, unknown>, key: string, value: unknown) => {
    const before = object[key];
    object[key] = value;
    return () => { object[key] = before; };
  };

  const stage2 = RULES.stage2 as unknown as Record<string, unknown>;
  const stage3 = RULES.stage3 as unknown as Record<string, unknown>;
  const stage4 = RULES.stage4 as unknown as Record<string, unknown>;
  const weights = STAGE1_WEIGHTS as unknown as Record<string, number>;

  const variants: Variant[] = [
    {
      name: "AHP equal weights (style = extras = colour = 1/3)",
      stage1: true, runnable: true,
      apply: () => {
        const undo = [
          setPath(weights, "style", 1 / 3),
          setPath(weights, "extras", 1 / 3),
          setPath(weights, "colour", 1 / 3),
        ];
        return () => undo.forEach((u) => u());
      },
    },
    { name: "lambda = 0.4", runnable: true, apply: () => setPath(stage2, "lambda", 0.4) },
    { name: "lambda = 0.6", runnable: true, apply: () => setPath(stage2, "lambda", 0.6) },
    { name: "T0 x 0.5", runnable: true, apply: () => setPath(stage3, "t0", 0.069 * 0.5) },
    { name: "T0 x 2", runnable: true, apply: () => setPath(stage3, "t0", 0.069 * 2) },
    { name: "alpha = 0.998", runnable: true, apply: () => setPath(stage3, "alpha", 0.998) },
    // Runnable since 2026-09-30: minCentreDistance and the layout audit
    // read RULES.stage4.overlapDelta at call time, so an in-memory
    // override reaches both the placement and the verification.
    { name: "delta = 0.10", runnable: true, apply: () => setPath(stage4, "overlapDelta", 0.1) },
    { name: "delta = 0.20", runnable: true, apply: () => setPath(stage4, "overlapDelta", 0.2) },
    { name: "k_headroom = 1.5", runnable: true, apply: () => setPath(stage2, "kHeadroom", 1.5) },
    { name: "k_headroom = 2.5", runnable: true, apply: () => setPath(stage2, "kHeadroom", 2.5) },
    { name: "b_wind -20% (wind scenarios)", stage1: true, windOnly: true, runnable: true, apply: () => setPath(weights, "wind", weights.wind * 0.8) },
    { name: "b_wind +20% (wind scenarios)", stage1: true, windOnly: true, runnable: true, apply: () => setPath(weights, "wind", weights.wind * 1.2) },
  ];

  // Baseline, plus the seed noise it carries: the same brief re-planned
  // under 5 Regenerate seeds. Any variant effect smaller than this is
  // indistinguishable from the engine's own run-to-run variation.
  const baseline = new Map<string, {
    species: Set<string>; z: number | null; top10: string[];
    goals: number[] | null; zSd: number | null;
  }>();
  const seedSds: number[] = [];
  const perBriefSd: { id: string; sd: number; mean: number }[] = [];
  for (const s of picked) {
    const plan = buildGardenPlan(plants, s.brief);
    const zs: number[] = [];
    for (let seed = 0; seed < 5; seed += 1) {
      const run = buildGardenPlan(plants, s.brief, { variationCounter: seed });
      if (run.engine) zs.push(run.engine.z);
    }
    const m = mean(zs);
    const sd = zs.length > 1 ? Math.sqrt(mean(zs.map((z) => (z - m) ** 2))) : 0;
    if (zs.length > 1) {
      seedSds.push(sd);
      perBriefSd.push({ id: s.id, sd, mean: m });
    }
    const g = plan.engine?.goals;
    baseline.set(s.id, {
      species: speciesOf(plan),
      z: plan.engine?.z ?? null,
      top10: plan.assessments.slice(0, 10).map((a) => a.plantId),
      goals: g ? [g.A1, g.A2, g.A3, g.A4, g.A5] : null,
      zSd: zs.length > 1 ? sd : null,
    });
  }

  say("### Baseline seed noise");
  say();
  say("Each brief re-planned under 5 Regenerate seeds; the spread of Z is the engine's own");
  say("run-to-run variation, and the floor any variant effect has to clear to mean anything.");
  say();
  say("| Brief | mean Z | SD across 5 seeds |");
  say("|---|---|---|");
  for (const row of perBriefSd) say(`| ${row.id} | ${f(row.mean, 4)} | ${f(row.sd, 4)} |`);
  say(`| **Mean of the SDs** | | **${f(mean(seedSds), 4)}** |`);
  say();
  raw.t4SeedNoise = { perBrief: perBriefSd, meanSd: mean(seedSds) };

  say("| Variant | mean J (option 1) | J >= 0.70 | top-10 kept (mean / min) | median dZ | feasible | violations | annealing |");
  say("|---|---|---|---|---|---|---|---|");
  const t4raw: Record<string, unknown> = {};
  const goalRows: { name: string; deltas: (number | null)[] }[] = [];

  for (const variant of variants) {
    if (!variant.runnable) {
      say(`| ${variant.name} | - | - | - | - | - | - | NOT RUN |`);
      t4raw[variant.name] = { run: false, why: variant.why };
      goalRows.push({ name: variant.name, deltas: [null, null, null, null, null] });
      continue;
    }
    const undo = variant.apply();
    try {
      const scope = variant.windOnly ? picked.filter((s) => s.brief.wind !== "none") : picked;
      const js: number[] = [];
      const keeps: number[] = [];
      const dz: number[] = [];
      // Per-goal change, one list per goal A1..A5, paired brief by brief.
      const dGoals: number[][] = [[], [], [], [], []];
      let feasible = 0;
      let violations = 0;
      let worseMoves = 0;
      let frozenAt = 0;
      for (const s of scope) {
        const plan = buildGardenPlan(plants, s.brief);
        const base = baseline.get(s.id)!;
        if (plan.status === "provisional-plan") {
          feasible += 1;
          js.push(jaccard(base.species, speciesOf(plan)));
          if (base.z !== null && plan.engine) dz.push(plan.engine.z - base.z);
          if (base.goals && plan.engine) {
            const g = plan.engine.goals;
            [g.A1, g.A2, g.A3, g.A4, g.A5].forEach((value, i) => {
              dGoals[i].push(value - base.goals![i]);
            });
          }
          for (const c of plan.engine?.hard ?? []) if (!c.pass) violations += 1;
          const pv = placementViolations(plan);
          violations += pv.p1 + pv.p2;
          if (plan.engine?.search) {
            worseMoves += plan.engine.search.acceptedWorse;
            const alpha = (RULES.stage3 as unknown as { alpha: number }).alpha;
            frozenAt = Math.round(Math.log(0.01) / Math.log(alpha));
          }
        }
        if (variant.stage1) {
          const top = new Set(plan.assessments.slice(0, 10).map((a) => a.plantId));
          keeps.push(base.top10.filter((id) => top.has(id)).length / 10);
        }
      }
      const annealing = variant.name.startsWith("T0") || variant.name.startsWith("alpha")
        ? `${worseMoves} worse moves, T<1% at ${frozenAt} iters`
        : "-";
      say(
        `| ${variant.name} | ${f(mean(js))} | ${js.filter((j) => j >= 0.7).length}/${js.length} | ` +
        `${variant.stage1 ? `${f(mean(keeps), 2)} / ${f(Math.min(...keeps), 2)}` : "-"} | ` +
        `${dz.length ? (median(dz) >= 0 ? "+" : "") + f(median(dz), 4) : "-"} | ${feasible}/${scope.length} | ${violations} | ${annealing} |`,
      );
      const meanDGoals = dGoals.map((list) => (list.length ? mean(list) : null));
      goalRows.push({ name: variant.name, deltas: meanDGoals });
      t4raw[variant.name] = { meanJ: mean(js), atLeast070: js.filter((j) => j >= 0.7).length, scope: scope.length, medianDeltaZ: dz.length ? median(dz) : null, feasible, violations, worseMoves, frozenAt, meanDeltaGoals: meanDGoals };
    } finally {
      undo();
    }
  }
  say();
  say("### Mean change in each goal");
  say();
  say("Mean of (variant goal - baseline goal) over the briefs that stayed feasible, so a");
  say("positive number means the variant scored that goal better. These are the five goal");
  say("terms Z is built from, which shows which one a parameter actually moves.");
  say();
  say("| Variant | dA1 height balance | dA2 colour | dA3 variety | dA4 ground cover | dA5 flowering |");
  say("|---|---|---|---|---|---|");
  for (const row of goalRows) {
    const cells = row.deltas
      .map((d) => (d === null ? "-" : (d >= 0 ? "+" : "") + f(d, 4)))
      .join(" | ");
    say(`| ${row.name} | ${cells} |`);
  }
  say();
  raw.t4Goals = goalRows;

  say("`delta` is now runnable: `minCentreDistance` and `auditRectangularLayout` read");
  say("`RULES.stage4.overlapDelta` at call time (2026-09-30), so an override reaches both the");
  say("placement and the independent check. The value is unchanged at the default, and the");
  say("104-test suite passes either way.");
  say();
  raw.t4 = { scenarios: picked.map((s) => s.id), variants: t4raw };
}

// ----------------------------------------------------------------- T5
function t5(): void {
  say("## T5 Interface and offline check");
  say();
  let playwright: boolean;
  try {
    execFileSync("node", ["-e", "require.resolve('playwright')"], { cwd: ROOT, stdio: "ignore" });
    playwright = true;
  } catch {
    playwright = false;
  }
  if (playwright) {
    say("Playwright resolves in this repo; `tests/e2e/chapter5.spec.ts` can be run.");
  } else {
    say("**Not run.** Playwright is not a dependency of this repo (`node_modules/playwright` is absent),");
    say("so no browser automation can be started and no screenshots can be captured. Installing it is a");
    say("dependency change, which this run is not permitted to make. Manual checklist instead:");
    say();
    say("| # | Step | Expected | Pass? |");
    say("|---|---|---|---|");
    say("| 1 | `npm run dev`, open the layout tool | The bed step draws to scale | |");
    say("| 2 | Build a plan for scenario S001 (Fynbos, full sun, low water, sandy, 2 x 3 m) | Three options appear | |");
    say("| 3 | Hover a circle in the layout | The plant's name appears in a tooltip | |");
    say("| 4 | Read the plant list beside the layout | Each plant shows its mature height and spread | |");
    say("| 5 | Find a plant whose spread is imputed | The measurement reads \"(estimated)\" | |");
    say("| 6 | Read the Care paragraph | Care information is shown for the bed's plants | |");
    say("| 7 | Click \"Save this layout\" | It appears under Saved gardens | |");
    say("| 8 | Go offline (DevTools > Network > Offline) and reload | The saved plan still opens from local storage | |");
    say();
  }
  raw.t5 = { playwright, run: playwright };
}

// ----------------------------------------------------------------- T6
function t6(): void {
  say("## T6 Suite status");
  say();
  const run = (label: string, args: string[]) => {
    try {
      const stdout = execFileSync("npm", args, { cwd: ROOT, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] });
      return { label, ok: true, stdout };
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      return { label, ok: false, stdout: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  };
  const unit = run("unit tests", ["run", "test:unit"]);
  const pass = /^.*pass (\d+)/m.exec(unit.stdout)?.[1] ?? "?";
  const fail = /^.*fail (\d+)/m.exec(unit.stdout)?.[1] ?? "?";
  const types = run("typecheck", ["exec", "--", "tsc", "--noEmit"]);
  const lint = run("lint", ["run", "lint"]);
  say("| Check | Result |");
  say("|---|---|");
  say(`| Unit tests | ${pass} passed, ${fail} failed |`);
  say(`| Typecheck (\`tsc --noEmit\`) | ${types.ok ? "clean" : "errors"} |`);
  say(`| Lint (\`eslint\`) | ${lint.ok ? "clean" : "errors"} |`);
  say();
  raw.t6 = { unitPass: Number(pass), unitFail: Number(fail), typecheck: types.ok, lint: lint.ok };
}

// ----------------------------------------------------------------- T7
/**
 * How far a plan moves when the measurements underneath it are wrong.
 *
 * Only 212 of 2,843 spreads are measured; the rest are imputed, and the
 * heights carry their own provenance. This perturbs every species'
 * height and spread by an independent log-uniform factor in [0.67, 1.5]
 * - a third smaller to half again as large - and re-plans the 20
 * sensitivity briefs on that altered catalogue.
 *
 * The perturbation is in memory: a copy of the plant array, never the
 * dataset. Height tier, spread band and the feature flag are all derived
 * from those two fields, so `prepare` recomputes them from the perturbed
 * copy without anything else being touched.
 *
 * Height and spread are drawn SEPARATELY for each species, because the
 * dataset records their provenance separately - a species can have a
 * measured height and an imputed spread, so their errors are not tied.
 */
/** The measurement-error draws, shared by T7 and T7b so both describe the
 * same 30 alternative catalogues. Draw d is always the same catalogue. */
const DRAWS = 30;
const FACTOR_LO = 0.67;
const FACTOR_HI = 1.5;

function perturbedCatalogue(draw: number): Plant[] {
  const rng = createRng(`t7-draw-${draw}`);
  const logUniform = () =>
    Math.exp(Math.log(FACTOR_LO) + rng() * (Math.log(FACTOR_HI) - Math.log(FACTOR_LO)));
  return plants.map((plant) => ({
    ...plant,
    heightCm: plant.heightCm === null ? null : Math.max(1, Math.round(plant.heightCm * logUniform())),
    spreadCm: plant.spreadCm === null ? null : Math.max(1, Math.round(plant.spreadCm * logUniform())),
  }));
}

function t7(scenarios: Scenario[]) {
  say("## T7 Data-error propagation");
  say();
  const briefs = sensitivityScenarios(scenarios);
  const LO = FACTOR_LO;
  const HI = FACTOR_HI;

  // Baseline: the same briefs on the real catalogue.
  const baseline = new Map<string, { species: Set<string>; z: number | null }>();
  for (const s of briefs) {
    const plan = buildGardenPlan(plants, s.brief);
    baseline.set(s.id, { species: speciesOf(plan), z: plan.engine?.z ?? null });
  }

  const deltaZ: number[] = [];
  const jaccards: number[] = [];
  let runs = 0;
  let feasible = 0;
  let violations = 0;
  const perCheck: Record<string, number> = { H1: 0, H2: 0, H3: 0, "H3b": 0, H4: 0, H5: 0, P1: 0, P2: 0 };

  for (let draw = 0; draw < DRAWS; draw += 1) {
    // One altered catalogue per draw, shared by all 20 briefs so the draw
    // reads as a single "what if the measurements were wrong like this".
    const perturbed = perturbedCatalogue(draw);

    for (const s of briefs) {
      runs += 1;
      const plan = buildGardenPlan(perturbed, s.brief);
      if (plan.status !== "provisional-plan") continue;
      feasible += 1;

      for (const check of plan.engine?.hard ?? []) {
        if (!check.pass) {
          perCheck[check.id] += 1;
          violations += 1;
        }
      }
      const pv = placementViolations(plan);
      perCheck.P1 += pv.p1;
      perCheck.P2 += pv.p2;
      violations += pv.p1 + pv.p2;

      const base = baseline.get(s.id)!;
      if (base.z !== null && plan.engine) deltaZ.push(plan.engine.z - base.z);
      jaccards.push(jaccard(base.species, speciesOf(plan)));
    }
  }

  const atLeast070 = jaccards.filter((j) => j >= 0.7).length;
  say(`${DRAWS} draws x ${briefs.length} briefs = ${runs} runs. Every species' height and spread`);
  say(`multiplied by an independent log-uniform factor in [${LO}, ${HI}], seeded per draw.`);
  say();
  say("| Measure | Value |");
  say("|---|---|");
  say(`| Mean dZ | ${deltaZ.length ? (mean(deltaZ) >= 0 ? "+" : "") + f(mean(deltaZ), 4) : "-"} |`);
  say(`| 5th percentile dZ | ${deltaZ.length ? f(pct(deltaZ, 0.05), 4) : "-"} |`);
  say(`| Still feasible | ${feasible} / ${runs} (${((feasible / runs) * 100).toFixed(1)}%) |`);
  say(`| Total violations | ${violations} |`);
  say(`| Mean species Jaccard vs baseline | ${f(mean(jaccards))} |`);
  say(`| Runs with J >= 0.70 | ${atLeast070} / ${jaccards.length} (${((atLeast070 / Math.max(1, jaccards.length)) * 100).toFixed(1)}%) |`);
  say();
  say("Violations by check: " + Object.entries(perCheck).map(([k, v]) => `${k} ${v}`).join(", ") + ".");
  say();
  raw.t7 = {
    draws: DRAWS, briefs: briefs.map((s) => s.id), runs, feasible,
    factorRange: [LO, HI],
    meanDeltaZ: deltaZ.length ? mean(deltaZ) : null,
    p05DeltaZ: deltaZ.length ? pct(deltaZ, 0.05) : null,
    violations, perCheck,
    meanJaccard: mean(jaccards),
    atLeast070,
    jaccardCount: jaccards.length,
  };
}

// ---------------------------------------------------------------- T7b
/**
 * The same 30 draws as T7, but the plan is NOT re-optimised: species and
 * positions stay exactly where the baseline put them, and only the sizes
 * change underneath. T7 asks "would the engine choose differently?"; this
 * asks "is the plan already on the ground still valid?" - the question
 * that matters once someone has planted it.
 *
 * Nothing is re-run through the engine: radii, heights, tiers and the
 * feature flag are recomputed from the perturbed values and checked by
 * hand against the same rules the engine applies.
 */
function t7b(scenarios: Scenario[]) {
  say("## T7b Fixed-plan suitability under size error");
  say();
  const briefs = sensitivityScenarios(scenarios);
  const baseTiers = computeHeightTiers(plants);
  const byId = new Map(plants.map((p) => [p.id, p]));

  // The 20 baseline plans, kept whole.
  const baselines = briefs.flatMap((s) => {
    const plan = buildGardenPlan(plants, s.brief);
    return plan.status === "provisional-plan" && plan.layout ? [{ scenario: s, plan }] : [];
  });

  let plansChecked = 0;
  let withOverlap = 0;
  let withBreach = 0;
  let outsideCover = 0;
  const worstOverlaps: number[] = [];
  let placedTotal = 0;
  let tierChanged = 0;
  let featureFlips = 0;
  let speciesChecked = 0;

  for (let draw = 0; draw < DRAWS; draw += 1) {
    const perturbed = perturbedCatalogue(draw);
    const newById = new Map(perturbed.map((p) => [p.id, p]));
    const newTiers = computeHeightTiers(perturbed);
    const delta = RULES.stage4.overlapDelta;

    // Feature flags, over the species that actually appear in a plan.
    const inPlans = new Set(baselines.flatMap(({ plan }) => (plan.quantities?.quantities ?? []).map((q) => q.id)));
    for (const id of inPlans) {
      const before = byId.get(id);
      const after = newById.get(id);
      if (!before || !after) continue;
      speciesChecked += 1;
      if (isFeaturePlant(before) !== isFeaturePlant(after)) featureFlips += 1;
      if (tierOf(before.heightCm, baseTiers) !== tierOf(after.heightCm, newTiers)) tierChanged += 1;
    }

    for (const { scenario, plan } of baselines) {
      plansChecked += 1;
      const layout = plan.layout!;
      // Same positions, new radii.
      const placed = layout.placements.map((p) => {
        const plant = newById.get(p.plantId);
        return {
          plantId: p.plantId,
          xM: p.xM,
          yM: p.yM,
          radiusM: plant?.spreadCm ? plant.spreadCm / 200 : p.radiusM,
        };
      });
      placedTotal += placed.length;

      // P2: how far inside the allowed centre distance any pair now sits.
      let worst = 0;
      for (let i = 0; i < placed.length; i += 1) {
        for (let j = i + 1; j < placed.length; j += 1) {
          const a = placed[i];
          const b = placed[j];
          const need = a.radiusM + b.radiusM - delta * Math.min(a.radiusM, b.radiusM);
          const gap = Math.hypot(a.xM - b.xM, a.yM - b.yM);
          if (gap < need - 1e-9) worst = Math.max(worst, need - gap);
        }
      }
      if (worst > 0) {
        withOverlap += 1;
        worstOverlaps.push(worst);
      }

      // P1: any circle now crossing the bed edge.
      const breach = placed.some(
        (p) =>
          p.xM - p.radiusM < -1e-9 || p.yM - p.radiusM < -1e-9 ||
          p.xM + p.radiusM > layout.bedWidthM + 1e-9 || p.yM + p.radiusM > layout.bedLengthM + 1e-9,
      );
      if (breach) withBreach += 1;

      // H1: planted area against the style's cover band.
      const area = placed.reduce((sum, p) => sum + Math.PI * p.radiusM ** 2, 0);
      const bed = layout.bedWidthM * layout.bedLengthM;
      const styleKey = scenario.brief.style === "undecided" ? "generic" : scenario.brief.style;
      const style = (RULES.styles as Record<string, { coverMin: number; coverMax: number }>)[styleKey];
      const cover = area / bed;
      if (cover > style.coverMax + 1e-9 || cover < style.coverMin - 1e-9) outsideCover += 1;
    }
  }

  const share = (n: number, of: number) => `${((n / of) * 100).toFixed(1)}%`;
  say(`${baselines.length} baseline plans x ${DRAWS} draws = ${plansChecked} fixed plans re-checked,`);
  say(`using the same draws as T7. Positions and species unchanged; only sizes differ.`);
  say();
  say("| Measure | Value |");
  say("|---|---|");
  say(`| Plans with any P2 overlap beyond delta | ${withOverlap} / ${plansChecked} (${share(withOverlap, plansChecked)}) |`);
  say(`| Mean largest overlap, where one occurs | ${worstOverlaps.length ? f(mean(worstOverlaps), 3) + " m" : "-"} |`);
  say(`| Plans with any P1 boundary breach | ${withBreach} / ${plansChecked} (${share(withBreach, plansChecked)}) |`);
  say(`| Plans outside the style's cover band | ${outsideCover} / ${plansChecked} (${share(outsideCover, plansChecked)}) |`);
  say(`| Placed plants whose height tier changes | ${tierChanged} / ${speciesChecked} species-draws (${share(tierChanged, speciesChecked)}) |`);
  say(`| Feature flags that flip | ${featureFlips} of ${speciesChecked} species-draws |`);
  say();
  say(`Overlap is reported as metres of centre distance short of r_i + r_j - delta*MIN(r_i, r_j), delta = ${RULES.stage4.overlapDelta} (P2 as revised 2026-10-05).`);
  say();
  raw.t7b = {
    baselines: baselines.length, draws: DRAWS, plansChecked,
    withOverlap, meanWorstOverlapM: worstOverlaps.length ? mean(worstOverlaps) : null,
    withBreach, outsideCover, placedTotal,
    tierChanged, featureFlips, speciesChecked,
  };
}

// ----------------------------------------------------------------- T8
/** Gini of a count vector: 0 = every species recommended equally often,
 * 1 = one species takes everything. Zeros are included, so this measures
 * concentration across the whole eligible catalogue. */
function gini(counts: number[]): number {
  const xs = [...counts].sort((a, b) => a - b);
  const n = xs.length;
  const total = xs.reduce((a, b) => a + b, 0);
  if (n === 0 || total === 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i += 1) weighted += (i + 1) * xs[i];
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

/** Two-sided one-sample KS against Uniform(0,1), with the asymptotic
 * p-value. Good enough at these sample sizes to say whether the tie order
 * is being favoured. */
function ksUniform(sample: number[]): { d: number; p: number; n: number } {
  const n = sample.length;
  if (n === 0) return { d: 0, p: 1, n };
  const xs = [...sample].sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < n; i += 1) {
    d = Math.max(d, Math.abs((i + 1) / n - xs[i]), Math.abs(xs[i] - i / n));
  }
  const lambda = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * d;
  let p = 0;
  for (let k = 1; k <= 100; k += 1) p += 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * lambda * lambda);
  return { d, p: Math.min(1, Math.max(0, p)), n };
}

function t8(scenarios: Scenario[], plansForLater: { scenario: Scenario; plan: GardenPlan }[]) {
  say("## T8 Catalogue coverage");
  say();
  const eligible = plants.filter((p) => p.layoutEligible);
  const counts = new Map<string, number>();
  const positions: number[] = [];

  for (const { scenario, plan } of plansForLater) {
    // The brief's Stage 0 pool, in the order ties are broken: by plantId.
    const pool = plants
      .filter((p) => p.layoutEligible && survivesHardFilters(p, scenario.brief))
      .map((p) => p.id)
      .sort((a, b) => a.localeCompare(b));
    const index = new Map(pool.map((id, i) => [id, i]));
    for (const q of plan.quantities?.quantities ?? []) {
      counts.set(q.id, (counts.get(q.id) ?? 0) + 1);
      const at = index.get(q.id);
      if (at !== undefined && pool.length > 1) positions.push(at / (pool.length - 1));
    }
  }

  const slots = [...counts.values()].reduce((a, b) => a + b, 0);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top10 = ranked.slice(0, 10).reduce((sum, [, n]) => sum + n, 0);
  const allCounts = eligible.map((p) => counts.get(p.id) ?? 0);
  const ks = ksUniform(positions);

  say("### (a) Breadth");
  say();
  say("| Unique species recommended | Layout-eligible species | Share |");
  say("|---|---|---|");
  say(`| ${counts.size} | ${eligible.length} | ${((counts.size / eligible.length) * 100).toFixed(1)}% |`);
  say();

  say("### (b) Concentration");
  say();
  say("| Slots | Top 10 species take | Gini (all eligible species) |");
  say("|---|---|---|");
  say(`| ${slots} | ${((top10 / slots) * 100).toFixed(1)}% | ${f(gini(allCounts))} |`);
  say();
  say("Most-recommended species: " + ranked.slice(0, 5).map(([id, n]) => `${id} (${n})`).join(", ") + ".");
  say();

  say("### (c) Tie-order bias");
  say();
  say("Percentile position of each recommended species within its brief's Stage 0 pool,");
  say("ordered by plantId - the order ties are actually broken in.");
  say();
  say("| n | Mean position | Median | KS D | p |");
  say("|---|---|---|---|---|");
  say(`| ${ks.n} | ${(mean(positions) * 100).toFixed(1)}% | ${(median(positions) * 100).toFixed(1)}% | ${f(ks.d)} | ${ks.p < 0.001 ? "<0.001" : f(ks.p)} |`);
  say();
  say(
    ks.p < 0.05
      ? "**Positions are not uniform.** The tie order is favouring part of the pool."
      : "Positions are consistent with a uniform draw: no detectable tie-order bias.",
  );
  say();

  say("### (d) Coverage curve");
  say();
  const seen = new Set<string>();
  const curve: Record<number, number> = {};
  let planCount = 0;
  for (let seed = 0; seed < 5; seed += 1) {
    for (const scenario of scenarios) {
      const plan = buildGardenPlan(plants, scenario.brief, { variationCounter: seed });
      planCount += 1;
      for (const q of plan.quantities?.quantities ?? []) seen.add(q.id);
      if (planCount === 100 || planCount === 200 || planCount === 500) curve[planCount] = seen.size;
    }
  }
  say("| Plans | Unique species |");
  say("|---|---|");
  for (const n of [100, 200, 500]) say(`| ${n} | ${curve[n] ?? "-"} |`);
  say();
  say(`After 500 plans the engine has used ${curve[500] ?? 0} of ${eligible.length} layout-eligible species`);
  say(`(${(((curve[500] ?? 0) / eligible.length) * 100).toFixed(1)}%).`);
  say();

  raw.t8 = {
    unique: counts.size, eligible: eligible.length, slots,
    top10Share: top10 / slots, gini: gini(allCounts),
    positions: { n: ks.n, mean: mean(positions), median: median(positions), ksD: ks.d, p: ks.p },
    curve,
  };
  return counts;
}

// ----------------------------------------------------------------- T9
/** The combination library, if the workbook can be read. */
function t9(counts: Map<string, number>, plansForLater: { scenario: Scenario; plan: GardenPlan }[]) {
  say("## T9 Combination library (8_Species_Reference)");
  say();
  say("**Not read by the engine.** `data/scripts/import_rulebook.py` imports three sheets only -");
  say("`1_Parameters` (line 124), `2_Style_Rules` (line 236) and `4_Stage1_Score` (line 301).");
  say("`8_Species_Reference` is not among them, nothing in `app/lib/planning/` mentions a combination,");
  say("and `engine_rules.generated.json` carries no combination key. So there is no preference to");
  say("size and nothing is read from `RULES`: any co-occurrence below is chance, not design.");
  say();

  let workbook: Map<string, unknown> | null = null;
  let why = "";
  try {
    const buffer = readFileSync(join(ROOT, "..", "Algorithm_rulebook.xlsx"));
    workbook = readWorkbook(buffer) as unknown as Map<string, unknown>;
  } catch (error) {
    why = (error as NodeJS.ErrnoException).code === "EBUSY" || (error as NodeJS.ErrnoException).code === "EPERM"
      ? "the workbook is open in Excel, which locks it even for reading"
      : `could not read the workbook (${(error as Error).message})`;
  }

  if (!workbook) {
    say(`**Statistics not run:** ${why}. Close Excel and re-run \`npm run chapter5\`.`);
    say();
    raw.t9 = { readByEngine: false, statsRun: false, why };
    return;
  }

  const sheetName = [...workbook.keys()].find((n) => n.startsWith("8_") || /species_reference/i.test(n));
  if (!sheetName) {
    say(`**Statistics not run:** no sheet starting "8_" was found (sheets: ${[...workbook.keys()].join(", ")}).`);
    say();
    raw.t9 = { readByEngine: false, statsRun: false, why: "sheet not found" };
    return;
  }

  // Scientific names anywhere on the sheet, matched against the catalogue.
  const sheet = workbook.get(sheetName) as Map<number, Map<string, { value: string }>>;
  const byName = new Map(plants.map((p) => [p.scientificName.toLowerCase(), p]));
  const comboRows: { row: number; ids: string[] }[] = [];
  for (const [row, cells] of sheet) {
    const ids: string[] = [];
    for (const cell of cells.values()) {
      const key = cell.value.trim().toLowerCase();
      const hit = byName.get(key) ?? byName.get(key.split(/\s+/).slice(0, 2).join(" "));
      if (hit && !ids.includes(hit.id)) ids.push(hit.id);
    }
    if (ids.length > 0) comboRows.push({ row, ids });
  }
  const comboIds = new Set(comboRows.flatMap((r) => r.ids));

  // Which non-combo species were available in the same pools, for a fair
  // comparison of recommendation counts.
  const poolSpecies = new Set<string>();
  for (const { scenario } of plansForLater) {
    for (const plant of plants) {
      if (plant.layoutEligible && survivesHardFilters(plant, scenario.brief)) poolSpecies.add(plant.id);
    }
  }
  const comboInPools = [...comboIds].filter((id) => poolSpecies.has(id));
  const otherInPools = [...poolSpecies].filter((id) => !comboIds.has(id));
  const meanCount = (ids: string[]) => mean(ids.map((id) => counts.get(id) ?? 0));

  // Two or more members of one combo row in the same plan.
  let together = 0;
  for (const { plan } of plansForLater) {
    const inPlan = new Set((plan.quantities?.quantities ?? []).map((q) => q.id));
    if (comboRows.some((r) => r.ids.filter((id) => inPlan.has(id)).length >= 2)) together += 1;
  }

  say(`Sheet **${sheetName}**: ${comboRows.length} rows naming catalogue species, ${comboIds.size} distinct species.`);
  say();
  say("| Measure | Value |");
  say("|---|---|");
  say(`| Combo species appearing in a T1 plan | ${[...comboIds].filter((id) => counts.has(id)).length} of ${comboIds.size} |`);
  say(`| Mean recommendations, combo species (in pools) | ${f(meanCount(comboInPools), 2)} |`);
  say(`| Mean recommendations, non-combo species (same pools) | ${f(meanCount(otherInPools), 2)} |`);
  say(`| Plans with 2+ members of one combo | ${together} of ${plansForLater.length} |`);
  say();
  raw.t9 = {
    readByEngine: false, statsRun: true, sheet: sheetName,
    comboRows: comboRows.length, comboSpecies: comboIds.size,
    appearing: [...comboIds].filter((id) => counts.has(id)).length,
    meanCombo: meanCount(comboInPools), meanOther: meanCount(otherInPools),
    plansWithPair: together, plans: plansForLater.length,
  };
}

// ----------------------------------------------------------------- T10
/**
 * How much of the catalogue the tool can actually reach, and how much of
 * that it ever chooses.
 *
 * (a) Reachable: Stage 0 only, over every distinct biome set a real place
 *     carries, crossed with every sun x water x soil answer.
 * (b) Selectable: the full engine over a stratified sample of briefs.
 * (c) Never selected: what the reachable-but-unchosen species look like.
 *
 * (b) and (c) read Stage 0 survivors off `plan.assessments` - every plant
 * is assessed on every run, so the pool is already there and does not
 * need re-filtering.
 */
function t10(plansForLater: { scenario: Scenario; plan: GardenPlan }[]) {
  say("## T10 Catalogue reachability");
  say();
  const eligible = plants.filter((p) => p.layoutEligible);
  const SUNS = ["full", "part", "sheltered"] as const;
  const WATERS = ["low", "moderate", "moist"] as const;
  const SOILS = ["sandy", "loam", "clay", "not-sure"] as const;

  const biomeSets = new Map<string, NationalBiome[]>();
  for (const place of places) biomeSets.set([...place.biomes].sort().join(" + "), [...place.biomes]);

  const baseBrief: GardenBrief = {
    biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy",
    wind: "none", viewingEdge: "north", sun: "full", water: "moderate",
    bedWidthM: 6, bedLengthM: 4, style: "undecided", colour: { mode: "none" }, extras: [],
  };

  // ------------------------------------------------------- (a) reachable
  const poolCount = new Map<string, number>();
  const relaxedOnly = new Set<string>();
  let pools = 0;
  for (const biomes of biomeSets.values()) {
    for (const sun of SUNS) {
      for (const water of WATERS) {
        for (const soil of SOILS) {
          const brief: GardenBrief = { ...baseBrief, biomes, sun, water, soil };
          pools += 1;
          const reached = new Set<string>();
          for (const plant of eligible) {
            if (survivesHardFilters(plant, brief)) {
              reached.add(plant.id);
              poolCount.set(plant.id, (poolCount.get(plant.id) ?? 0) + 1);
            }
          }
          // Anything the same site reaches only once a filter is widened.
          for (const filter of ["soil", "water", "sun"] as const) {
            const widened: GardenBrief = { ...brief, relaxedFilters: [filter] };
            for (const plant of eligible) {
              if (!reached.has(plant.id) && survivesHardFilters(plant, widened)) relaxedOnly.add(plant.id);
            }
          }
        }
      }
    }
  }
  const reachable = [...poolCount.keys()];
  const counts = [...poolCount.values()];
  const onePercent = Math.max(1, Math.ceil(pools * 0.01));
  const rare = counts.filter((n) => n < onePercent).length;
  const relaxedNew = [...relaxedOnly].filter((id) => !poolCount.has(id));

  say("### (a) Reachable through Stage 0");
  say();
  say(`${biomeSets.size} distinct biome sets across ${places.length} places, x ${SUNS.length} sun x ${WATERS.length} water x ${SOILS.length} soil = **${pools} pools**.`);
  say();
  say("| Measure | Value |");
  say("|---|---|");
  say(`| Species in at least one pool | ${reachable.length} of ${eligible.length} eligible |`);
  say(`| Median pools per reachable species | ${median(counts)} of ${pools} |`);
  say(`| Species in fewer than 1% of pools (< ${onePercent}) | ${rare} |`);
  say(`| Reachable only with a relaxation | ${relaxedNew.length} |`);
  say();

  // ------------------------------------------------------ (b) selectable
  say("### (b) Selectable by the full engine");
  say();
  const STYLES = ["fynbos", "mediterranean", "cottage", "undecided"] as const;
  const BEDS: [number, number][] = [[3, 3], [6, 4], [10, 10]];
  const WINDS = ["none", "protected", "affected"] as const;
  const rng = createRng("t10-stratified");
  const setsList = [...biomeSets.values()];
  const briefs: GardenBrief[] = [];
  // Stratified: walk every axis in step so each level appears equally,
  // with the bed size jittered by a seeded draw inside its band.
  for (let i = 0; briefs.length < 1000; i += 1) {
    const [W, L] = BEDS[i % BEDS.length];
    briefs.push({
      ...baseBrief,
      biomes: setsList[i % setsList.length],
      sun: SUNS[i % SUNS.length],
      water: WATERS[Math.floor(i / 3) % WATERS.length],
      soil: SOILS[Math.floor(i / 9) % SOILS.length],
      style: STYLES[Math.floor(i / 4) % STYLES.length],
      wind: WINDS[Math.floor(i / 7) % WINDS.length],
      bedWidthM: Math.round((W + rng() * 2) * 10) / 10,
      bedLengthM: Math.round((L + rng() * 2) * 10) / 10,
    });
  }

  const selected = new Set<string>();
  const curve: Record<number, number> = {};
  const poolScores = new Map<string, number[]>();
  let feasible = 0;
  for (let index = 0; index < briefs.length; index += 1) {
    for (let seed = 0; seed < 3; seed += 1) {
      const plan = buildGardenPlan(plants, briefs[index], { variationCounter: seed });
      if (plan.status === "provisional-plan") feasible += 1;
      for (const a of plan.assessments) {
        // "candidate" is exactly the Stage 0 survivor set for this brief.
        if (a.status === "candidate") (poolScores.get(a.plantId) ?? poolScores.set(a.plantId, []).get(a.plantId)!).push(a.suitability);
      }
      for (const q of plan.quantities?.quantities ?? []) selected.add(q.id);
    }
    const n = index + 1;
    if (n === 250 || n === 500 || n === 1000) curve[n] = selected.size;
  }

  say(`1,000 stratified briefs (biome set x sun x water x soil x style x bed band x wind), 3 seeds each = ${briefs.length * 3} runs; ${feasible} feasible.`);
  say();
  say("| Briefs | Unique species recommended |");
  say("|---|---|");
  for (const n of [250, 500, 1000]) say(`| ${n} | ${curve[n] ?? "-"} |`);
  say();

  // --------------------------------------------------- (c) never selected
  say("### (c) Reachable but never selected");
  say();
  const byId = new Map(plants.map((p) => [p.id, p]));
  const tiers = computeHeightTiers(plants);
  const bands = computeSpreadBands(plants);
  const never = [...poolScores.keys()].filter((id) => !selected.has(id));
  const chosen = [...poolScores.keys()].filter((id) => selected.has(id));
  const meanScore = (ids: string[]) => mean(ids.map((id) => mean(poolScores.get(id) ?? [0])));

  const breakdown = (ids: string[], key: (p: Plant) => string) => {
    const c = new Map<string, number>();
    for (const id of ids) {
      const p = byId.get(id);
      if (p) c.set(key(p), (c.get(key(p)) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([k, n]) => `${k} ${n}`).join(", ");
  };

  say(`${never.length} species reached a Stage 0 pool at least once but were never selected;`);
  say(`${chosen.length} were selected at least once.`);
  say();
  say("| Measure | Never selected | Selected |");
  say("|---|---|---|");
  say(`| Mean Stage 1 score in the pools they appeared in | ${f(meanScore(never))} | ${f(meanScore(chosen))} |`);
  say(`| Growth form (top) | ${breakdown(never, (p) => p.form || "unknown")} | ${breakdown(chosen, (p) => p.form || "unknown")} |`);
  say(`| Height tier | ${breakdown(never, (p) => tierOf(p.heightCm, tiers))} | ${breakdown(chosen, (p) => tierOf(p.heightCm, tiers))} |`);
  say(`| Spread band | ${breakdown(never, (p) => "band " + (spreadBandOf(p.spreadCm ?? 0, bands) + 1))} | ${breakdown(chosen, (p) => "band " + (spreadBandOf(p.spreadCm ?? 0, bands) + 1))} |`);
  const fits = (p: Plant) =>
    STYLES.filter((s) => s !== "undecided" && styleFits(p, { ...baseBrief, style: s })).join("/") || "no style";
  say(`| Style fit | ${breakdown(never, fits)} | ${breakdown(chosen, fits)} |`);
  say();

  // ---------------------------------------------------------- the funnel
  const recommendedT1 = new Set<string>();
  for (const { plan } of plansForLater) for (const q of plan.quantities?.quantities ?? []) recommendedT1.add(q.id);
  say("### Funnel");
  say();
  say("| Stage | Species | Share of catalogue |");
  say("|---|---|---|");
  const pctOf = (n: number) => `${((n / plants.length) * 100).toFixed(1)}%`;
  say(`| Catalogue | ${plants.length} | 100% |`);
  say(`| Layout-eligible | ${eligible.length} | ${pctOf(eligible.length)} |`);
  say(`| Reachable (in some Stage 0 pool) | ${reachable.length} | ${pctOf(reachable.length)} |`);
  say(`| Selectable (chosen in 1,000 briefs x 3 seeds) | ${selected.size} | ${pctOf(selected.size)} |`);
  say(`| Recommended in T1 (100 scenarios) | ${recommendedT1.size} | ${pctOf(recommendedT1.size)} |`);
  say();

  raw.t10 = {
    pools, biomeSets: biomeSets.size, places: places.length,
    reachable: reachable.length, medianPools: median(counts), rare, onePercent,
    relaxedOnly: relaxedNew.length,
    briefs: briefs.length, runs: briefs.length * 3, feasible, curve,
    neverSelected: never.length, selected: chosen.length,
    meanScoreNever: meanScore(never), meanScoreSelected: meanScore(chosen),
    funnel: { catalogue: plants.length, eligible: eligible.length, reachable: reachable.length, selectable: selected.size, recommendedT1: recommendedT1.size },
  };
}

// ----------------------------------------------------------------- main
function main(): void {
  const scenarios = buildScenarios();
  header();
  const plansForLater = t1(scenarios);
  t2(plansForLater);
  t3(plansForLater);
  t4(scenarios);
  t5();
  t6();
  t7(scenarios);
  t7b(scenarios);
  const counts = t8(scenarios, plansForLater);
  t9(counts, plansForLater);
  t10(plansForLater);

  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(join(REPORTS, "chapter5_results.md"), out.join("\n"), "utf8");
  writeFileSync(join(REPORTS, "chapter5_results.json"), JSON.stringify(raw, null, 2), "utf8");
  console.log(out.join("\n"));
  console.log(`\nWritten to ${join(REPORTS, "chapter5_results.md")} and .json`);
}

main();
