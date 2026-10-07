/**
 * C1 + C2 verification, and a k_headroom sensitivity sweep.
 *
 * Report only. Nothing agreed is changed: the k_headroom sweep uses the
 * `kHeadroom` override that already exists on EngineSite for exactly this
 * purpose, and C1/C2 are toggled through temporary env hooks in
 * engineConfig that are removed once this study has run.
 *
 * Part A  100 scenarios, C1+C2 on vs off:
 *         lateral imbalance, CONSTRAINT_FAIL count, mean cover (G4/A4),
 *         mean drift spread.
 * Part B  k_headroom at current, +25%, +50% on three bed sizes:
 *         selected group sizes n, and cover.
 *
 * Run: node --experimental-strip-types scripts/c1c2-study.ts
 *      (with C1_OFF=1 C2_OFF=1 for the baseline pass)
 */

import { plants } from "../app/data/plants.ts";
import {
  buildGardenPlan,
  computeHeightTiers,
  computeSpreadBands,
  engineSite,
  runEngine,
  scorePlantStage1,
  speciesInfo,
  survivesHardFilters,
  viewingAxis,
  type GardenBrief,
  type GardenPlan,
  type SpeciesInfo,
} from "../app/lib/planning/index.ts";
import { K_HEADROOM } from "../app/lib/planning/engineConfig.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "-");

/** (fullest third - emptiest third) / total canopy, across the bed's
 * viewer-facing width. Null when there is nothing placed. */
function lateralImbalance(plan: GardenPlan, brief: GardenBrief): number | null {
  const ps = plan.layout?.placements ?? [];
  if (ps.length < 3) return null;
  const axis = viewingAxis(brief.viewingEdge, brief.bedWidthM, brief.bedLengthM);
  const thirds = [0, 0, 0];
  for (const p of ps) {
    const t = Math.min(2, Math.floor((axis.acrossOf(p.xM, p.yM) / axis.across) * 3));
    thirds[t] += Math.PI * p.radiusM ** 2;
  }
  const total = thirds.reduce((a, b) => a + b, 0);
  return total > 0 ? (Math.max(...thirds) - Math.min(...thirds)) / total : null;
}

/** Mean distance of a group's members from their own centroid, in canopy
 * radii so groups of different sizes compare. Groups of 3+ only. */
function driftSpread(plan: GardenPlan): number[] {
  const ps = plan.layout?.placements ?? [];
  const groups = new Map<string, typeof ps>();
  for (const p of ps) {
    if (!groups.has(p.plantId)) groups.set(p.plantId, [] as typeof ps);
    groups.get(p.plantId)!.push(p);
  }
  const out: number[] = [];
  for (const g of groups.values()) {
    if (g.length < 3 || g[0].radiusM <= 0) continue;
    const cx = mean(g.map((p) => p.xM));
    const cy = mean(g.map((p) => p.yM));
    out.push(mean(g.map((p) => Math.hypot(p.xM - cx, p.yM - cy))) / g[0].radiusM);
  }
  return out;
}

/** The batch runner's CONSTRAINT_FAIL: any reported hard check or
 * placement check failing on a delivered plan. */
function constraintFail(plan: GardenPlan): boolean {
  if (plan.status !== "provisional-plan" || !plan.engine) return false;
  return (
    plan.engine.hard.some((h) => !h.pass) ||
    plan.engine.placementChecks.some((c) => c.kind === "hard" && !c.pass)
  );
}

function partA(): void {
  const label = `C1 ${process.env.C1_OFF ? "OFF" : "ON"} / C2 ${process.env.C2_OFF ? "OFF" : "ON"}`;
  const scenarios = buildScenarios();
  const imbalance: number[] = [];
  const cover: number[] = [];
  const a4: number[] = [];
  const drift: number[] = [];
  let fails = 0;
  let planned = 0;

  for (const scenario of scenarios) {
    let plan: GardenPlan;
    try {
      plan = buildGardenPlan(plants, scenario.brief);
    } catch {
      continue;
    }
    if (plan.status !== "provisional-plan" || !plan.layout) continue;
    planned += 1;
    if (constraintFail(plan)) fails += 1;
    const imb = lateralImbalance(plan, scenario.brief);
    if (imb !== null) imbalance.push(imb);
    cover.push(1 - plan.layout.realisedOpenSpaceRatio);
    if (plan.engine) a4.push(plan.engine.goals.A4);
    drift.push(...driftSpread(plan));
  }

  console.log(`\n=== Part A: 100 scenarios, ${label} ===`);
  console.log(`  plans delivered            ${planned} / ${scenarios.length}`);
  console.log(`  CONSTRAINT_FAIL            ${fails}`);
  console.log(`  mean lateral imbalance     ${f(mean(imbalance) * 100)}%  (n = ${imbalance.length})`);
  console.log(`  mean realised cover        ${f(mean(cover) * 100)}%`);
  console.log(`  mean G4 (A4 goal)          ${f(mean(a4), 3)}`);
  console.log(`  mean drift spread          ${f(mean(drift), 2)} radii  (n = ${drift.length} groups)`);
}

function poolFor(brief: GardenBrief, bedAreaM2: number): SpeciesInfo[] {
  const tiers = computeHeightTiers(plants);
  const bands = computeSpreadBands(plants);
  const site = engineSite(brief);
  return plants
    .filter((plant) => survivesHardFilters(plant, brief))
    .flatMap((plant) => {
      const info = speciesInfo(
        plant,
        scorePlantStage1(plant, { brief, savedPlantIds: [] }).score,
        tiers,
        bands,
        bedAreaM2,
      );
      return info && info.diameterM >= 0.15 && info.diameterM <= Math.min(site.widthM, site.depthM)
        ? [info]
        : [];
    });
}

function partB(): void {
  console.log(`\n=== Part B: k_headroom sensitivity (current ${K_HEADROOM}) ===`);
  console.log("  Report only - k_headroom is an AGREED value and is not changed in the");
  console.log("  rulebook. The override is EngineSite.kHeadroom, which exists for studies.\n");

  // The review named "the 10 x 6 m fynbos bed plus two larger beds
  // (24 m2, 50 m2)". 10 x 6 is 60 m2, so those two are smaller, not
  // larger; all three are run as named.
  const beds: [number, number, string][] = [
    [10, 6, "10 x 6 m (60 m2)"],
    [6, 4, "6 x 4 m (24 m2)"],
    [10, 5, "10 x 5 m (50 m2)"],
  ];
  const multipliers = [1, 1.25, 1.5];

  console.log(
    `  ${"bed".padEnd(18)}${"k_head".padEnd(9)}${"species".padEnd(9)}${"cover".padEnd(8)}${"largest n".padEnd(11)}group sizes`,
  );
  for (const [W, L, name] of beds) {
    const brief: GardenBrief = {
      biomes: ["Fynbos"],
      bioregion: "Southwest Fynbos Bioregion",
      soil: "sandy",
      wind: "none",
      viewingEdge: "north",
      sun: "full",
      water: "moderate",
      bedWidthM: W,
      bedLengthM: L,
      style: "fynbos",
      colour: { mode: "none" },
      extras: [],
    };
    const pool = poolFor(brief, W * L);
    for (const m of multipliers) {
      const site = { ...engineSite(brief), kHeadroom: K_HEADROOM * m };
      const run = runEngine(pool, site, `khead-${W}x${L}-${m}`);
      if (run.status !== "plan" || !run.placement) {
        console.log(`  ${name.padEnd(18)}${f(K_HEADROOM * m, 2).padEnd(9)}no plan`);
        continue;
      }
      const sizes = [...run.selection.values()].sort((a, b) => b - a);
      const canopy = [...run.selection].reduce((sum, [id, n]) => {
        const info = pool.find((p) => p.id === id);
        return sum + (info ? info.areaM2 * n : 0);
      }, 0);
      console.log(
        `  ${name.padEnd(18)}${f(K_HEADROOM * m, 2).padEnd(9)}${String(sizes.length).padEnd(9)}` +
          `${(f((canopy / (W * L)) * 100) + "%").padEnd(8)}${String(sizes[0] ?? 0).padEnd(11)}${sizes.join(", ")}`,
      );
    }
    console.log("");
  }
}

const only = process.argv[2];
if (only !== "B") partA();
if (only !== "A") partB();
