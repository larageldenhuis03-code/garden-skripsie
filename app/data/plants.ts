import generatedPlants from "./plant_database.generated.json" with { type: "json" };

export type Sun = "full" | "part" | "sheltered";
export type Water = "low" | "moderate" | "moist";

/** The coarse national biome scheme this app briefly used before rescoping
 * to the Western Cape. Kept only as supporting/display info on `Plant.biome`
 * (e.g. explaining a "biome-only" tier-2 match) - `Bioregion` below is the
 * real match key now. */
export type NationalBiome =
  | "Fynbos"
  | "Succulent Karoo"
  | "Nama Karoo"
  | "Grassland"
  | "Savanna"
  | "Albany Thicket"
  | "Indian Ocean Coastal Belt"
  | "Forest"
  | "Desert";

/** SANBI's own Western Cape bioregion classification (one level finer than
 * biome) - verified from the actual dissolved vegetation-map output
 * (`data/processed/western_cape_bioregions.geojson`), not guessed. */
export type Bioregion =
  | "Albany Thicket"
  | "Alluvial Vegetation"
  | "Dry Highveld Grassland Bioregion"
  | "East Coast Renosterveld Bioregion"
  | "Eastern Fynbos-Renosterveld Bioregion"
  | "Inland Saline Vegetation"
  | "Karoo Renosterveld Bioregion"
  | "Knersvlakte Bioregion"
  | "Lower Karoo Bioregion"
  | "Namaqualand Cape Shrublands Bioregion"
  | "Namaqualand Hardeveld Bioregion"
  | "Namaqualand Sandveld Bioregion"
  | "Northwest Fynbos Bioregion"
  | "Rainshadow Valley Karoo Bioregion"
  | "Seashore Vegetation"
  | "South Coast Fynbos Bioregion"
  | "South Strandveld Bioregion"
  | "Southern Fynbos Bioregion"
  | "Southwest Fynbos Bioregion"
  | "Trans-Escarpment Succulent Karoo Bioregion"
  | "Upper Karoo Bioregion"
  | "West Coast Renosterveld Bioregion"
  | "West Strandveld Bioregion"
  | "Western Fynbos-Renosterveld Bioregion"
  | "Zonal & Intrazonal Forests";

export type Goal =
  | "flowers"
  | "pollinators"
  | "birds"
  | "structure"
  | "fragrance"
  | "groundcover"
  | "screening"
  | "low-care";

export type Plant = {
  id: string;
  commonName: string;
  scientificName: string;
  family: string;
  heightCm: number | null;
  spreadCm: number | null;
  form: string;
  flowerStart: string;
  flowerEnd: string;
  occurrenceCount: number;
  sun: Sun[] | null;
  water: Water | null;
  /** Coarse biome(s) - supporting info only, see `NationalBiome` above. */
  biome: NationalBiome[] | null;
  /** The real match key: this plant's Western Cape bioregion, resolved
   * from occurrence coordinates. Null when there's no occurrence-level
   * match (see `bioregionSource`). */
  bioregion: Bioregion | null;
  goals: Goal[];
  accent: "ochre" | "coral" | "rose" | "sky" | "lime" | "sand";
  note: string;
  /** Where this record's traits came from: "bioscape" (occurrence-verified),
   * "plantzafrica" (horticultural profile only) or both. */
  dataSource: string;
  /** How `biome` was derived: real occurrence coordinates ("occurrence"),
   * inferred from PlantZAfrica's horticultural zone text
   * ("horticultural-zone", lower confidence), both, or null if unresolved. */
  biomeSource: string | null;
  /** Canonical soil types this plant suits: "sandy" | "loam" | "clay".
   * Multi-valued - the plant suits every listed type, so hard filters use
   * any-match, never first-value. */
  soilType: string[] | null;
  /** Soil types outside the three the UI exposes ("Brack/saline", ...);
   * retained on the record but not offered as a filter option. */
  soilTypeMinor: string[] | null;
  /** Growth habit(s), lowercased ("shrub", "bi/annual", ...). */
  plantType: string[] | null;
  /** Atomic flower colours. Missing colour is neutral in scoring, never a
   * mismatch. */
  flowerColour: string[] | null;
  /** `special_features` tags - the source for the fragrance, privacy,
   * pollinator, wildlife and low-maintenance preferences. Positive flags
   * only: absence means "not recorded", not "not true". */
  specialFeatures: string[] | null;
  /** "Easy" / "Average" / "Challenging" where PlantZAfrica records it -
   * supporting evidence for the low-maintenance preference. */
  gardeningSkill: string | null;
  /** PlantZAfrica's own season text, e.g. "Spring, Early Summer". */
  floweringSeason: string | null;
  /** Why this species is never recommended for an outdoor bed
   * ("poisonous" | "indoor"), or null. It stays browsable in the plant
   * library with a warning. */
  excludedFromLayout: string | null;
  /** True when the species has every attribute the layout stage needs
   * (biome, plant type, sun, water, soil, height, spread). */
  layoutEligible: boolean;
  /** How far `spreadCm` can be trusted: "original" (measured),
   * "researched", or "imputed". Layout geometry depends entirely on
   * spread, so imputed values are drawn differently. */
  spreadConfidence: "original" | "researched" | "imputed" | null;
  /** How `spreadCm` was obtained: "original" (measured, 212 species),
   * "lookup", "group-median" or "ratio-imputed". Only "original" is a real
   * measurement - the rest are inferred and must be labelled as such. */
  spreadSource: string | null;
  /** "outlier" / "suspect-low" where the imputed spread failed a sanity
   * check, or null when it passed. */
  spreadOutlierFlag: string | null;
  /** Plain-language note explaining an adjusted or truncated spread. */
  spreadNote: string | null;
  /** How `heightCm` was obtained: "original" or an imputation method. */
  heightSource: string | null;
  /** Provenance and confidence for the horticultural fields: "ORIGINAL"
   * (from PlantZAfrica), "GENUS"/"BIOME" (inferred) or "UNRESOLVED". */
  sunSource: string | null;
  sunConfidence: string | null;
  waterSource: string | null;
  waterConfidence: string | null;
  soilTypeSource: string | null;
  soilTypeConfidence: string | null;
  /** How this plant qualified for the Western Cape catalogue: "occurrence"
   * (its own coordinates fall inside a Western Cape bioregion, high
   * confidence) or "biome-only" (recorded elsewhere, but its biome also
   * occurs in the Western Cape - lower confidence, no specific bioregion). */
  bioregionSource: string | null;
  /** Photo URL, preferring PlantZAfrica's (SANBI) own species photo and
   * falling back to an iNaturalist match only when no PlantZAfrica photo
   * exists. Null when neither source has one. */
  photoUrl: string | null;
  /** Credit line for `photoUrl` (photographer/attribution + source). */
  photoAttribution: string | null;
  /** Page to link the photo credit back to. */
  photoSourceUrl: string | null;
  /** Which source `photoUrl` came from: "plantzafrica" or "inaturalist". */
  photoSource: string | null;
  /** Licence terms for `photoUrl`. One licence covers the PlantZAfrica
   * set; iNaturalist licences vary per contributor, so they must be
   * displayed with the attribution. */
  photoLicense: string | null;
  // Nursery prices and stock are NOT stored here: they are fetched live
  // for each layout (app/lib/sourcing, driven by
  // Nursery_Sourcing_Search_Spec.xlsx).
};

export const plants: Plant[] = generatedPlants as Plant[];

export const biomeLabels: Record<NationalBiome, string> = {
  Fynbos: "Fynbos",
  "Succulent Karoo": "Succulent Karoo",
  "Nama Karoo": "Nama Karoo",
  Grassland: "Grassland",
  Savanna: "Savanna",
  "Albany Thicket": "Albany Thicket",
  "Indian Ocean Coastal Belt": "Indian Ocean Coastal Belt",
  Forest: "Forest",
  Desert: "Desert",
};

export const bioregionLabels: Record<Bioregion, string> = {
  "Albany Thicket": "Albany Thicket",
  "Alluvial Vegetation": "Alluvial Vegetation",
  "Dry Highveld Grassland Bioregion": "Dry Highveld Grassland",
  "East Coast Renosterveld Bioregion": "East Coast Renosterveld",
  "Eastern Fynbos-Renosterveld Bioregion": "Eastern Fynbos-Renosterveld",
  "Inland Saline Vegetation": "Inland Saline Vegetation",
  "Karoo Renosterveld Bioregion": "Karoo Renosterveld",
  "Knersvlakte Bioregion": "Knersvlakte",
  "Lower Karoo Bioregion": "Lower Karoo",
  "Namaqualand Cape Shrublands Bioregion": "Namaqualand Cape Shrublands",
  "Namaqualand Hardeveld Bioregion": "Namaqualand Hardeveld",
  "Namaqualand Sandveld Bioregion": "Namaqualand Sandveld",
  "Northwest Fynbos Bioregion": "Northwest Fynbos",
  "Rainshadow Valley Karoo Bioregion": "Rainshadow Valley Karoo",
  "Seashore Vegetation": "Seashore Vegetation",
  "South Coast Fynbos Bioregion": "South Coast Fynbos",
  "South Strandveld Bioregion": "South Strandveld",
  "Southern Fynbos Bioregion": "Southern Fynbos",
  "Southwest Fynbos Bioregion": "Southwest Fynbos",
  "Trans-Escarpment Succulent Karoo Bioregion": "Trans-Escarpment Succulent Karoo",
  "Upper Karoo Bioregion": "Upper Karoo",
  "West Coast Renosterveld Bioregion": "West Coast Renosterveld",
  "West Strandveld Bioregion": "West Strandveld",
  "Western Fynbos-Renosterveld Bioregion": "Western Fynbos-Renosterveld",
  "Zonal & Intrazonal Forests": "Zonal & Intrazonal Forests",
};

export const sunLabels: Record<Sun, string> = {
  full: "Full",
  part: "Part",
  sheltered: "Shade",
};

export const waterLabels: Record<Water, string> = {
  low: "Low",
  moderate: "Moderate",
  moist: "Moist",
};

export const goalLabels: Record<Goal, string> = {
  flowers: "Flower colour",
  pollinators: "Pollinators",
  birds: "Bird habitat",
  structure: "Year-round structure",
  fragrance: "Fragrance",
  groundcover: "Living groundcover",
  screening: "Privacy & screening",
  "low-care": "Low maintenance",
};
