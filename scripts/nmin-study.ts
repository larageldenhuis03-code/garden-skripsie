/**
 * Is N_min = 15 the right threshold? An empirical test against the data.
 *
 * N_min (1_Parameters, Stage 2) is the pool size below which the app says
 * there is too little to plan from and offers to widen a filter. The
 * rulebook records no published source for 15, so this measures what the
 * catalogue actually yields.
 *
 * Method. Every combination a user can reach is enumerated and run
 * through the real Stage 0 filters — the same `survivesHardFilters` the
 * app uses, so the study cannot drift from the engine:
 *
 *   12 biome sets (every set that a real place in the picker carries)
 *    x 3 light  x 3 water  x 4 soil          = 432 cases
 *
 * Each case is weighted by how many of the 1,558 places carry that biome
 * set, so "how often does a user fall below N_min" is answered for the
 * population of places people can actually choose, not for an even spread
 * over combinations that mostly do not exist.
 *
 * Two questions are answered separately, because they are different:
 *   1. How often does a pool fall below a candidate threshold?
 *   2. Is the threshold big enough to build the bed it is asked for? The
 *      species bands need S_max species (up to 20 on the largest beds),
 *      and a pool of N species cannot fill a bed needing more than N.
 *
 * Run: npm run study:nmin
 * Writes: scripts/nmin-study.csv
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { plants } from "../app/data/plants.ts";
import { places } from "../app/data/places.ts";
import type { NationalBiome, Sun, Water } from "../app/data/plants.ts";
import {
  MINIMUM_VIABLE_POOL,
  RULES,
  survivesHardFilters,
  type GardenBrief,
} from "../app/lib/planning/index.ts";
import type { Soil } from "../app/lib/planning/brief.ts";

const SUNS: Sun[] = ["full", "part", "sheltered"];
const WATERS: Water[] = ["low", "moderate", "moist"];
const SOILS: Soil[] = ["sandy", "loam", "clay", "not-sure"];

/** Every biome set a real place carries, and how many places carry it. */
function biomeSets(): { biomes: NationalBiome[]; label: string; placeCount: number }[] {
  const counts = new Map<string, { biomes: NationalBiome[]; placeCount: number }>();
  for (const place of places) {
    const label = [...place.biomes].sort().join(" + ");
    const entry = counts.get(label);
    if (entry) entry.placeCount += 1;
    else counts.set(label, { biomes: [...place.biomes], placeCount: 1 });
  }
  return [...counts.entries()]
    .map(([label, entry]) => ({ label, ...entry }))
    .sort((a, b) => b.placeCount - a.placeCount);
}

type Row = {
  biomes: string;
  places: number;
  sun: Sun;
  water: Water;
  soil: Soil;
  survivors: number;
  belowNMin: boolean;
};

function main(): void {
  const sets = biomeSets();
  const rows: Row[] = [];

  for (const set of sets) {
    for (const sun of SUNS) {
      for (const water of WATERS) {
        for (const soil of SOILS) {
          const brief: GardenBrief = {
            biomes: set.biomes,
            // Display-only; it does not filter (see docs/NOW.md).
            bioregion: "Southwest Fynbos Bioregion",
            soil,
            wind: "none",
            viewingEdge: "north",
            sun,
            water,
            bedWidthM: 4,
            bedLengthM: 3,
            style: "undecided",
            colour: { mode: "none" },
            extras: [],
          };
          const survivors = plants.filter((plant) => survivesHardFilters(plant, brief)).length;
          rows.push({
            biomes: set.label,
            places: set.placeCount,
            sun,
            water,
            soil,
            survivors,
            belowNMin: survivors < MINIMUM_VIABLE_POOL,
          });
        }
      }
    }
  }

  // ---- weighted by how many places can actually reach each case --------
  const totalPlaces = sets.reduce((sum, set) => sum + set.placeCount, 0);
  const caseWeight = (row: Row) => row.places / (SUNS.length * WATERS.length * SOILS.length);
  const weightedShareBelow = (threshold: number) =>
    rows.filter((row) => row.survivors < threshold).reduce((sum, row) => sum + caseWeight(row), 0) /
    totalPlaces;

  const survivors = rows.map((row) => row.survivors).sort((a, b) => a - b);
  const quantile = (q: number) => survivors[Math.floor(q * (survivors.length - 1))];

  const sMaxLargest = Math.max(...RULES.stage2.speciesBands.map((band) => band.sMax));
  const sMaxSmallest = Math.min(...RULES.stage2.speciesBands.map((band) => band.sMax));

  const lines = [
    "N_min study - how many plants survive each answerable combination",
    `Run: ${new Date().toISOString()}`,
    `Catalogue: ${plants.length} plants | rulebook N_min = ${MINIMUM_VIABLE_POOL}`,
    `${rows.length} cases: ${sets.length} biome sets x ${SUNS.length} light x ${WATERS.length} water x ${SOILS.length} soil`,
    `Weighted by the ${totalPlaces} places in the location picker.`,
    "",
    "POOL SIZE ACROSS ALL CASES",
    `    smallest ${survivors[0]} | 5th pct ${quantile(0.05)} | median ${quantile(0.5)} | 95th pct ${quantile(0.95)} | largest ${survivors[survivors.length - 1]}`,
    "",
    "HOW OFTEN A USER FALLS BELOW A CANDIDATE THRESHOLD",
    "    (share of place-and-answer combinations, weighted by places)",
    ...[5, 10, 15, 20, 25, 30, 40, 50].map((threshold) => {
      const unweighted = rows.filter((row) => row.survivors < threshold).length;
      const weighted = weightedShareBelow(threshold);
      const mark = threshold === MINIMUM_VIABLE_POOL ? "  <- rulebook N_min" : "";
      return `    below ${String(threshold).padStart(3)}: ${(weighted * 100).toFixed(1).padStart(5)}% of cases (${unweighted}/${rows.length} unweighted)${mark}`;
    }),
    "",
    "WHAT THE BED ACTUALLY NEEDS",
    `    The species bands ask for up to ${sMaxSmallest} species on the smallest beds and ${sMaxLargest} on the largest.`,
    `    A pool of N species cannot fill a bed needing more than N, whatever N_min says.`,
    ...[sMaxSmallest, sMaxLargest].map((need) => {
      const short = rows.filter((row) => row.survivors < need);
      const weighted = weightedShareBelow(need);
      return `    pools under ${String(need).padStart(2)} species: ${(weighted * 100).toFixed(1)}% of cases (${short.length}/${rows.length}) cannot fill a bed asking for ${need}`;
    }),
    "",
    "THE TIGHTEST COMBINATIONS",
    ...rows
      .slice()
      .sort((a, b) => a.survivors - b.survivors)
      .slice(0, 12)
      .map(
        (row) =>
          `    ${String(row.survivors).padStart(4)} plants | ${row.biomes} | ${row.sun} sun / ${row.water} water / ${row.soil} | ${row.places} places`,
      ),
    "",
    "BY SINGLE ANSWER (median pool when that answer is chosen)",
    ...[
      ["light", SUNS, (row: Row) => row.sun],
      ["water", WATERS, (row: Row) => row.water],
      ["soil", SOILS, (row: Row) => row.soil],
    ].flatMap(([label, values, pick]) => [
      `  ${label as string}:`,
      ...(values as string[]).map((value) => {
        const subset = rows
          .filter((row) => (pick as (r: Row) => string)(row) === value)
          .map((row) => row.survivors)
          .sort((a, b) => a - b);
        const below = subset.filter((n) => n < MINIMUM_VIABLE_POOL).length;
        return `    ${value.padEnd(10)} median ${String(subset[Math.floor(subset.length / 2)]).padStart(4)} | smallest ${String(subset[0]).padStart(4)} | ${below}/${subset.length} below N_min`;
      }),
    ]),
    "",
  ].join("\n");

  const out = join(dirname(fileURLToPath(import.meta.url)), "nmin-study.csv");
  const headers = ["biomes", "places", "sun", "water", "soil", "survivors", "belowNMin"] as const;
  writeFileSync(
    out,
    [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header]);
            return /[",\n]/.test(value) ? `"${value}"` : value;
          })
          .join(","),
      ),
    ].join("\n"),
    "utf8",
  );

  console.log(lines);
  console.log(`Full table written to ${out}`);
}

main();
