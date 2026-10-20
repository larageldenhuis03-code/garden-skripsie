import type { Plant } from "../../data/plants.ts";
import { COLOUR_SCHEMES, EXTRA_TAGS } from "./stage1Config.ts";

/** Style, colour and extras are SOFT preferences: nothing in this file
 * removes a species from the pool. How they score is Stage 1 (stage1.ts);
 * the numbers and mappings live in stage1Config.ts. */

export type GardenStyle =
  | "mediterranean"
  | "cottage"
  | "fynbos"
  | "undecided";

export const gardenStyleLabels: Record<GardenStyle, string> = {
  mediterranean: "Mediterranean",
  cottage: "Cottage garden",
  fynbos: "Indigenous / fynbos",
  undecided: "Undecided",
};

export const gardenStyleDescriptions: Record<GardenStyle, string> = {
  mediterranean: "Hardy, structured planting with shrubs and succulents.",
  cottage: "Soft, informal, densely mixed flowering plants.",
  fynbos:
    "Locally native species that support local wildlife and need little intervention.",
  undecided: "No style preference; prioritise variety and reliability.",
};

export type ColourScheme = "warm" | "cool" | "neutral";

export const colourSchemeLabels: Record<ColourScheme, string> = {
  warm: "Warm",
  cool: "Cool",
  neutral: "Neutral",
};

/** The scheme -> atomic colours mapping lives in the Stage 1 config. */
export const colourSchemes = COLOUR_SCHEMES;

export type ColourPreference =
  | { mode: "none" }
  | { mode: "scheme"; scheme: ColourScheme }
  | { mode: "custom"; colours: string[] };

/** Every atomic colour present in a pool, with counts, for the custom
 * picker - so the user is only offered colours they can actually get
 * (spec 5.2). */
export function availableColours(
  pool: readonly Plant[],
): { colour: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const plant of pool) {
    for (const colour of plant.flowerColour ?? []) {
      counts.set(colour, (counts.get(colour) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([colour, count]) => ({ colour, count }))
    .sort((left, right) => right.count - left.count);
}

/** True when a plant has no recorded colour, so the layout view can draw
 * it as neutral foliage with a dashed outline rather than guessing
 * (spec 5.2). */
export function hasUnknownColour(plant: Plant): boolean {
  return plant.flowerColour === null || plant.flowerColour.length === 0;
}

/** Optional extras (spec 6). Every one is sourced from
 * `special_features` - no other column may stand in for these - and every
 * one is soft: a selected extra PROMOTES the species that carry its tags
 * and never penalises the 32.4% of the pool that carry no tags at all.
 * The tags are positive flags: absence means "not recorded", not "untrue". */
export type ExtraPreference =
  | "low-maintenance"
  | "privacy"
  | "pollinators"
  | "fragrance"
  | "wildlife";

export const extraPreferenceLabels: Record<ExtraPreference, string> = {
  "low-maintenance": "Low maintenance",
  privacy: "Privacy / screening",
  pollinators: "Flowers & pollinators",
  fragrance: "Fragrance",
  wildlife: "Attract birds",
};

export const extraPreferenceDescriptions: Record<ExtraPreference, string> = {
  "low-maintenance": "Drought-hardy and forgiving once established.",
  privacy: "Taller plants that screen a view or boundary.",
  pollinators: "Feeds bees and butterflies through the flowering season.",
  fragrance: "Scented flowers or foliage.",
  wildlife: "Food and shelter for birds.",
};

/** The tags each extra reads are in the Stage 1 config (EXTRA_TAGS). */
export function matchesExtra(plant: Plant, extra: ExtraPreference): boolean {
  const tags = EXTRA_TAGS[extra];
  return (plant.specialFeatures ?? []).some((feature) => tags.includes(feature));
}

/** Privacy is the thin one: only 148 species in the recommendable pool
 * carry `Hedge/screen`, and after the site filters very few may survive.
 * The interface has to say so rather than quietly ignoring the
 * preference (spec 6). */
export const MINIMUM_SCREENING_SPECIES = 3;

export function countScreeningSpecies(pool: readonly Plant[]): number {
  return pool.filter((plant) => matchesExtra(plant, "privacy")).length;
}
