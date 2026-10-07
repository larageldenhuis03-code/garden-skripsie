import generatedPlaces from "./western_cape_places.generated.json" with { type: "json" };
import type { Bioregion, NationalBiome, Water } from "./plants.ts";

/** "Urban"/"Rural" (Dept of Agriculture communities layer) and "Suburb"
 * (City of Cape Town official planning suburbs) are small, roughly
 * homogeneous footprints. "Municipality" and "District" are much larger
 * administrative areas that can span several bioregions. */
export type PlaceCategory = "Urban" | "Rural" | "Suburb" | "Municipality" | "District";

/** How this place's bioregion was determined:
 * - "contains": its centroid falls directly inside a classified bioregion
 *   polygon (high confidence) - used for Urban/Rural/Suburb places.
 * - "nearest": the centroid sits on unclassified land (mostly urban or
 *   farmland - see western_cape_outline.geojson) and the closest bioregion
 *   polygon was used instead (lower confidence, but still real geometry,
 *   not a guess).
 * - "majority": for Municipality/District areas, the bioregion with the
 *   largest overlap area - an honest "most of this area is in X", not a
 *   precise match, since these areas can genuinely span several bioregions.
 * See data/scripts/assign_place_bioregions.R. */
/** "imputed_nearest" joined in the 2026-09-24 review: a place added by
 * hand, whose bioregion came from the nearest classified polygon rather
 * than from its own geometry. Treated like "nearest" in the interface,
 * because both are estimates the user should be told about. */
export type PlaceBioregionSource = "contains" | "nearest" | "majority" | "imputed_nearest";

/** The bioregion was estimated, not read from the place's own polygon. */
export function isEstimatedBioregion(source: PlaceBioregionSource | string | null): boolean {
  return source === "nearest" || source === "imputed_nearest";
}

export type Place = {
  name: string;
  category: PlaceCategory;
  /** Every biome this place touches, ordered with the dominant one first.
   * This is what drives species filtering: `biome` is 99.8% populated on
   * plants where `bioregion` is only 23.4%, and a place on a boundary
   * genuinely draws on more than one. Assigned in
   * data/scripts/assign_place_bioregions.R. */
  biomes: NationalBiome[];
  /** Retained as secondary display and traceability information only - it
   * no longer drives filtering. */
  bioregion: Bioregion;
  bioregionSource: PlaceBioregionSource;
  /** A per-place water hint from the 2026-09-24 review, on 60 places.
   * Carried through from the reviewed CSV but NOT read by the engine:
   * the brief's water answer belongs to the user, and letting a place
   * set it would filter species on evidence the user never gave. Decide
   * what it should do before wiring it to anything. */
  preferredWaterLevel?: Water;
};

export const places = generatedPlaces as Place[];
