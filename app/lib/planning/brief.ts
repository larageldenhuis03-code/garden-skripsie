import type {
  Area,
  Goal,
  Sun,
  Water,
} from "../../data/plants.ts";

export type Soil = "sandy" | "loam" | "clay" | "not-sure";
export type Drainage = "free" | "moderate" | "poor" | "not-sure";
export type PlantingDensity = "open" | "balanced" | "lush";

export type GardenBrief = {
  area: Area;
  soil: Soil;
  drainage: Drainage;
  sun: Sun;
  water: Water;
  bedWidthM: number;
  bedLengthM: number;
  density: PlantingDensity;
  goals: Goal[];
};

export type BriefValidationIssue = {
  field: keyof GardenBrief;
  message: string;
};

export type BriefValidation = {
  valid: boolean;
  issues: BriefValidationIssue[];
  bedAreaM2: number | null;
};

export const MIN_BED_DIMENSION_M = 0.5;
export const MAX_BED_DIMENSION_M = 30;

const areas = new Set<Area>([
  "cape-town",
  "winelands",
  "overberg",
  "garden-route",
]);
const soils = new Set<Soil>(["sandy", "loam", "clay", "not-sure"]);
const drainages = new Set<Drainage>([
  "free",
  "moderate",
  "poor",
  "not-sure",
]);
const suns = new Set<Sun>(["full", "part", "sheltered"]);
const waters = new Set<Water>(["low", "moderate", "moist"]);
const densities = new Set<PlantingDensity>(["open", "balanced", "lush"]);
const goals = new Set<Goal>([
  "flowers",
  "pollinators",
  "birds",
  "structure",
  "fragrance",
  "groundcover",
  "screening",
  "low-care",
]);

function validDimension(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_BED_DIMENSION_M &&
    value <= MAX_BED_DIMENSION_M
  );
}

export function validateGardenBrief(brief: GardenBrief): BriefValidation {
  const issues: BriefValidationIssue[] = [];

  if (!areas.has(brief.area)) {
    issues.push({ field: "area", message: "Choose a supported pilot area." });
  }
  if (!soils.has(brief.soil)) {
    issues.push({ field: "soil", message: "Choose a soil description." });
  }
  if (!drainages.has(brief.drainage)) {
    issues.push({
      field: "drainage",
      message: "Choose how quickly the bed drains.",
    });
  }
  if (!suns.has(brief.sun)) {
    issues.push({ field: "sun", message: "Choose the bed's light level." });
  }
  if (!waters.has(brief.water)) {
    issues.push({ field: "water", message: "Choose a summer-water level." });
  }
  if (!validDimension(brief.bedWidthM)) {
    issues.push({
      field: "bedWidthM",
      message: `Width must be between ${MIN_BED_DIMENSION_M} and ${MAX_BED_DIMENSION_M} metres.`,
    });
  }
  if (!validDimension(brief.bedLengthM)) {
    issues.push({
      field: "bedLengthM",
      message: `Length must be between ${MIN_BED_DIMENSION_M} and ${MAX_BED_DIMENSION_M} metres.`,
    });
  }
  if (!densities.has(brief.density)) {
    issues.push({
      field: "density",
      message: "Choose an open, balanced or lush planting density.",
    });
  }
  if (brief.goals.length === 0) {
    issues.push({
      field: "goals",
      message: "Choose at least one thing the planting should do.",
    });
  }
  if (
    new Set(brief.goals).size !== brief.goals.length ||
    brief.goals.some((goal) => !goals.has(goal))
  ) {
    issues.push({
      field: "goals",
      message: "Garden goals must be recognised and cannot be duplicated.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    bedAreaM2:
      validDimension(brief.bedWidthM) && validDimension(brief.bedLengthM)
        ? brief.bedWidthM * brief.bedLengthM
        : null,
  };
}

export function parseGardenBrief(value: unknown): GardenBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (
    !areas.has(record.area as Area) ||
    !soils.has(record.soil as Soil) ||
    !drainages.has(record.drainage as Drainage) ||
    !suns.has(record.sun as Sun) ||
    !waters.has(record.water as Water) ||
    !densities.has(record.density as PlantingDensity) ||
    typeof record.bedWidthM !== "number" ||
    typeof record.bedLengthM !== "number" ||
    !Array.isArray(record.goals) ||
    record.goals.some((goal) => !goals.has(goal as Goal))
  ) {
    return null;
  }

  const brief: GardenBrief = {
    area: record.area as Area,
    soil: record.soil as Soil,
    drainage: record.drainage as Drainage,
    sun: record.sun as Sun,
    water: record.water as Water,
    bedWidthM: record.bedWidthM,
    bedLengthM: record.bedLengthM,
    density: record.density as PlantingDensity,
    goals: [...(record.goals as Goal[])],
  };

  return validateGardenBrief(brief).valid ? brief : null;
}

export const soilLabels: Record<Soil, string> = {
  sandy: "Mostly sandy",
  loam: "Dark, crumbly loam",
  clay: "Heavy or clay-rich",
  "not-sure": "I’m not sure",
};

export const drainageLabels: Record<Drainage, string> = {
  free: "Drains quickly",
  moderate: "Drains within a day",
  poor: "Stays wet or puddles",
  "not-sure": "I’m not sure",
};

export const densityLabels: Record<PlantingDensity, string> = {
  open: "Open and spacious",
  balanced: "Balanced coverage",
  lush: "Full and closely planted",
};

