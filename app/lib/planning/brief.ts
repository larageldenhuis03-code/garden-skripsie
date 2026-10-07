import type {
  ColourPreference,
  ExtraPreference,
  GardenStyle,
} from "./preferences.ts";
import {
  biomeLabels,
  bioregionLabels,
  type Bioregion,
  type NationalBiome,
  type Sun,
  type Water,
} from "../../data/plants.ts";

export type Soil = "sandy" | "loam" | "clay" | "not-sure";

/** Wind exposure. Unlike sun, water and soil this maps to NO column on
 * the plant records - the dataset holds no wind-tolerance information for
 * any species - so it never filters the pool and never reads a plant
 * attribute. It is consumed by the rule algorithm instead. See AGENTS.md. */
export type Wind = "none" | "protected" | "affected";

/** Which edge of the bed the gardener stands at and looks from. Recorded
 * as a compass direction, not "left" or "near", so it can be reconciled
 * with the rulebook's compass rules: the windward edges stay the true
 * south and east ones whatever side the viewer is on. */
export type ViewingEdge = "north" | "east" | "south" | "west";
/** Retained as a type because the planner still reasons about spacing,
 * but no longer asked: how full a bed should feel is a constraint for the
 * optimiser to decide, not a question for the gardener. */
export type PlantingDensity = "open" | "balanced" | "lush";

/** The single density the planner assumes until the optimiser sets it. */
export const DEFAULT_PLANTING_DENSITY: PlantingDensity = "balanced";

/** Describes the bed the dimensions already imply. Not an input: the
 * shape follows from the width and length rather than being chosen
 * separately, so the two can never disagree. */
export type BedShape = "square" | "portrait" | "landscape";

export function bedShapeFor(widthM: number, lengthM: number): BedShape {
  if (Math.abs(widthM - lengthM) < 0.05) return "square";
  return lengthM > widthM ? "portrait" : "landscape";
}

/** The site filters that may be widened when a brief leaves too small a
 * pool to plan from. Biome is deliberately absent: it is never relaxed. */
export type RelaxableFilter = "soil" | "water" | "sun";

/**
 * Relaxation cost per filter, lowest first: what it costs the gardener to
 * accept a wider answer. The ordering the app offers relaxations in is
 * derived from these numbers rather than hardcoded, so the interface and
 * the model cannot drift apart.
 *
 * SOURCE (2026-09-29): the gardener survey's criterion weights, Table 3.3
 * of the report - sunlight 0.257, water 0.199, soil 0.174 - renormalised
 * over these three filters (sum 0.630) so they sum to 1 here. The more
 * important gardeners rated a factor, the more it costs to compromise on
 * it, so the survey's importance ranking becomes the relaxation ordering
 * directly.
 *
 * These replaced the judgement values 0.137 / 0.239 / 0.625, which gave
 * the same order (soil, then water, then sun) but had no source. Only the
 * ranking changes behaviour - the values themselves are shown to the user
 * as the cost of a relaxation and are otherwise unused - so this swap is
 * a provenance change, not a behavioural one.
 *
 * NOTE for the report: these are NOT the engine's scoring weights. The
 * goal weights are still the rulebook's equal baseline
 * (RULES.stage2.goalWeights), and sun, water and soil are hard filters
 * rather than weighted criteria. Table 3.3 informs only this ordering.
 */
export const RELAXATION_COSTS: Record<RelaxableFilter, number> = {
  soil: 0.276,
  water: 0.316,
  sun: 0.408,
};

/** Cheapest first. */
export const RELAXATION_ORDER: RelaxableFilter[] = (
  Object.keys(RELAXATION_COSTS) as RelaxableFilter[]
).sort((left, right) => RELAXATION_COSTS[left] - RELAXATION_COSTS[right]);

/** The top edge of the bed is north. Fixed, not user-set: the layout
 * stage uses it to keep taller plants away from the sun-facing edge (in
 * the southern hemisphere that is the north one) so they do not shade
 * lower plants, and to inform wind guidance. It is deliberately NOT used
 * for seasonal sun-angle maths - the dataset records one non-seasonal sun
 * requirement per species (spec 3). */
export const BED_NORTH_EDGE = "top" as const;

export type GardenBrief = {
  /** The biomes the user's location touches, and the actual species
   * filter: a plant is kept if any of its biomes appears here (spec 2.3).
   * At least one must be selected. */
  biomes: NationalBiome[];
  /** Secondary display/traceability only - it no longer filters, because
   * only 23.4% of plants have a resolved bioregion against 99.8% with a
   * biome. */
  bioregion: Bioregion;
  soil: Soil;
  /** Algorithm-driven, not dataset-driven: captured here and passed to
   * the optimiser, never to the hard filters. */
  wind: Wind;
  /** The front of the bed, as seen by the gardener. Only the layout uses
   * it, and only to decide which way heights step up; it never filters a
   * plant and never moves the windward row, which is fixed to the true
   * south and east edges. */
  viewingEdge: ViewingEdge;
  sun: Sun;
  water: Water;
  bedWidthM: number;
  bedLengthM: number;
  /** Soft preferences. Neither of these ever removes a species from the
   * pool - they only change how it ranks (spec 5). */
  style: GardenStyle;
  colour: ColourPreference;
  /** Optional extras, all soft. Each promotes the species carrying its
   * tags and never penalises the rest (spec 6). */
  extras: ExtraPreference[];
  /** Site filters the user has agreed to widen, each to its adjacent
   * values only (see acceptedSoils / acceptedWaterCeiling / acceptedSuns).
   * Absent means nothing has been relaxed, which is the normal case. */
  relaxedFilters?: RelaxableFilter[];
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

const bioregions = new Set<Bioregion>(Object.keys(bioregionLabels) as Bioregion[]);
const biomes = new Set<NationalBiome>(
  Object.keys(biomeLabels) as NationalBiome[],
);
const soils = new Set<Soil>(["sandy", "loam", "clay", "not-sure"]);
const suns = new Set<Sun>(["full", "part", "sheltered"]);
const winds = new Set<Wind>(["none", "protected", "affected"]);
const viewingEdges = new Set<ViewingEdge>(["north", "east", "south", "west"]);
const waters = new Set<Water>(["low", "moderate", "moist"]);
const extraPreferences = new Set<ExtraPreference>([
  "low-maintenance",
  "privacy",
  "pollinators",
  "fragrance",
  "wildlife",
]);
const styles = new Set<GardenStyle>([
  "mediterranean",
  "cottage",
  "fynbos",
  "undecided",
]);

function isColourPreference(value: unknown): value is ColourPreference {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.mode === "none") return true;
  if (record.mode === "scheme") {
    return ["warm", "cool", "neutral"].includes(record.scheme as string);
  }
  if (record.mode === "custom") {
    return (
      Array.isArray(record.colours) &&
      record.colours.every((colour) => typeof colour === "string")
    );
  }
  return false;
}

function validDimension(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_BED_DIMENSION_M &&
    value <= MAX_BED_DIMENSION_M
  );
}

export function validateGardenBrief(brief: GardenBrief): BriefValidation {
  const issues: BriefValidationIssue[] = [];

  if (!bioregions.has(brief.bioregion)) {
    issues.push({ field: "bioregion", message: "Choose a bioregion." });
  }
  if (
    !Array.isArray(brief.biomes) ||
    brief.biomes.length === 0 ||
    brief.biomes.some((biome) => !biomes.has(biome)) ||
    new Set(brief.biomes).size !== brief.biomes.length
  ) {
    issues.push({
      field: "biomes",
      message: "Keep at least one vegetation type selected for your area.",
    });
  }
  if (!soils.has(brief.soil)) {
    issues.push({ field: "soil", message: "Choose a soil description." });
  }
  if (!winds.has(brief.wind)) {
    issues.push({ field: "wind", message: "Choose how much wind the bed gets." });
  }
  if (!viewingEdges.has(brief.viewingEdge)) {
    issues.push({
      field: "viewingEdge",
      message: "Choose which edge of the bed you look at it from.",
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
  if (
    brief.relaxedFilters !== undefined &&
    (!Array.isArray(brief.relaxedFilters) ||
      brief.relaxedFilters.some(
        (filter) => !(filter in RELAXATION_COSTS),
      ))
  ) {
    issues.push({
      field: "relaxedFilters",
      message: "Relaxed filters must be soil, water or sun.",
    });
  }
  if (
    !Array.isArray(brief.extras) ||
    brief.extras.some((extra) => !extraPreferences.has(extra)) ||
    new Set(brief.extras).size !== brief.extras.length
  ) {
    issues.push({
      field: "extras",
      message: "Extra preferences must be recognised and cannot repeat.",
    });
  }
  if (!styles.has(brief.style)) {
    issues.push({ field: "style", message: "Choose a garden style." });
  }
  if (!isColourPreference(brief.colour)) {
    issues.push({ field: "colour", message: "Colour preference is malformed." });
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
    !Array.isArray(record.biomes) ||
    record.biomes.length === 0 ||
    record.biomes.some((biome) => !biomes.has(biome as NationalBiome)) ||
    !bioregions.has(record.bioregion as Bioregion) ||
    !soils.has(record.soil as Soil) ||
    !suns.has(record.sun as Sun) ||
    !winds.has(record.wind as Wind) ||
    !waters.has(record.water as Water) ||
    !styles.has(record.style as GardenStyle) ||
    !isColourPreference(record.colour) ||
    !Array.isArray(record.extras) ||
    record.extras.some((extra) => !extraPreferences.has(extra as ExtraPreference)) ||
    typeof record.bedWidthM !== "number" ||
    typeof record.bedLengthM !== "number"
  ) {
    return null;
  }

  const brief: GardenBrief = {
    biomes: [...(record.biomes as NationalBiome[])],
    bioregion: record.bioregion as Bioregion,
    soil: record.soil as Soil,
    wind: record.wind as Wind,
    // Gardens saved before the viewing edge was asked for keep the
    // rulebook's original assumption, which is that the front is north.
    viewingEdge: viewingEdges.has(record.viewingEdge as ViewingEdge)
      ? (record.viewingEdge as ViewingEdge)
      : "north",
    sun: record.sun as Sun,
    water: record.water as Water,
    style: record.style as GardenStyle,
    colour: record.colour as ColourPreference,
    extras: [...(record.extras as ExtraPreference[])],
    ...(Array.isArray(record.relaxedFilters)
      ? {
          relaxedFilters: (record.relaxedFilters as RelaxableFilter[]).filter(
            (filter) => filter in RELAXATION_COSTS,
          ),
        }
      : {}),
    bedWidthM: record.bedWidthM,
    bedLengthM: record.bedLengthM,
  };

  return validateGardenBrief(brief).valid ? brief : null;
}

/** Deliberately avoids the word "sheltered": the sun question already
 * uses it to mean shade, and the two must not read as the same thing. */
export const windLabels: Record<Wind, string> = {
  none: "No wind",
  protected: "Protected from wind",
  affected: "Affected by wind",
};

export const windDescriptions: Record<Wind, string> = {
  none: "The bed is in a calm spot and wind is rarely noticeable.",
  protected:
    "The area can be windy, but walls, buildings, fences or hedges shield this bed.",
  affected:
    "The bed is exposed to wind, for example near the coast or in the path of the south-easter.",
};

export const soilLabels: Record<Soil, string> = {
  sandy: "Sandy",
  loam: "Loam",
  clay: "Clay",
  "not-sure": "I’m not sure",
};


export const bedShapeLabels: Record<BedShape, string> = {
  square: "Square bed",
  portrait: "Deeper than it is wide",
  landscape: "Wider than it is deep",
};

/** Bed size handed to the optimiser: centimetres, plus which edge faces
 * north (spec 3, spec 0.6). Display stays in metres. */
export function bedDimensionsCm(brief: GardenBrief): {
  widthCm: number;
  lengthCm: number;
  northEdge: typeof BED_NORTH_EDGE;
} {
  return {
    widthCm: Math.round(brief.bedWidthM * 100),
    lengthCm: Math.round(brief.bedLengthM * 100),
    northEdge: BED_NORTH_EDGE,
  };
}

/** Soil sits on a texture gradient: sandy <-> loam <-> clay. Relaxing it
 * admits the neighbours of the chosen type, never the far end. */
const SOIL_ADJACENT: Record<Exclude<Soil, "not-sure">, Soil[]> = {
  sandy: ["sandy", "loam"],
  loam: ["sandy", "loam", "clay"],
  clay: ["loam", "clay"],
};

/** Light sits on a gradient the same shape as soil:
 * full <-> part <-> sheltered. Relaxing admits the neighbours of the
 * chosen level only - part reaches both, while full and sheltered are
 * never bridged to each other, because a full-sun plant in deep shade
 * (or the reverse) is not a softer judgement, it is a plant that dies. */
const SUN_ADJACENT: Record<Sun, Sun[]> = {
  full: ["full", "part"],
  part: ["part", "full", "sheltered"],
  sheltered: ["sheltered", "part"],
};

const WATER_LEVEL: Record<Water, number> = { low: 0, moderate: 1, moist: 2 };

export function isRelaxed(brief: GardenBrief, filter: RelaxableFilter): boolean {
  return brief.relaxedFilters?.includes(filter) ?? false;
}

/** Soil types this brief accepts. "not-sure" accepts everything. */
export function acceptedSoils(brief: GardenBrief): Soil[] {
  if (brief.soil === "not-sure") return ["sandy", "loam", "clay"];
  return isRelaxed(brief, "soil") ? SOIL_ADJACENT[brief.soil] : [brief.soil];
}

/** Light levels this brief accepts. */
export function acceptedSuns(brief: GardenBrief): Sun[] {
  return isRelaxed(brief, "sun") ? SUN_ADJACENT[brief.sun] : [brief.sun];
}

/** The wettest requirement this brief will still accept. A plant passes
 * when it needs no more water than this; relaxing lifts the ceiling by one
 * step, which is what "one step wetter" means for a requirement test. */
export function acceptedWaterCeiling(brief: GardenBrief): number {
  const base = WATER_LEVEL[brief.water];
  return isRelaxed(brief, "water") ? base + 1 : base;
}

export function waterLevel(water: Water): number {
  return WATER_LEVEL[water];
}

/** True when relaxing this filter would actually change anything - a
 * sheltered bed has no adjacent light level, so offering to relax it
 * would be an empty promise. */
export function canRelax(brief: GardenBrief, filter: RelaxableFilter): boolean {
  if (isRelaxed(brief, filter)) return false;
  if (filter === "sun") return SUN_ADJACENT[brief.sun].length > 1;
  if (filter === "soil") return brief.soil !== "not-sure";
  return WATER_LEVEL[brief.water] < 2;
}

export const viewingEdgeLabels: Record<ViewingEdge, string> = {
  north: "North edge",
  east: "East edge",
  south: "South edge",
  west: "West edge",
};

/** Where the viewer stands, said the way a gardener would. */
export const viewingEdgeDescriptions: Record<ViewingEdge, string> = {
  north: "You look at the bed from its north side, southwards.",
  east: "You look at the bed from its east side, westwards.",
  south: "You look at the bed from its south side, northwards.",
  west: "You look at the bed from its west side, eastwards.",
};
