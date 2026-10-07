/**
 * The 100 batch-verification scenarios, generated deterministically.
 *
 * Three blocks:
 *   72  every sun x water x soil combination (3 x 3 x 4 = 36), each run
 *       twice, with location, wind, bed size, style and colour rotated
 *       evenly across the runs so no site combination is tied to one
 *       set of preferences.
 *   16  the limits of the bed-size fields: smallest, largest, long and
 *       thin both ways, and decimal sizes.
 *   12  stress cases: deep shade on wet clay, a rare colour, every extra
 *       ticked at once, and colours that fight the chosen style.
 *
 * Locations are real rows from the place list, chosen one per bioregion so
 * the sweep covers genuinely different biome sets rather than invented
 * ones. Nothing here is random: the same file always produces the same
 * 100 briefs, which is what makes the repeatability block meaningful.
 */

import { places } from "../../app/data/places.ts";
import type { GardenBrief } from "../../app/lib/planning/index.ts";
import type { Sun, Water } from "../../app/data/plants.ts";
import type { Soil, ViewingEdge, Wind } from "../../app/lib/planning/brief.ts";
import type {
  ColourPreference,
  ExtraPreference,
  GardenStyle,
} from "../../app/lib/planning/preferences.ts";

export type ScenarioBlock = "site" | "bed-size" | "stress";

export type Scenario = {
  id: string;
  block: ScenarioBlock;
  label: string;
  place: string;
  brief: GardenBrief;
};

const SUNS: Sun[] = ["full", "part", "sheltered"];
const WATERS: Water[] = ["low", "moderate", "moist"];
const SOILS: Soil[] = ["sandy", "loam", "clay", "not-sure"];
const WINDS: Wind[] = ["none", "protected", "affected"];
const VIEWING_EDGES: ViewingEdge[] = ["north", "east", "south", "west"];
const STYLES: GardenStyle[] = ["fynbos", "mediterranean", "cottage", "undecided"];

const COLOURS: ColourPreference[] = [
  { mode: "none" },
  { mode: "scheme", scheme: "warm" },
  { mode: "scheme", scheme: "cool" },
  { mode: "scheme", scheme: "neutral" },
  { mode: "custom", colours: ["Pink", "White"] },
];

const EXTRA_SETS: ExtraPreference[][] = [
  [],
  ["pollinators"],
  ["low-maintenance", "fragrance"],
  ["wildlife"],
  ["privacy", "pollinators"],
];

/** Bed sizes for the site block, from small to large. */
const SITE_BEDS: [number, number][] = [
  [2, 3],
  [4, 2],
  [6, 4],
  [8, 5],
  [3, 3],
  [12, 8],
];

/**
 * One place per bioregion, taking the first by name so the choice is
 * stable, and preferring the categories whose footprint is small enough
 * for a single biome set to be meaningful (a District can span several).
 */
function locationRotation(): { name: string; biomes: GardenBrief["biomes"]; bioregion: GardenBrief["bioregion"] }[] {
  const precise = places
    .filter((place) => place.category === "Suburb" || place.category === "Urban" || place.category === "Rural")
    .filter((place) => place.biomes.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const byBioregion = new Map<string, (typeof precise)[number]>();
  for (const place of precise) {
    if (!byBioregion.has(place.bioregion)) byBioregion.set(place.bioregion, place);
  }
  return [...byBioregion.values()]
    .sort((a, b) => a.bioregion.localeCompare(b.bioregion))
    .map((place) => ({ name: place.name, biomes: place.biomes, bioregion: place.bioregion }));
}

const LOCATIONS = locationRotation();

function briefFor(
  index: number,
  overrides: Partial<GardenBrief> & { sun: Sun; water: Water; soil: Soil },
): { place: string; brief: GardenBrief } {
  const location = LOCATIONS[index % LOCATIONS.length];
  const [width, length] = SITE_BEDS[index % SITE_BEDS.length];
  return {
    place: location.name,
    brief: {
      biomes: location.biomes,
      bioregion: location.bioregion,
      wind: WINDS[index % WINDS.length],
      viewingEdge: VIEWING_EDGES[index % VIEWING_EDGES.length],
      bedWidthM: width,
      bedLengthM: length,
      style: STYLES[index % STYLES.length],
      colour: COLOURS[index % COLOURS.length],
      extras: EXTRA_SETS[index % EXTRA_SETS.length],
      ...overrides,
    },
  };
}

function siteBlock(): Scenario[] {
  const out: Scenario[] = [];
  let index = 0;
  // Two passes over all 36 combinations. The rotations use `index`, which
  // keeps counting across both passes, so a combination never gets the
  // same location, wind, bed and style twice.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const sun of SUNS) {
      for (const water of WATERS) {
        for (const soil of SOILS) {
          const { place, brief } = briefFor(index, { sun, water, soil });
          out.push({
            id: `S${String(out.length + 1).padStart(3, "0")}`,
            block: "site",
            label: `${sun} sun / ${water} water / ${soil} (pass ${pass + 1})`,
            place,
            brief,
          });
          index += 1;
        }
      }
    }
  }
  return out;
}

/** The limits of the two size fields, and the shapes between them. */
const BED_CASES: { w: number; l: number; note: string }[] = [
  { w: 0.5, l: 0.5, note: "smallest allowed bed" },
  { w: 0.5, l: 30, note: "minimum width, maximum length" },
  { w: 30, l: 0.5, note: "maximum width, minimum length" },
  { w: 30, l: 30, note: "largest allowed bed" },
  { w: 1, l: 1, note: "one square metre" },
  { w: 1, l: 10, note: "long thin strip" },
  { w: 10, l: 1, note: "wide shallow strip" },
  { w: 0.8, l: 12, note: "narrow border, under one row deep" },
  { w: 2.5, l: 1.5, note: "decimal sizes" },
  { w: 7.25, l: 3.75, note: "decimal sizes, mid-range" },
  { w: 15, l: 2, note: "long bed, two rows deep" },
  { w: 2, l: 15, note: "deep narrow bed" },
  { w: 20, l: 20, note: "large square" },
  { w: 25, l: 4, note: "long boundary bed" },
  { w: 4, l: 25, note: "deep boundary bed" },
  { w: 0.6, l: 0.9, note: "smaller than one plant canopy" },
];

function bedSizeBlock(offset: number): Scenario[] {
  return BED_CASES.map((bed, i) => {
    const { place, brief } = briefFor(i, { sun: "full", water: "moderate", soil: "sandy" });
    return {
      id: `S${String(offset + i + 1).padStart(3, "0")}`,
      block: "bed-size" as const,
      label: `${bed.w} x ${bed.l} m - ${bed.note}`,
      place,
      brief: { ...brief, bedWidthM: bed.w, bedLengthM: bed.l },
    };
  });
}

/** Deliberately awkward combinations, each testing one specific risk. */
const STRESS_CASES: { label: string; patch: Partial<GardenBrief> }[] = [
  { label: "deep shade on wet clay", patch: { sun: "sheltered", water: "moist", soil: "clay" } },
  { label: "deep shade, low water, clay - contradictory site", patch: { sun: "sheltered", water: "low", soil: "clay" } },
  { label: "every extra ticked at once", patch: { extras: ["low-maintenance", "privacy", "pollinators", "fragrance", "wildlife"] } },
  { label: "a rare colour only", patch: { colour: { mode: "custom", colours: ["Black"] } } },
  { label: "two rare colours", patch: { colour: { mode: "custom", colours: ["Black", "Green"] } } },
  { label: "cool colours with a Mediterranean style", patch: { style: "mediterranean", colour: { mode: "scheme", scheme: "cool" } } },
  { label: "warm colours with a fynbos style in full wind", patch: { style: "fynbos", colour: { mode: "scheme", scheme: "warm" }, wind: "affected" } },
  { label: "wind affected on a bed too shallow for rows", patch: { wind: "affected", bedWidthM: 6, bedLengthM: 1 } },
  { label: "soil not sure, water not certain, sheltered", patch: { sun: "sheltered", water: "moist", soil: "not-sure" } },
  { label: "privacy screening in a one-metre bed", patch: { extras: ["privacy"], bedWidthM: 1, bedLengthM: 1 } },
  { label: "cottage style on sand in full sun, low water", patch: { style: "cottage", sun: "full", water: "low", soil: "sandy" } },
  { label: "large bed, every extra, custom colours, wind", patch: { bedWidthM: 20, bedLengthM: 10, wind: "affected", extras: ["low-maintenance", "privacy", "pollinators", "fragrance", "wildlife"], colour: { mode: "custom", colours: ["Pink", "Yellow", "White"] } } },
];

function stressBlock(offset: number): Scenario[] {
  return STRESS_CASES.map((stress, i) => {
    const { place, brief } = briefFor(i + 3, { sun: "part", water: "moderate", soil: "loam" });
    return {
      id: `S${String(offset + i + 1).padStart(3, "0")}`,
      block: "stress" as const,
      label: stress.label,
      place,
      brief: { ...brief, ...stress.patch },
    };
  });
}

export function buildScenarios(): Scenario[] {
  const site = siteBlock();
  const beds = bedSizeBlock(site.length);
  const stress = stressBlock(site.length + beds.length);
  return [...site, ...beds, ...stress];
}

export const LOCATION_COUNT = LOCATIONS.length;
