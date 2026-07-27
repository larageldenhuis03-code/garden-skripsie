import type { GardenBrief } from "./brief.ts";

export const workingExampleBrief: GardenBrief = {
  area: "garden-route",
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
  totalPlants: 9,
  species: 6,
  openSpacePercent: 34,
} as const;
