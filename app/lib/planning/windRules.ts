import type { Plant } from "../../data/plants.ts";
import type { Wind } from "./brief.ts";
import {
  LOW_SHRUB_MAX_HEIGHT_CM,
  WIND_RESILIENT_PLANT_TYPES,
  WIND_RESILIENT_TAG,
  WIND_SITE_FACTOR,
} from "./stage1Config.ts";

/**
 * Wind rule algorithm. Wind is algorithm-driven, not dataset-driven. See
 * AGENTS.md.
 *
 * The dataset holds no wind-tolerance attribute for any species, and none
 * may be created: "wind" appears in the catalogue only under pollination
 * and dispersal, which describe reproduction rather than tolerance. So
 * resilience is worked out HERE, at runtime, from plant_type, height_cm
 * and special_features - never read off a wind field, never text-mined
 * from those two reproduction columns, and never proxied by biome.
 *
 * Wind only ever adds to a score (Stage 1). It is called from scoring,
 * never from the hard filters, and is absent from filter relaxation: it
 * can never remove a plant or make a feasible layout infeasible.
 *
 * Still to come from the expert interview: the windbreak placement
 * preference (Stage 4) and wind care advice.
 */

/** W_site: how much wind resilience matters for this bed. */
export function windSiteFactor(wind: Wind): number {
  return WIND_SITE_FACTOR[wind];
}

/** windres_i: 1 if the plant's form suggests it copes with wind -
 * groundcovers, grasses, restios, low shrubs, or anything grown as a
 * hedge or screen. Missing data counts as "not shown to be resilient". */
export function isWindResilient(plant: Plant): boolean {
  const types = plant.plantType ?? [];
  if (types.some((type) => WIND_RESILIENT_PLANT_TYPES.includes(type))) {
    return true;
  }
  if ((plant.specialFeatures ?? []).includes(WIND_RESILIENT_TAG)) {
    return true;
  }
  // A shrub with no recorded height is not assumed to be low.
  return (
    types.includes("shrub") &&
    plant.heightCm !== null &&
    plant.heightCm <= LOW_SHRUB_MAX_HEIGHT_CM
  );
}

/**
 * Not yet implemented. Will return care advice for "protected" and
 * "affected" beds once the expert-interview heuristics are in.
 */
export function windCareAdvice(wind: Wind): string[] {
  void wind;
  return [];
}
