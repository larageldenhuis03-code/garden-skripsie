import type { GardenBrief } from "./brief.ts";

export const workingExampleBrief: GardenBrief = {
  biome: "Fynbos",
  soil: "sandy",
  drainage: "free",
  sun: "part",
  water: "moderate",
  bedWidthM: 2,
  bedLengthM: 3,
  density: "balanced",
  goals: ["flowers", "pollinators"],
};

export const workingExampleOutput = {
  totalPlants: 3,
  species: 3,
  openSpacePercent: 43,
} as const;
