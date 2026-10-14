import {
  biomeLabels,
  sunLabels,
  waterLabels,
  type Plant,
} from "../../data/plants.ts";
import { auditAhpMatrix, type AhpAudit } from "./ahp.ts";
import {
  extraPreferenceLabels,
  gardenStyleLabels,
  matchesExtra,
} from "./preferences.ts";
import { scorePlantStage1, type Stage1Score } from "./stage1.ts";
import {
  acceptedSoils,
  acceptedSuns,
  acceptedWaterCeiling,
  canRelax,
  isRelaxed,
  soilLabels,
  waterLevel,
  RELAXATION_COSTS,
  RELAXATION_ORDER,
  type GardenBrief,
  type RelaxableFilter,
  type Soil,
  validateGardenBrief,
} from "./brief.ts";
import {
  evaluateHardConstraints,
  type FeasibilityResult,
  type HardConstraint,
} from "./feasibility.ts";
import {
  evaluateGoalProgram,
  type GoalProgramEvaluation,
} from "./goalProgramming.ts";
import type { RectangularLayout } from "./layout.ts";
import type { QuantityAllocation } from "./quantities.ts";
import {
  computeHeightTiers,
  computeSpreadBands,
  speciesInfo,
  type HeightTiers,
  type SpeciesInfo,
  type SpreadBands,
} from "./engineData.ts";
import { engineSite, runEngine, type EngineRun } from "./engine.ts";
import { RULES_VERSION } from "./rules.ts";
import { DATASET_VERSION } from "../../data/datasetVersion.ts";
import type { Goals, HardCheck } from "./stage2.ts";
import type { SearchTrace } from "./stage3.ts";
import type { PlacementCheck, WindProfile } from "./stage4.ts";
import {
  MAX_RESULT_SEEDS,
  MIN_LAYOUT_CANOPY_DIAMETER_M,
  MINIMUM_VIABLE_POOL,
} from "./engineConfig.ts";
import {
  F4_NEMBA_SPECIES,
  onExclusionList,
  F5_THIRSTY_EXOTIC_GENERA,
  F6_NAMED_EXCLUSIONS,
  F9_EXCLUDED_PLANT_TYPES,
  AQUATIC_PLANT_TYPES,
} from "./stage0Rules.ts";

export type PlanningStatus = "candidate" | "review" | "excluded";

export type PlantAssessment = {
  plantId: string;
  status: PlanningStatus;
  feasibility: FeasibilityResult;
  goalProgram: GoalProgramEvaluation;
  /** The full Stage 1 breakdown (score, raw, raw_max, every term), or
   * null for a plant Stage 0 removed - it is never scored. */
  stage1: Stage1Score | null;
  /** The Stage 1 score, 0..1. */
  suitability: number;
  reasons: string[];
  canopyAreaM2: number | null;
};

export type PlanningCalibration = {
  status: "baseline-equal-weights";
  criteria: string[];
  audit: AhpAudit;
  note: string;
};

/** Everything Stages 2-4 decided, for the report and the "why" panel. */
export type EngineSummary = {
  z: number;
  sBar: number;
  goals: Goals;
  hard: HardCheck[];
  placementChecks: PlacementCheck[];
  windProfile: WindProfile;
  search: SearchTrace | null;
  /** Species groups removed by the fail rule, in order. */
  dropped: string[];
  heightTiers: HeightTiers;
  spreadBands: SpreadBands;
  rowsAvailable: number;
  rulesVersion: string;
};

export type GardenPlan = {
  status: "provisional-plan" | "no-plan";
  brief: GardenBrief;
  bedAreaM2: number;
  openSpaceRatio: number;
  calibration: PlanningCalibration;
  assessments: PlantAssessment[];
  counts: {
    candidate: number;
    review: number;
    excluded: number;
  };
  quantities: QuantityAllocation | null;
  layout: RectangularLayout | null;
  engine: EngineSummary | null;
  assumptions: string[];
  diagnostics: string[];
  /** Which of the three results this is ("Option 1", ...). */
  character: string;
  /** Reproducibility: the same brief, counter and result index always
   * give this plan. */
  seed: string;
  variationCounter: number;
};


export type PlanOptions = {
  savedPlantIds?: readonly string[];
  /** Plants the user has ruled out by hand. Removed at Stage 0, so they
   * are never scored and can never reach a plan. */
  excludedPlantIds?: readonly string[];
  /** Increments on every "Regenerate", so the same brief deliberately
   * yields a different set while a saved layout reopens identically
   * (spec 8.6). */
  variationCounter?: number;
};

/** Deterministic seed over the whole input vector. The same answers plus
 * the same variation counter always reproduce the same plan; that is what
 * makes a saved layout re-openable and a reported result reproducible
 * (rulebook Stage 3: seed = hash(inputs + regenerate counter)). */
export function planSeed(
  brief: GardenBrief,
  savedPlantIds: readonly string[] = [],
  variationCounter = 0,
  excludedPlantIds: readonly string[] = [],
): string {
  const input = JSON.stringify({
    biomes: [...brief.biomes].sort(),
    soil: brief.soil,
    wind: brief.wind,
    sun: brief.sun,
    water: brief.water,
    bedWidthM: brief.bedWidthM,
    bedLengthM: brief.bedLengthM,
    style: brief.style,
    colour: brief.colour,
    extras: [...brief.extras].sort(),
    relaxed: [...(brief.relaxedFilters ?? [])].sort(),
    saved: [...savedPlantIds].sort(),
    variationCounter,
    // Added only when the user has actually excluded something. An empty
    // set must hash exactly as it did before exclusions existed, or every
    // garden saved until now would stop reproducing from its stored seed.
    ...(excludedPlantIds.length > 0
      ? { excluded: [...excludedPlantIds].sort() }
      : {}),
  });
  // FNV-1a: small, dependency-free and stable across runs.
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function circleAreaFromDiameterCm(diameterCm: number): number {
  return Math.PI * (diameterCm / 200) ** 2;
}

function feasibilityConstraints(
  excludedPlantIds: readonly string[] = [],
): HardConstraint<Plant, GardenBrief>[] {
  const excluded = new Set(excludedPlantIds);
  return [
    // The user's own exclusions, checked first so nothing else has to run
    // for a plant that has already been ruled out. This is the one
    // constraint in this list that is NOT evidence: it carries no source
    // and makes no horticultural claim, which is why its reason says who
    // excluded the plant. Removing it from the set restores the plant
    // exactly as it was - the exclusion is never recorded on the species.
    ...(excluded.size > 0
      ? [
          {
            id: "not-excluded",
            description: "Not one of the plants you have excluded.",
            evaluate: (plant: Plant) =>
              excluded.has(plant.id)
                ? {
                    status: "fail" as const,
                    reason:
                      "You excluded this plant, so we leave it out of every plan until you put it back.",
                    evidence: {
                      source: "Your choice, stored on this device",
                      observedValue: "excluded by you",
                      requiredValue: "not excluded",
                      confidence: "high" as const,
                    },
                  }
                : {
                    status: "pass" as const,
                    reason: "You have not excluded this plant.",
                  },
          } satisfies HardConstraint<Plant, GardenBrief>,
        ]
      : []),
    {
      // Safety exclusion, applied before anything else: 119 poisonous and
      // 144 indoor-only species are in the catalogue and must never be
      // recommended for an outdoor bed. They stay browsable in the plant
      // library, labelled.
      id: "safe-for-beds",
      description: "Safe to plant in an outdoor bed.",
      evaluate: (plant) => {
        if (plant.excludedFromLayout === "poisonous") {
          return {
            status: "fail",
            reason:
              "This plant is recorded as poisonous, so we never put it in a planting plan.",
            evidence: {
              source: "PlantZAfrica special features",
              observedValue: "Poisonous",
              requiredValue: "not poisonous",
              confidence: "high",
            },
          };
        }
        if (plant.excludedFromLayout === "indoor") {
          return {
            status: "fail",
            reason: "This is an indoor plant, so it does not belong in an outdoor bed.",
            evidence: {
              source: "PlantZAfrica special features",
              observedValue: "Indoor plant",
              requiredValue: "suitable outdoors",
              confidence: "high",
            },
          };
        }
        return {
          status: "pass",
          reason: "Not recorded as poisonous or indoor-only.",
          evidence: {
            source: "PlantZAfrica special features",
            observedValue: plant.specialFeatures,
            requiredValue: "no Poisonous or Indoor plant tag",
            confidence: "medium",
          },
        };
      },
    },
    {
      // Rulebook F4: NEMBA alien and invasive species, from a data file.
      id: "not-invasive",
      description: "Not a listed alien invasive species.",
      evaluate: (plant) => {
        const listed = onExclusionList(plant.scientificName, F4_NEMBA_SPECIES);
        return {
          status: listed ? "fail" : "pass",
          reason: listed
            ? "This species is on the NEMBA alien and invasive species list, so it is never planted."
            : "Not on the NEMBA alien and invasive species list.",
          evidence: {
            source: "Algorithm rulebook 11_Stage0_Filter F4 (app/data/nemba_exclusions.json)",
            observedValue: plant.scientificName,
            requiredValue: "not NEMBA-listed",
            confidence: F4_NEMBA_SPECIES.length > 0 ? "high" : "unknown",
          },
        };
      },
    },
    {
      // Rulebook F9: parasitic species need a host a layout cannot promise.
      id: "not-parasitic",
      description: "Grows without needing a host plant.",
      evaluate: (plant) => {
        const parasitic = (plant.plantType ?? []).some((type) =>
          F9_EXCLUDED_PLANT_TYPES.includes(type),
        );
        return {
          status: parasitic ? "fail" : "pass",
          reason: parasitic
            ? "This is a parasitic plant: it needs a specific host plant, which a garden bed cannot guarantee."
            : "Not a parasitic plant.",
          evidence: {
            source: "Algorithm rulebook 11_Stage0_Filter F9",
            observedValue: plant.plantType,
            requiredValue: "not parasitic",
            confidence: "high",
          },
        };
      },
    },
    {
      // Aquatic species need standing water (rulebook, 2026-09-30). They
      // are removed here, before scoring and optimisation, rather than
      // being given a placement layer.
      id: "not-aquatic",
      description: "Grows in a bed rather than in water.",
      evaluate: (plant) => {
        const aquatic = (plant.plantType ?? []).some((type) =>
          AQUATIC_PLANT_TYPES.includes(type),
        );
        return {
          status: aquatic ? "fail" : "pass",
          reason: aquatic
            ? "This is an aquatic plant: it needs standing water, which a planting bed cannot provide."
            : "Not an aquatic plant.",
          evidence: {
            source: "Algorithm rulebook 11_Stage0_Filter (aquatic, 2026-09-30)",
            observedValue: plant.plantType,
            requiredValue: "not aquatic",
            confidence: "high",
          },
        };
      },
    },
    {
      // Rulebook F5 (R-COAS-012), without its wind trigger by owner
      // decision: thirsty exotics are excluded on low-water sites.
      id: "no-thirsty-exotics",
      description: "Not a thirsty exotic on a low-water site.",
      evaluate: (plant, brief) => {
        const genus = plant.scientificName.split(/\s+/)[0];
        const thirsty = F5_THIRSTY_EXOTIC_GENERA.includes(genus);
        const excluded = thirsty && brief.water === "low";
        return {
          status: excluded ? "fail" : "pass",
          reason: excluded
            ? "Roses, hydrangeas and azaleas need more water than a low-water bed gives."
            : "Not a thirsty exotic for this site.",
          evidence: {
            source: "Algorithm rulebook 11_Stage0_Filter F5",
            observedValue: genus,
            requiredValue: "not Rosa / Hydrangea / Rhododendron on a low-water site",
            confidence: "high",
          },
        };
      },
    },
    {
      // Rulebook F6 (R-COAS-013): named species with an off-site habitat
      // requirement.
      id: "habitat-exclusion",
      description: "Not a species that needs a habitat a garden cannot give.",
      evaluate: (plant) => {
        const listed = onExclusionList(plant.scientificName, F6_NAMED_EXCLUSIONS);
        return {
          status: listed ? "fail" : "pass",
          reason: listed
            ? "This species needs a specific mountain habitat and fails in ordinary garden beds."
            : "No special habitat requirement is recorded.",
          evidence: {
            source: "Algorithm rulebook 11_Stage0_Filter F6",
            observedValue: plant.scientificName,
            requiredValue: "not on the named-exclusion list",
            confidence: "high",
          },
        };
      },
    },
    {
      id: "catalogue-gate",
      description: "Included in the checked plant database.",
      evaluate: (plant) => ({
        status: "pass",
        reason: "This plant is in our checked plant database.",
        evidence: {
          source: "data/processed/plant_database_full.csv",
          observedValue: plant.scientificName,
          requiredValue: "BioSCape occurrence record or PlantZAfrica profile",
          confidence: "high",
        },
      }),
    },
    {
      id: "biome-match",
      description: "Grows in the vegetation type of your area.",
      evaluate: (plant, brief) => {
        // Filtering happens on biome, not bioregion: biome is populated
        // for 99.8% of the catalogue against 23.4% for bioregion, and a
        // location genuinely sits in every biome it touches. A plant is
        // kept if ANY of its biomes is one the user has selected
        // (spec 0.1 rule 4, spec 2.3).
        if (plant.biome === null || plant.biome.length === 0) {
          return {
            status: "unknown",
            reason: "We do not have a vegetation type recorded for this plant yet.",
            evidence: {
              source: "SANBI National Vegetation Map 2018",
              observedValue: null,
              requiredValue: brief.biomes,
              confidence: "unknown",
            },
          };
        }

        const shared = plant.biome.filter((biome) => brief.biomes.includes(biome));
        const selectedLabel = brief.biomes.map((b) => biomeLabels[b]).join(" or ");

        return shared.length > 0
          ? {
              status: "pass",
              reason: `This plant grows in ${shared.map((b) => biomeLabels[b]).join(" and ")}.`,
              evidence: {
                source: "SANBI National Vegetation Map 2018",
                observedValue: plant.biome,
                requiredValue: brief.biomes,
                confidence: plant.bioregionSource === "occurrence" ? "high" : "medium",
              },
            }
          : {
              status: "fail",
              reason: `This plant is not recorded in ${selectedLabel}.`,
              evidence: {
                source: "SANBI National Vegetation Map 2018",
                observedValue: plant.biome,
                requiredValue: brief.biomes,
                confidence: "high",
              },
            };
      },
    },
    {
      id: "light",
      description: "The light matches your garden.",
      evaluate: (plant, brief) => {
        if (plant.sun === null) {
          return {
            status: "unknown",
            reason: "We do not have light guidance for this plant yet.",
            evidence: {
              source: "PlantZAfrica horticultural profile",
              observedValue: null,
              requiredValue: brief.sun,
              confidence: "unknown",
            },
          };
        }
        const acceptedSun = acceptedSuns(brief);
        const sunRelaxed = isRelaxed(brief, "sun") ? " (light relaxed)" : "";
        return plant.sun.some((sun) => acceptedSun.includes(sun))
          ? {
              status: "pass",
              reason: `The current guidance includes ${sunLabels[brief.sun].toLowerCase()}${sunRelaxed}.`,
              evidence: {
                source: "PlantZAfrica horticultural profile",
                observedValue: plant.sun,
                requiredValue: brief.sun,
                confidence: "medium",
              },
            }
          : {
              status: "fail",
              reason: `The current guidance does not include ${sunLabels[brief.sun].toLowerCase()}${sunRelaxed}.`,
              evidence: {
                source: "PlantZAfrica horticultural profile",
                observedValue: plant.sun,
                requiredValue: brief.sun,
                confidence: "medium",
              },
            };
      },
    },
    {
      id: "summer-water",
      description: "Your summer watering should be enough.",
      evaluate: (plant, brief) => {
        if (plant.water === null) {
          return {
            status: "unknown",
            reason: "We do not have watering guidance for this plant yet.",
            evidence: {
              source: "PlantZAfrica horticultural profile",
              observedValue: null,
              requiredValue: brief.water,
              confidence: "unknown",
            },
          };
        }
        // A plant passes when it needs no more water than the brief will
        // give. Relaxing lifts that ceiling by one step.
        const passes = waterLevel(plant.water) <= acceptedWaterCeiling(brief);
        return passes
          ? {
              status: "pass",
              reason: `${waterLabels[brief.water]} should meet this plant’s needs.`,
              evidence: {
                source: "PlantZAfrica horticultural profile",
                observedValue: plant.water,
                requiredValue: brief.water,
                confidence: "medium",
              },
            }
          : {
              status: "fail",
              reason: `${waterLabels[brief.water]} is probably not enough for this plant.`,
              evidence: {
                source: "PlantZAfrica horticultural profile",
                observedValue: plant.water,
                requiredValue: brief.water,
                confidence: "medium",
              },
            };
      },
    },
    {
      id: "canopy-fit",
      description: "The plant’s estimated spread fits the bed.",
      evaluate: (plant, brief) => {
        if (plant.spreadCm === null) {
          return {
            status: "unknown",
            reason: "We do not have a spread measurement for this plant yet.",
            evidence: {
              source: "BioSCape GCFR canopy summary",
              observedValue: null,
              requiredValue: Math.min(brief.bedWidthM, brief.bedLengthM),
              confidence: "unknown",
            },
          };
        }

        const diameterM = plant.spreadCm / 100;
        if (diameterM < MIN_LAYOUT_CANOPY_DIAMETER_M) {
          return {
            status: "unknown",
            reason: `The recorded ${diameterM.toFixed(2)} m spread is too small for us to use with confidence.`,
            evidence: {
              source: "BioSCape GCFR field-canopy median",
              observedValue: diameterM,
              requiredValue: `at least ${MIN_LAYOUT_CANOPY_DIAMETER_M} m for the phase-one layout proxy`,
              confidence: "low",
            },
          };
        }
        return diameterM <= Math.min(brief.bedWidthM, brief.bedLengthM)
          ? {
              status: "pass",
              reason: `The estimated ${diameterM.toFixed(2)} m spread fits inside the bed.`,
              evidence: {
                source: "BioSCape GCFR field-canopy median",
                observedValue: diameterM,
                requiredValue: Math.min(
                  brief.bedWidthM,
                  brief.bedLengthM,
                ),
                confidence: "medium",
              },
            }
          : {
              status: "fail",
              reason: `The estimated ${diameterM.toFixed(2)} m spread is wider than the bed’s narrowest side.`,
              evidence: {
                source: "BioSCape GCFR field-canopy median",
                observedValue: diameterM,
                requiredValue: Math.min(
                  brief.bedWidthM,
                  brief.bedLengthM,
                ),
                confidence: "medium",
              },
            };
      },
    },
    {
      id: "soil",
      description: "The soil suits this plant.",
      evaluate: (plant, brief) => {
        // "I'm not sure" must not filter anything out - the user has told
        // us they do not know, which is not evidence against any plant.
        if (brief.soil === "not-sure") {
          return {
            status: "pass",
            reason: "You chose “I’m not sure” for soil, so we have not filtered on it.",
            evidence: {
              source: "PlantZAfrica horticultural profile",
              observedValue: plant.soilType,
              requiredValue: "not filtered",
              confidence: "unknown",
            },
          };
        }
        if (plant.soilType === null || plant.soilType.length === 0) {
          return {
            status: "unknown",
            reason: "We do not have soil guidance for this plant yet.",
            evidence: {
              source: "PlantZAfrica horticultural profile",
              observedValue: null,
              requiredValue: brief.soil,
              confidence: "unknown",
            },
          };
        }
        // Any-match against every soil this brief accepts - one type
        // normally, or that type plus its neighbours on the
        // sandy/loam/clay gradient once soil has been relaxed.
        const accepted = acceptedSoils(brief);
        const relaxedNote = isRelaxed(brief, "soil") ? " (soil relaxed)" : "";
        return plant.soilType.some((soil) => accepted.includes(soil as Soil))
          ? {
              status: "pass",
              reason: `This plant grows in ${soilLabels[brief.soil].toLowerCase()}${relaxedNote}.`,
              evidence: {
                source: "PlantZAfrica horticultural profile",
                observedValue: plant.soilType,
                requiredValue: brief.soil,
                confidence: plant.soilTypeConfidence === "High" ? "high" : "medium",
              },
            }
          : {
              status: "fail",
              reason: `This plant is not recorded for ${soilLabels[brief.soil].toLowerCase()}${relaxedNote}.`,
              evidence: {
                source: "PlantZAfrica horticultural profile",
                observedValue: plant.soilType,
                requiredValue: brief.soil,
                confidence: plant.soilTypeConfidence === "High" ? "high" : "medium",
              },
            };
      },
    },
  ];
}

function equalWeightCalibration(brief: GardenBrief): PlanningCalibration {
  // The criteria are the extras the user selected. With none selected
  // there is nothing to weigh, and every plant scores the same on this
  // axis - the soft preferences and the profile decide instead.
  const criteria = brief.extras;
  const matrix = criteria.map(() => criteria.map(() => 1));
  if (criteria.length === 0) {
    return {
      status: "baseline-equal-weights",
      criteria: [],
      audit: auditAhpMatrix([[1]]),
      note: "No extra preferences were selected, so Goal Programming has no criteria to weigh and every plant scores equally on that axis.",
    };
  }
  const audit = auditAhpMatrix(matrix);
  if (!audit.accepted) {
    throw new Error(
      `Equal-weight baseline unexpectedly failed AHP audit: ${audit.errors.join(" ")}`,
    );
  }

  return {
    status: "baseline-equal-weights",
    criteria: [...criteria],
    audit,
    note:
      "All selected goals currently carry equal weight. Replace this baseline only with a reviewed AHP matrix that passes the consistency check.",
  };
}

function assessPlant(
  plant: Plant,
  brief: GardenBrief,
  calibration: PlanningCalibration,
  savedPlantIds: readonly string[],
  excludedPlantIds: readonly string[] = [],
): PlantAssessment {
  // "reject", not "review" (owner decision, 2026-09-29): a plant with no
  // recorded light, water or soil is excluded, not flagged and then
  // planted anyway. This matches survivesHardFilters, so the pool and the
  // per-plant verdict can no longer disagree about the same plant.
  const feasibility = evaluateHardConstraints(
    plant,
    brief,
    feasibilityConstraints(excludedPlantIds),
    "reject",
  );
  // Kept for the report's trace: with equal AHP weights, 1 - the GP
  // penalty equals Stage 1's extras_i (matched extras / extras picked).
  const goalProgram = evaluateGoalProgram(
    brief.extras.map((extra, index) => ({
      id: extra,
      actual: matchesExtra(plant, extra) ? 1 : 0,
      target: 1,
      underPenalty: calibration.audit.weights[index] ?? 1,
      overPenalty: 0,
      priority: 1,
    })),
  );

  // Stage 1 runs only on the Stage 0 pool. A plant a hard filter removed
  // gets no score at all, so a saved plant or a wind bonus can never bring
  // it back (Stage 1 rule 4).
  const inPool = feasibility.status !== "infeasible";
  const stage1 = inPool ? scorePlantStage1(plant, { brief, savedPlantIds }) : null;

  const reasons: string[] = [];
  if (stage1) {
    const { terms } = stage1;
    if (terms.style.active && terms.style.value === 1) {
      reasons.push(`suits a ${gardenStyleLabels[brief.style].toLowerCase()} planting`);
    }
    if (terms.saved.active && terms.saved.value === 1) {
      reasons.push("one of your saved plants");
    }
    if (terms.wind.active && terms.wind.value === 1) {
      reasons.push("copes with wind");
    }
    // Only a recorded colour can match: since D25 an unrecorded one scores
    // 0.5, which is not a match.
    if (terms.colour.active && terms.colour.value > 0 && (plant.flowerColour?.length ?? 0) > 0) {
      reasons.push("matches your colour choice");
    }
    for (const extra of brief.extras) {
      if (matchesExtra(plant, extra)) {
        reasons.push(extraPreferenceLabels[extra].toLowerCase());
      }
    }
  }
  if (plant.spreadCm !== null) {
    reasons.push(`${(plant.spreadCm / 100).toFixed(2)} m estimated spread`);
  }

  return {
    plantId: plant.id,
    status:
      feasibility.status === "infeasible"
        ? "excluded"
        : feasibility.status === "review"
          ? "review"
          : "candidate",
    feasibility,
    goalProgram,
    stage1,
    suitability: stage1?.score ?? 0,
    reasons: reasons.slice(0, 3),
    canopyAreaM2:
      plant.spreadCm === null ||
      plant.spreadCm / 100 < MIN_LAYOUT_CANOPY_DIAMETER_M
        ? null
        : circleAreaFromDiameterCm(plant.spreadCm),
  };
}

/** Stage 0 and Stage 1 for a brief - shared by every result so the three
 * options are scored once. */
type Prepared = {
  brief: GardenBrief;
  bedAreaM2: number;
  seed: string;
  variationCounter: number;
  calibration: PlanningCalibration;
  assessments: PlantAssessment[];
  counts: GardenPlan["counts"];
  pool: SpeciesInfo[];
  heightTiers: HeightTiers;
  spreadBands: SpreadBands;
  plantCount: number;
  /** How many of those plants have a measured, rather than imputed,
   * spread - the figure the layout's geometry rests on. */
  measuredSpreadCount: number;
  /** Excluded plants that would otherwise have been available for this
   * brief, so a failed plan can say whether the user's own exclusions are
   * part of the reason. */
  excludedInPool: number;
};

function prepare(
  plants: readonly Plant[],
  brief: GardenBrief,
  options: PlanOptions,
): Prepared {
  const validation = validateGardenBrief(brief);
  if (!validation.valid || validation.bedAreaM2 === null) {
    throw new Error(
      `Cannot build a plan from an invalid garden brief: ${validation.issues.map(({ message }) => message).join(" ")}`,
    );
  }
  const savedPlantIds = options.savedPlantIds ?? [];
  const excludedPlantIds = options.excludedPlantIds ?? [];
  const variationCounter = options.variationCounter ?? 0;
  const calibration = equalWeightCalibration(brief);
  const assessments = plants
    .map((plant) =>
      assessPlant(plant, brief, calibration, savedPlantIds, excludedPlantIds),
    )
    .sort(
      (left, right) =>
        (left.status === "excluded" ? 1 : 0) -
          (right.status === "excluded" ? 1 : 0) ||
        right.suitability - left.suitability ||
        left.plantId.localeCompare(right.plantId),
    );
  const counts = {
    candidate: assessments.filter(({ status }) => status === "candidate").length,
    review: assessments.filter(({ status }) => status === "review").length,
    excluded: assessments.filter(({ status }) => status === "excluded").length,
  };

  // P30/P60 and the spread bands come from the whole catalogue on every
  // load (3_Height_Tiers), never from a hard-coded value.
  const heightTiers = computeHeightTiers(plants);
  const spreadBands = computeSpreadBands(plants);
  const plantsById = new Map(plants.map((plant) => [plant.id, plant]));
  const pool = assessments.flatMap((assessment) => {
    if (assessment.status === "excluded" || assessment.canopyAreaM2 === null) return [];
    const plant = plantsById.get(assessment.plantId) as Plant;
    // C1: the bed area reaches speciesInfo so a small plant's group ladder
    // can scale with the bed it is actually being planned for.
    const info = speciesInfo(
      plant,
      assessment.suitability,
      heightTiers,
      spreadBands,
      validation.bedAreaM2,
    );
    return info ? [info] : [];
  });

  return {
    brief,
    bedAreaM2: validation.bedAreaM2,
    seed: planSeed(brief, savedPlantIds, variationCounter, excludedPlantIds),
    variationCounter,
    calibration,
    assessments,
    counts,
    pool,
    heightTiers,
    spreadBands,
    plantCount: plants.length,
    measuredSpreadCount: plants.filter((plant) => plant.spreadConfidence === "original").length,
    excludedInPool:
      excludedPlantIds.length === 0
        ? 0
        : plants.filter(
            (plant) =>
              excludedPlantIds.includes(plant.id) &&
              survivesHardFilters(plant, brief),
          ).length,
  };
}

/**
 * The short version of how this plan was made and what it does not
 * promise. Kept to the few facts that would change how someone reads the
 * result: where the numbers come from, what was excluded before choosing,
 * what filtered and what only ranked, and which figures are estimates.
 * Anything a gardener cannot act on belongs in docs/ENGINE.md, not here.
 */
/** Thousands separated by an ordinary space. en-ZA groups with a
 * non-breaking space, which lint rejects in source and which copies
 * out of the page badly. */
function groupDigits(value: number): string {
  return value.toLocaleString("en-ZA").split(String.fromCharCode(160)).join(" ");
}

function assumptionsFor(prepared: Prepared): string[] {
  const site = engineSite(prepared.brief);
  const relaxed = prepared.brief.relaxedFilters ?? [];
  const measuredSpread = prepared.measuredSpreadCount;
  return [
    `Built from ${groupDigits(prepared.plantCount)} Western Cape plants (dataset ${DATASET_VERSION}), using the rules in the algorithm rulebook (version ${RULES_VERSION}).`,
    "Legally listed invasive species are removed before anything is chosen, as are plants recorded as poisonous, indoor-only or parasitic.",
    `Your biome, light, water and soil decide which plants are eligible: a plant that fails one is left out. ${
      relaxed.length > 0
        ? `You widened ${relaxed.join(" and ")}, so plants matching the next value along were allowed in.`
        : "Nothing was widened for this plan."
    }`,
    "Wind never removes a plant. It only changes where plants sit in the bed. Garden style, colour and the extras only change the order plants rank in.",
    `Spread is measured for ${groupDigits(measuredSpread)} of these plants and estimated from similar species for the rest, so the circles show likely size, not nursery spacing.`,
    `A ${site.style.label.toLowerCase()} bed aims for ${Math.round(site.style.coverMin * 100)}-${Math.round(site.style.coverMax * 100)}% planted cover and ${site.sMin}-${site.sMax} species at this size; plants are placed shortest at the front, tallest at the back.`,
    "This is a provisional plan, not reviewed horticultural advice: the light, water and soil guidance still needs checking by a plant expert, and nursery prices are indicative rather than live stock.",
  ];
}

function planFromRun(
  prepared: Prepared,
  run: EngineRun | null,
  character: string,
  seed: string,
  extraDiagnostics: string[] = [],
): GardenPlan {
  const { brief } = prepared;
  const site = engineSite(brief);
  const base = {
    brief,
    bedAreaM2: prepared.bedAreaM2,
    calibration: prepared.calibration,
    assessments: prepared.assessments,
    counts: prepared.counts,
    assumptions: assumptionsFor(prepared),
    character,
    seed,
    variationCounter: prepared.variationCounter,
  };
  if (!run || run.status !== "plan" || !run.placement || !run.evaluation) {
    return {
      ...base,
      status: "no-plan",
      openSpaceRatio: 1 - site.style.coverMin,
      quantities: null,
      layout: null,
      engine: null,
      diagnostics: [
        ...(prepared.pool.length === 0
          ? ["None of the plants that passed the checks has a usable spread measurement."]
          : []),
        // Named as a cause only when the user's own exclusions actually cost
        // them plants here, so the message never blames an exclusion that
        // failed a site filter anyway.
        ...(prepared.excludedInPool > 0
          ? [
              `${prepared.excludedInPool === 1 ? "One plant" : `${prepared.excludedInPool} plants`} that suit these conditions ${prepared.excludedInPool === 1 ? "is" : "are"} excluded by you. Putting ${prepared.excludedInPool === 1 ? "it" : "some"} back would give the planner more to work with; otherwise change an answer, or come back once more light, water and soil evidence has been recorded for this combination.`,
            ]
          : []),
        ...(run?.diagnostics ?? []),
        ...extraDiagnostics,
      ],
    };
  }

  const infos = new Map(prepared.pool.map((info) => [info.id, info]));
  // D33b v4: plants the gap fill added are planted too, so they join the
  // list; Z and H1-H7 stay those of the Stage 2/3 selection.
  const planted = new Map(run.selection);
  for (const [id, extra] of run.added ?? []) planted.set(id, (planted.get(id) ?? 0) + extra);
  const quantities = [...planted]
    .map(([id, quantity]) => {
      const each = (infos.get(id) as SpeciesInfo).areaM2;
      return { id, quantity, canopyAreaEachM2: each, allocatedCanopyAreaM2: each * quantity };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const usedCanopyAreaM2 = quantities.reduce((sum, q) => sum + q.allocatedCanopyAreaM2, 0);
  const usableCanopyAreaM2 = site.style.coverMax * prepared.bedAreaM2;

  return {
    ...base,
    status: "provisional-plan",
    openSpaceRatio: run.placement.layout.realisedOpenSpaceRatio,
    quantities: {
      quantities,
      usedCanopyAreaM2,
      usableCanopyAreaM2,
      unusedCanopyAreaM2: Math.max(0, usableCanopyAreaM2 - usedCanopyAreaM2),
      totalPlants: quantities.reduce((sum, q) => sum + q.quantity, 0),
      diagnostics: [],
    },
    layout: run.placement.layout,
    engine: {
      z: run.evaluation.z,
      sBar: run.evaluation.sBar,
      goals: run.evaluation.goals,
      hard: run.evaluation.hard,
      placementChecks: run.placement.checks,
      windProfile: run.placement.profile,
      search: run.search,
      dropped: run.dropped,
      heightTiers: prepared.heightTiers,
      spreadBands: prepared.spreadBands,
      rowsAvailable: site.rowsAvailable,
      rulesVersion: RULES_VERSION,
    },
    diagnostics: [...run.diagnostics, ...extraDiagnostics],
  };
}

/** One result: Stages 0-4 for the brief's seed. */
export function buildGardenPlan(
  plants: readonly Plant[],
  brief: GardenBrief,
  options: PlanOptions = {},
): GardenPlan {
  const prepared = prepare(plants, brief, options);
  const seed = `${prepared.seed}-0`;
  const run =
    prepared.pool.length > 0 ? runEngine(prepared.pool, engineSite(brief), seed) : null;
  return planFromRun(prepared, run, "Option 1", seed);
}


export type RelaxationOption = {
  filter: RelaxableFilter;
  /** Relaxation cost - the order options are offered in. */
  cost: number;
  label: string;
  /** What widening this filter actually admits, in plain words. */
  detail: string;
  recoveredCount: number;
};

export type HardFilterOutcome = {
  survivingCount: number;
  belowMinimum: boolean;
  /** Which answers are doing the excluding, worst first. */
  restrictive: RelaxableFilter[];
  /** Cheapest-first relaxations that would actually recover plants. */
  relaxations: RelaxationOption[];
  /** Filters already widened, so the interface can say so. */
  alreadyRelaxed: RelaxableFilter[];
  /** How many of the user's own exclusions are costing them plants here -
   * that is, excluded plants that would otherwise have survived this
   * brief. Zero when nothing is excluded, or when everything excluded
   * failed a site filter anyway and so was never available. */
  excludedHere: number;
};

/**
 * A plant survives the site filters only when every one of them passes.
 *
 * Owner decision (2026-09-29): unknown evidence now EXCLUDES. A plant with
 * no recorded light, water or soil is dropped from the pool until the
 * dataset gives it a value, rather than being planted on the assumption
 * that it will cope.
 *
 * This closes a real inconsistency: the per-plant assessment already
 * treated unknown as `review` - "check this one first" - while the pool
 * that actually reached Stages 1-4 kept it, so the app could warn about a
 * plant and then plant it anyway. Both paths now agree.
 *
 * Note what is NOT affected. "I'm not sure" about soil is an answer, not
 * missing evidence: that branch returns `pass`, so choosing it still
 * filters nothing and cannot empty the pool.
 */
export function survivesHardFilters(
  plant: Plant,
  brief: GardenBrief,
  excludedPlantIds: readonly string[] = [],
): boolean {
  return !feasibilityConstraints(excludedPlantIds).some((constraint) => {
    const status = constraint.evaluate(plant, brief).status;
    return status === "fail" || status === "unknown";
  });
}

export function countSurvivingPlants(
  plants: readonly Plant[],
  brief: GardenBrief,
  excludedPlantIds: readonly string[] = [],
): number {
  return plants.filter((plant) =>
    survivesHardFilters(plant, brief, excludedPlantIds),
  ).length;
}

/** Widening a filter adds it to the brief's relaxed set; the constraints
 * then accept its adjacent values too. Biome is never in this set. */
export function withRelaxedFilter(
  brief: GardenBrief,
  filter: RelaxableFilter,
): GardenBrief {
  return {
    ...brief,
    relaxedFilters: [...(brief.relaxedFilters ?? []), filter],
  };
}

const RELAXATION_LABELS: Record<RelaxableFilter, string> = {
  soil: "Also accept neighbouring soil types",
  water: "Also accept plants wanting one step more water",
  sun: "Also accept the neighbouring light level",
};

function relaxationDetail(
  brief: GardenBrief,
  filter: RelaxableFilter,
): string {
  if (filter === "soil") {
    const added = acceptedSoils(withRelaxedFilter(brief, "soil")).filter(
      (soil) => soil !== brief.soil,
    );
    return `adds ${added.map((soil) => soilLabels[soil].toLowerCase()).join(" and ")}`;
  }
  if (filter === "water") {
    return "accepts plants that want slightly more summer water than you offered";
  }
  const added = acceptedSuns(withRelaxedFilter(brief, "sun")).filter(
    (sun) => sun !== brief.sun,
  );
  return `adds ${added.map((sun) => sunLabels[sun].toLowerCase()).join(" and ")}`;
}

export function evaluateHardFilters(
  plants: readonly Plant[],
  brief: GardenBrief,
  excludedPlantIds: readonly string[] = [],
): HardFilterOutcome {
  const survivingCount = countSurvivingPlants(plants, brief, excludedPlantIds);
  const belowMinimum = survivingCount < MINIMUM_VIABLE_POOL;

  // Only the exclusions that are actually costing this brief something.
  // A plant excluded by hand that also fails the soil filter is not the
  // reason the pool is small, so the warning must not blame it.
  const excludedSet = new Set(excludedPlantIds);
  const excludedHere =
    excludedSet.size === 0
      ? 0
      : plants.filter(
          (plant) => excludedSet.has(plant.id) && survivesHardFilters(plant, brief),
        ).length;

  // How many plants each relaxable constraint personally fails, so the
  // message can name the restrictive answers rather than shrugging.
  const constraintToFilter: Record<string, RelaxableFilter> = {
    soil: "soil",
    light: "sun",
    "summer-water": "water",
  };
  const failureCounts = new Map<RelaxableFilter, number>();
  for (const plant of plants) {
    for (const constraint of feasibilityConstraints()) {
      const filter = constraintToFilter[constraint.id];
      if (filter && constraint.evaluate(plant, brief).status === "fail") {
        failureCounts.set(filter, (failureCounts.get(filter) ?? 0) + 1);
      }
    }
  }
  const restrictive = [...failureCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([filter]) => filter);

  const relaxations: RelaxationOption[] = [];
  if (belowMinimum) {
    // Offered cheapest first: soil 0.137, water 0.239, sun 0.625.
    for (const filter of RELAXATION_ORDER) {
      if (!canRelax(brief, filter)) continue;
      const recoveredCount = countSurvivingPlants(
        plants,
        withRelaxedFilter(brief, filter),
        excludedPlantIds,
      );
      if (recoveredCount > survivingCount) {
        relaxations.push({
          filter,
          cost: RELAXATION_COSTS[filter],
          label: RELAXATION_LABELS[filter],
          detail: relaxationDetail(brief, filter),
          recoveredCount,
        });
      }
    }
  }

  return {
    survivingCount,
    belowMinimum,
    restrictive,
    relaxations,
    alreadyRelaxed: [...(brief.relaxedFilters ?? [])],
    excludedHere,
  };
}


/** Neutral labels (owner decision): the order is by Z, shown as a score on
 * each tab, but no option is called "best". */
const RESULT_LABELS = ["Option 1", "Option 2", "Option 3"];

/** The three results the user chooses between: the search runs from
 * several seeds and the three best DISTINCT gardens are shown, ranked by
 * Z (owner decision, 2026-09-21), so the tabs are directly comparable.
 * The same answers always reproduce the same three; "Regenerate"
 * (variationCounter) deliberately produces a different set. */
export function buildGardenPlanVariants(
  plants: readonly Plant[],
  brief: GardenBrief,
  options: PlanOptions = {},
): GardenPlan[] {
  const prepared = prepare(plants, brief, options);
  const site = engineSite(brief);
  const found: { run: EngineRun; seed: string }[] = [];
  const seen = new Set<string>();
  let lastRun: EngineRun | null = null;
  for (
    let index = 0;
    index < MAX_RESULT_SEEDS && found.length < RESULT_LABELS.length && prepared.pool.length > 0;
    index += 1
  ) {
    const seed = `${prepared.seed}-${index}`;
    const run = runEngine(prepared.pool, site, seed);
    lastRun = run;
    if (run.status !== "plan") continue;
    const signature = [...run.selection]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, n]) => `${id}x${n}`)
      .join(",");
    if (seen.has(signature)) continue;
    seen.add(signature);
    found.push({ run, seed });
  }
  if (found.length === 0) {
    return [planFromRun(prepared, lastRun, RESULT_LABELS[0], `${prepared.seed}-0`)];
  }
  found.sort((left, right) => (right.run.evaluation?.z ?? 0) - (left.run.evaluation?.z ?? 0));
  const note =
    found.length < RESULT_LABELS.length
      ? [`Only ${found.length} distinct garden${found.length === 1 ? "" : "s"} could be found for these answers.`]
      : [];

  // All three options are laid out from the viewing edge now - engineSite
  // carries it - so there is no longer a single "viewer" option to re-run
  // or label. (Owner decision 12 October 2026, replacing 2026-09-28.)
  return found.map(({ run, seed }, index) =>
    planFromRun(prepared, run, RESULT_LABELS[index], seed, note),
  );
}
