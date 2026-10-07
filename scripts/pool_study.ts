/**
 * Two questions about N_min, answered by running the whole engine.
 *
 * A. POOL SIZE. Take the site combinations whose pool is already tight
 *    (15-25 species), plan a bed from each area band, and record whether
 *    H1-H5 hold and what Z comes out. Then repeat with the pool cut to
 *    10, 15, 20 and 30 by keeping the highest-scoring species, which is
 *    what a smaller catalogue would look like from Stage 2 onwards.
 *
 *    Reading: if layouts hold at 15 and fail at 10, N_min = 15 is earned.
 *    If band 3 fails at 15, N_min should follow the bed's S_min instead of
 *    being one number for every bed.
 *
 * B. LOOSENING COST. For the combinations that trigger a relaxation,
 *    plan with and without it and compare Z, so the price of widening a
 *    filter is measured rather than assumed.
 *
 * Run: npm run study:pool
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { plants } from "../app/data/plants.ts";
import { places } from "../app/data/places.ts";
import type { NationalBiome, Plant, Sun, Water } from "../app/data/plants.ts";
import {
  buildGardenPlan,
  evaluateHardFilters,
  RULES,
  scorePlantStage1,
  survivesHardFilters,
  type GardenBrief,
} from "../app/lib/planning/index.ts";
import type { RelaxableFilter, Soil } from "../app/lib/planning/brief.ts";

const SUNS: Sun[] = ["full", "part", "sheltered"];
const WATERS: Water[] = ["low", "moderate", "moist"];
const SOILS: Soil[] = ["sandy", "loam", "clay", "not-sure"];
/** One bed per species band: 9 m2 (3-6 species), 24 m2 (5-12), 100 m2 (10-20). */
const BEDS: { label: string; W: number; L: number }[] = [
  { label: "band 1  3x3", W: 3, L: 3 },
  { label: "band 2  6x4", W: 6, L: 4 },
  { label: "band 3 10x10", W: 10, L: 10 },
];
const CUTS = [10, 15, 20, 30, Infinity];

function combinations(): { label: string; brief: GardenBrief; pool: number }[] {
  const sets = new Map<string, NationalBiome[]>();
  for (const place of places) sets.set([...place.biomes].sort().join(" + "), [...place.biomes]);
  const out: { label: string; brief: GardenBrief; pool: number }[] = [];
  for (const [label, biomes] of sets) {
    for (const sun of SUNS) {
      for (const water of WATERS) {
        for (const soil of SOILS) {
          const brief: GardenBrief = {
            biomes, bioregion: "Southwest Fynbos Bioregion", soil, wind: "none",
            viewingEdge: "north", sun, water, bedWidthM: 6, bedLengthM: 4,
            style: "undecided", colour: { mode: "none" }, extras: [],
          };
          const pool = plants.filter((p) => p.layoutEligible && survivesHardFilters(p, brief)).length;
          out.push({ label: `${label} | ${sun}/${water}/${soil}`, brief, pool });
        }
      }
    }
  }
  return out;
}

/** The n highest-scoring species for this brief - a smaller catalogue. */
function cutPool(brief: GardenBrief, n: number): Plant[] {
  if (!Number.isFinite(n)) return [...plants];
  const survivors = plants.filter((p) => survivesHardFilters(p, brief));
  const kept = new Set(
    survivors
      .map((p) => ({ id: p.id, score: scorePlantStage1(p, { brief, savedPlantIds: [] }).score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, n)
      .map((x) => x.id),
  );
  // Non-survivors are kept in the list: they are filtered out anyway, and
  // dropping them would change nothing except the assessment count.
  return plants.filter((p) => kept.has(p.id) || !survivors.includes(p));
}

type Row = {
  part: string; cut: string; bed: string; cases: number;
  planned: number; all_hard_pass: number; mean_z: string; min_z: string; note: string;
};

function main(): void {
  const rows: Row[] = [];
  const all = combinations();

  // ------------------------------------------------------ A. pool size
  const tight = all.filter((c) => c.pool >= 15 && c.pool <= 25);
  console.log("A. POOL SIZE - do tight pools still produce valid layouts?\n");
  console.log(`  ${tight.length} of ${all.length} combinations have a pool of 15-25 species.`);
  if (tight.length > 0) {
    console.log("  e.g. " + tight.slice(0, 3).map((c) => `${c.label} (${c.pool})`).join("; "));
  }
  console.log("");
  console.log("  cut    bed            cases  planned  all H1-H5 pass  mean Z   min Z");
  for (const cut of CUTS) {
    for (const bed of BEDS) {
      let planned = 0;
      let allPass = 0;
      const zs: number[] = [];
      for (const c of tight) {
        const brief = { ...c.brief, bedWidthM: bed.W, bedLengthM: bed.L };
        const pool = cutPool(brief, cut);
        const plan = buildGardenPlan(pool, brief);
        if (plan.status === "provisional-plan") {
          planned += 1;
          const hard = plan.engine?.hard ?? [];
          if (hard.length > 0 && hard.every((h) => h.pass)) allPass += 1;
          if (plan.engine) zs.push(plan.engine.z);
        }
      }
      const label = Number.isFinite(cut) ? String(cut) : "full";
      rows.push({
        part: "pool-size", cut: label, bed: bed.label, cases: tight.length,
        planned, all_hard_pass: allPass,
        mean_z: zs.length ? (zs.reduce((a, b) => a + b, 0) / zs.length).toFixed(4) : "-",
        min_z: zs.length ? Math.min(...zs).toFixed(4) : "-",
        note: "",
      });
      console.log(
        `  ${label.padEnd(7)}${bed.label.padEnd(15)}${String(tight.length).padStart(5)}` +
          `${String(planned).padStart(9)}${String(allPass).padStart(16)}` +
          `${(zs.length ? (zs.reduce((a, b) => a + b, 0) / zs.length).toFixed(4) : "-").padStart(9)}` +
          `${(zs.length ? Math.min(...zs).toFixed(4) : "-").padStart(8)}`,
      );
    }
  }

  console.log("");
  console.log("  S_min by band: " + RULES.stage2.speciesBands.map((b, i) => `band ${i + 1} ${b.sMin}`).join(", ") +
    "  (1.5x S_min = " + RULES.stage2.speciesBands.map((b) => (b.sMin * 1.5).toFixed(0)).join(", ") +
    ", 2x = " + RULES.stage2.speciesBands.map((b) => b.sMin * 2).join(", ") + ")");

  // -------------------------------------------------- B. loosening cost
  console.log("\n\nB. LOOSENING COST - what does widening a filter buy, and what does it cost Z?\n");
  const triggers = all.filter((c) => evaluateHardFilters(plants, c.brief).belowMinimum);
  console.log(`  ${triggers.length} combinations fall below N_min = ${RULES.stage2.nMin} and are offered a relaxation.\n`);
  console.log("  combination                                        filter  pool ->  pool'   Z before  Z after   dZ");

  let improved = 0;
  let rescued = 0;
  const deltas: number[] = [];
  for (const c of triggers.slice(0, 24)) {
    const brief = { ...c.brief, bedWidthM: 6, bedLengthM: 4 };
    const outcome = evaluateHardFilters(plants, brief);
    const option = outcome.relaxations[0];
    if (!option) continue;
    const before = buildGardenPlan(plants, brief);
    const after = buildGardenPlan(plants, {
      ...brief,
      relaxedFilters: [...(brief.relaxedFilters ?? []), option.filter as RelaxableFilter],
    });
    const zBefore = before.engine?.z ?? null;
    const zAfter = after.engine?.z ?? null;
    if (zBefore === null && zAfter !== null) rescued += 1;
    if (zBefore !== null && zAfter !== null) {
      deltas.push(zAfter - zBefore);
      if (zAfter > zBefore) improved += 1;
    }
    rows.push({
      part: "loosening", cut: "-", bed: option.filter, cases: 1,
      planned: after.status === "provisional-plan" ? 1 : 0,
      all_hard_pass: 0,
      mean_z: zAfter === null ? "-" : zAfter.toFixed(4),
      min_z: zBefore === null ? "-" : zBefore.toFixed(4),
      note: c.label,
    });
    console.log(
      `  ${c.label.slice(0, 48).padEnd(50)}${option.filter.padEnd(8)}${String(outcome.survivingCount).padStart(4)} -> ${String(option.recoveredCount).padStart(5)}   ` +
        `${(zBefore === null ? "no plan" : zBefore.toFixed(4)).padStart(8)}  ${(zAfter === null ? "no plan" : zAfter.toFixed(4)).padStart(8)}  ` +
        `${zBefore !== null && zAfter !== null ? (zAfter - zBefore >= 0 ? "+" : "") + (zAfter - zBefore).toFixed(4) : "-"}`,
    );
  }
  const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  console.log("");
  console.log(`  Of the cases shown: ${rescued} had no plan until the filter was widened;`);
  console.log(`  where both sides planned, Z rose in ${improved}/${deltas.length}, mean change ${meanDelta >= 0 ? "+" : ""}${meanDelta.toFixed(4)}.`);
  console.log("  A relaxation buys a bigger pool; Z can still fall, because a wider pool is not");
  console.log("  automatically a better-scoring one.");

  const out = join(dirname(fileURLToPath(import.meta.url)), "pool_study.csv");
  const headers = Object.keys(rows[0]) as (keyof Row)[];
  writeFileSync(
    out,
    [headers.join(","), ...rows.map((r) => headers.map((h) => {
      const v = String(r[h]);
      return /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(","))].join(String.fromCharCode(10)),
    "utf8",
  );
  console.log(`\nWritten to ${out}`);
}

main();
