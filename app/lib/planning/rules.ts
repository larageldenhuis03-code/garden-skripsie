import rules from "../../data/engine_rules.generated.json" with { type: "json" };
import rulesStamp from "../../data/rules_version.generated.json" with { type: "json" };

/**
 * The engine's rulebook. Every engine number comes from
 * Algorithm_rulebook.xlsx via data/scripts/import_rulebook.py, which
 * validates it and writes engine_rules.generated.json; the sync step
 * rebuilds that file whenever the workbook changes. Do not hard-code a
 * rulebook value anywhere else - read it from RULES.
 */

export type StyleKey = "fynbos" | "mediterranean" | "cottage" | "generic";

export type StyleRules = {
  label: string;
  fit: { active: boolean; plantTypes: string[] | null; biomes: string[] | null };
  coverMin: number;
  coverMax: number;
  openMin: number;
  openMax: number;
  tau: { tall: number; medium: number; short: number };
  tMin: number;
  rMax: number;
  structMin: number;
};

export type LayerId = "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";

export type EngineRules = {
  source: string;
  stage1: {
    weights: {
      style: number;
      colour: number;
      extras: number;
      saved: number;
      wind: number;
    };
    windSiteFactor: { none: number; protected: number; affected: number };
    lowShrubMaxHeightCm: number;
    colourSchemes: { warm: string[]; cool: string[]; neutral: string[] };
    extraTags: Record<
      "low-maintenance" | "privacy" | "pollinators" | "fragrance" | "wildlife",
      string[]
    >;
  };
  styles: Record<StyleKey, StyleRules>;
  stage2: {
    lambda: number;
    goalWeights: number[];
    fMin: number;
    cMin: number;
    nMin: number;
    /** H3b (2026-09-30): the most single-plant groups a bed may hold, by
     * bed-area band. Optional until the workbook carries the cells. */
    singletonKByBand?: number[];
    /** H3b: the share of species that must be in real groups (>= 3). */
    minGroupedShare?: number;
    /** H7 footprint cap phi (1_Parameters row 103, 2026-10-05): the most
     * of the bed one L1 plant's canopy may cover. Optional - an absent
     * value means no cap, never a guessed one. */
    footprintCap?: number;
    kHeadroom: number;
    featureExemptH5: boolean;
    speciesBands: { maxAreaM2: number; sMin: number; sMax: number }[];
    groupSizes: number[][];
    featureList: {
      entries: string[];
      species: string[];
      genera: string[];
      families: string[];
    };
    featureThreshold: { minHeightCm: number; minSpreadCm: number; text: string };
    sizeVarMin: number;
  };
  failRule: { placementFailLimit: number; retryCoverFactor: number };
  stage3: {
    /** null = "TO TUNE": derived at run time so a move making Z 5% worse
     * is accepted about half the time at the start. */
    t0: number | null;
    alpha: number;
    iterations: number;
    heightSwapTolerance: number;
  };
  stage4: {
    depth: Record<LayerId, number | null>;
    depthTol: number;
    /** contact_bonus (D26): placement preference for a candidate spot
     * touching the bed edge or an already-placed plant. */
    contactBonus: number;
    /** sweep_weight (D27): sweep packing. Above 0, a plant's candidate
     * spots are the contact points first, and an in-band contact spot is
     * preferred with this weight in place of contactBonus. */
    sweepWeight: number;
    hedgeSpacingFormalCm: [number, number];
    hedgeSpacingInformalCm: [number, number];
    windbreakPorosity: { min: number; max: number; target: number };
    windbreakMinLengthRatio: number;
    windbreakPrefLengthRatio: number;
    shelterDepthH: number;
    maxWindAngleDev: number;
    minGroupWindbreakRow: number;
    rowPitchM: number;
    placementRestarts: number;
    /** Random candidate positions drawn per plant per restart (B1,
     * 2026-09-30). Optional only while a rules file generated before the
     * rename may still be in place. */
    randomDrawsPerPlant?: number;
    /** Which workbook cell that came from, for traceability. */
    randomDrawsSource?: string;
    /** The pre-rename budget, a quarter of which was drawn. Kept so a
     * stale generated file cannot silently leave the engine with zero
     * random candidates. */
    randomTriesPerPlant?: number;
    overlapDelta: number;
  };
  status: Record<string, string>;
};

export const RULES = rules as unknown as EngineRules;

/** Fingerprint of the rulebook the engine was built from; saved gardens
 * record it next to the dataset version. */
export const RULES_VERSION: string = rulesStamp.version;
