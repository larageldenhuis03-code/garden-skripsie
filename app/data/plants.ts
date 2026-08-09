import generatedPlants from "./plant_database.generated.json" with { type: "json" };

export type Sun = "full" | "part" | "sheltered";
export type Water = "low" | "moderate" | "moist";
export type Biome =
  | "Fynbos"
  | "Succulent Karoo"
  | "Nama Karoo"
  | "Grassland"
  | "Savanna"
  | "Albany Thicket"
  | "Indian Ocean Coastal Belt"
  | "Forest"
  | "Desert";
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
  biome: Biome[] | null;
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
};

export const plants: Plant[] = generatedPlants as Plant[];

export const biomeLabels: Record<Biome, string> = {
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

export const sunLabels: Record<Sun, string> = {
  full: "Full sun",
  part: "Morning sun / part shade",
  sheltered: "Sheltered shade",
};

export const waterLabels: Record<Water, string> = {
  low: "Low summer water",
  moderate: "Occasional summer water",
  moist: "Seasonally moist",
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
