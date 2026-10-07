/**
 * Are the G1 tier targets reachable from the pools Stage 0 actually leaves?
 *
 * G1 scores the bed's height mix against tau: A1 = 1 - 0.5 * sum |p_t -
 * tau_t| over the short / medium / tall tiers. A pool with no tall species
 * cannot reach a tau that asks for 60% tall, however well the optimiser
 * searches - so this measures the ceiling the DATA puts on A1, before any
 * search happens.
 *
 * For every combination a user can reach (12 biome sets x 3 light x 3
 * water x 4 soil), the pool is built with the real Stage 0 filters, split
 * into tiers by the same p30 / p60 thresholds the engine uses, and the
 * best achievable A1 computed for each style: if a tier has no species,
 * its share is forced to 0 and the shortfall is spread over the tiers that
 * do have species.
 *
 * Run: npm run study:tiers
 */

import { plants } from "../app/data/plants.ts";
import { places } from "../app/data/places.ts";
import type { NationalBiome, Sun, Water } from "../app/data/plants.ts";
import {
  computeHeightTiers,
  RULES,
  survivesHardFilters,
  type GardenBrief,
} from "../app/lib/planning/index.ts";
import type { Soil } from "../app/lib/planning/brief.ts";

const SUNS: Sun[] = ["full", "part", "sheltered"];
const WATERS: Water[] = ["low", "moderate", "moist"];
const SOILS: Soil[] = ["sandy", "loam", "clay", "not-sure"];
const STYLES = ["fynbos", "mediterranean", "cottage", "generic"] as const;
type Tier = "short" | "medium" | "tall";

/**
 * The best A1 a pool can reach. Tiers with no species are stuck at 0; the
 * plants they would have held go to the tiers that do have species, which
 * is the most generous assumption, so this is an upper bound.
 */
function bestA1(available: Record<Tier, number>, tau: Record<Tier, number>): number {
  const missing = (["short", "medium", "tall"] as Tier[]).filter((t) => available[t] === 0);
  if (missing.length === 0) return 1;
  const lost = missing.reduce((sum, t) => sum + tau[t], 0);
  if (lost >= 1) return 0;
  // Shortfall of `lost` in the empty tiers, and the same `lost` spread as
  // surplus across the others: sum |p - tau| = 2 * lost.
  return Math.max(0, 1 - 0.5 * (2 * lost));
}

function main(): void {
  const tiers = computeHeightTiers(plants);
  const tierOf = (heightCm: number | null): Tier | null =>
    heightCm === null ? null : heightCm >= tiers.p60 ? "tall" : heightCm >= tiers.p30 ? "medium" : "short";

  const sets = new Map<string, { biomes: NationalBiome[]; placeCount: number }>();
  for (const place of places) {
    const label = [...place.biomes].sort().join(" + ");
    const found = sets.get(label);
    if (found) found.placeCount += 1;
    else sets.set(label, { biomes: [...place.biomes], placeCount: 1 });
  }
  const totalPlaces = [...sets.values()].reduce((sum, s) => sum + s.placeCount, 0);

  console.log("G1 tier targets against the pools Stage 0 leaves");
  console.log("");
  console.log(`  Tier thresholds from the data: short < ${tiers.p30} cm, medium ${tiers.p30} to under ${tiers.p60} cm, tall >= ${tiers.p60} cm`);
  console.log("  tau by style: " + STYLES.map((s) => `${s} ${JSON.stringify(RULES.styles[s].tau)}`).join("  "));
  console.log("");

  type Case = { weight: number; pool: number; counts: Record<Tier, number> };
  const cases: Case[] = [];

  for (const [, set] of sets) {
    for (const sun of SUNS) {
      for (const water of WATERS) {
        for (const soil of SOILS) {
          const brief: GardenBrief = {
            biomes: set.biomes, bioregion: "Southwest Fynbos Bioregion", soil,
            wind: "none", viewingEdge: "north", sun, water,
            bedWidthM: 4, bedLengthM: 3, style: "undecided",
            colour: { mode: "none" }, extras: [],
          };
          const counts: Record<Tier, number> = { short: 0, medium: 0, tall: 0 };
          let pool = 0;
          for (const plant of plants) {
            if (!plant.layoutEligible || !survivesHardFilters(plant, brief)) continue;
            const tier = tierOf(plant.heightCm);
            if (tier === null) continue;
            counts[tier] += 1;
            pool += 1;
          }
          cases.push({ weight: set.placeCount / (SUNS.length * WATERS.length * SOILS.length), pool, counts });
        }
      }
    }
  }

  const withPlants = cases.filter((c) => c.pool > 0);
  console.log(`  ${cases.length} reachable combinations; ${cases.length - withPlants.length} have an empty pool.`);
  const pools = withPlants.map((c) => c.pool).sort((a, b) => a - b);
  console.log(`  Pool size (layout-eligible, with a height): min ${pools[0]} | median ${pools[Math.floor(pools.length / 2)]} | max ${pools[pools.length - 1]}`);
  console.log("");

  console.log("  Share of cases (weighted by places) whose pool is MISSING a tier entirely:");
  for (const tier of ["short", "medium", "tall"] as Tier[]) {
    const weighted = cases.filter((c) => c.pool > 0 && c.counts[tier] === 0)
      .reduce((sum, c) => sum + c.weight, 0) / totalPlaces;
    const raw = cases.filter((c) => c.pool > 0 && c.counts[tier] === 0).length;
    console.log(`    no ${tier.padEnd(7)} species: ${(weighted * 100).toFixed(1).padStart(5)}%  (${raw}/${withPlants.length} combinations)`);
  }
  console.log("");

  console.log("  Best A1 the pool allows, by style:");
  console.log("    style          A1 = 1 in      A1 < 1 in      worst A1   mean A1");
  for (const style of STYLES) {
    const tau = RULES.styles[style].tau as Record<Tier, number>;
    const scores = withPlants.map((c) => ({ a1: bestA1(c.counts, tau), weight: c.weight }));
    const perfect = scores.filter((s) => s.a1 >= 1 - 1e-9);
    const capped = scores.filter((s) => s.a1 < 1 - 1e-9);
    const wShare = (xs: typeof scores) => xs.reduce((sum, s) => sum + s.weight, 0) / totalPlaces;
    const meanA1 = scores.reduce((sum, s) => sum + s.a1 * s.weight, 0) / scores.reduce((sum, s) => sum + s.weight, 0);
    console.log(
      `    ${style.padEnd(15)}${(wShare(perfect) * 100).toFixed(1).padStart(5)}%        ${(wShare(capped) * 100).toFixed(1).padStart(5)}%       ` +
        `${Math.min(...scores.map((s) => s.a1)).toFixed(2).padStart(6)}    ${meanA1.toFixed(3)}`,
    );
  }

  console.log("");
  console.log("  Reading: A1 = 1 means the pool CAN hit tau exactly; anything less is a ceiling");
  console.log("  the data imposes, not a failure of the optimiser. The bound is generous - it");
  console.log("  assumes the missing tier's share is absorbed perfectly by the others.");
}

main();
