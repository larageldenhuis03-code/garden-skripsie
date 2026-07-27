import {
  areaLabels,
  goalLabels,
  sunLabels,
  waterLabels,
  type Plant,
} from "../../data/plants.ts";
import { auditAhpMatrix, type AhpAudit } from "./ahp.ts";
import {
  type GardenBrief,
  type PlantingDensity,
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
import {
  selectGroupGreedy,
  type GroupSelectionResult,
} from "./groupSelection.ts";
import {
  placeCanopiesInRectangle,
  type RectangularLayout,
} from "./layout.ts";
import {
  allocatePlantQuantities,
  type PlantQuantity,
  type QuantityAllocation,
} from "./quantities.ts";

export type PlanningStatus = "candidate" | "review" | "excluded";

export type PlantAssessment = {
  plantId: string;
  status: PlanningStatus;
  feasibility: FeasibilityResult;
  goalProgram: GoalProgramEvaluation;
  suitability: number;
  reasons: string[];
  canopyAreaM2: number | null;
  category: string;
};

export type PlanningCalibration = {
  status: "baseline-equal-weights";
  criteria: string[];
  audit: AhpAudit;
  note: string;
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
  groupSelection: GroupSelectionResult | null;
  quantities: QuantityAllocation | null;
  layout: RectangularLayout | null;
  assumptions: string[];
  diagnostics: string[];
};

const densityOpenSpace: Record<PlantingDensity, number> = {
  open: 0.45,
  balanced: 0.3,
  lush: 0.18,
};

const densitySpeciesLimit: Record<PlantingDensity, number> = {
  open: 5,
  balanced: 7,
  lush: 9,
};

const densityPlantLimitPerM2: Record<PlantingDensity, number> = {
  open: 3,
  balanced: 5,
  lush: 7,
};

const MIN_LAYOUT_CANOPY_DIAMETER_M = 0.15;

function circleAreaFromDiameterCm(diameterCm: number): number {
  return Math.PI * (diameterCm / 200) ** 2;
}

function categoryForPlant(plant: Plant): string {
  const form = plant.form.toLowerCase();
  if (form.includes("groundcover") || form.includes("succulent")) {
    return "ground layer";
  }
  if (form.includes("geophyte")) return "seasonal layer";
  if (form.includes("tree") || form.includes("tall")) {
    return "upper structure";
  }
  return "mid layer";
}

function feasibilityConstraints(): HardConstraint<Plant, GardenBrief>[] {
  return [
    {
      id: "catalogue-gate",
      description: "Included in the Western Cape starter list.",
      evaluate: (plant) => ({
        status: "pass",
        reason: "This plant is in our checked Western Cape starter list.",
        evidence: {
          source: "data/processed/garden_app_seed_catalog.csv",
          observedValue: plant.scientificName,
          requiredValue: "accepted native/native-endemic Western Cape taxon",
          confidence: "high",
        },
      }),
    },
    {
      id: "regional-affinity",
      description: "Suggested for this part of the Western Cape.",
      evaluate: (plant, brief) =>
        plant.areas.includes(brief.area)
          ? {
              status: "pass",
              reason: `This plant is currently listed for ${areaLabels[brief.area]}.`,
              evidence: {
                source: "Editorial pilot grouping; horticultural review required",
                observedValue: plant.areas,
                requiredValue: brief.area,
                confidence: "low",
              },
            }
          : {
              status: "fail",
              reason: `This plant is not currently listed for ${areaLabels[brief.area]}.`,
              evidence: {
                source: "Editorial pilot grouping; horticultural review required",
                observedValue: plant.areas,
                requiredValue: brief.area,
                confidence: "low",
              },
            },
    },
    {
      id: "light",
      description: "The light matches your garden.",
      evaluate: (plant, brief) =>
        plant.sun.includes(brief.sun)
          ? {
              status: "pass",
              reason: `The current guidance includes ${sunLabels[brief.sun].toLowerCase()}.`,
              evidence: {
                source: "Editorial pilot grouping; horticultural review required",
                observedValue: plant.sun,
                requiredValue: brief.sun,
                confidence: "low",
              },
            }
          : {
              status: "fail",
              reason: `The current guidance does not include ${sunLabels[brief.sun].toLowerCase()}.`,
              evidence: {
                source: "Editorial pilot grouping; horticultural review required",
                observedValue: plant.sun,
                requiredValue: brief.sun,
                confidence: "low",
              },
            },
    },
    {
      id: "summer-water",
      description: "Your summer watering should be enough.",
      evaluate: (plant, brief) => {
        const level = { low: 0, moderate: 1, moist: 2 } as const;
        const passes = level[plant.water] <= level[brief.water];
        return passes
          ? {
              status: "pass",
              reason: `${waterLabels[brief.water]} should meet this plant’s needs.`,
              evidence: {
                source: "Editorial pilot grouping; horticultural review required",
                observedValue: plant.water,
                requiredValue: brief.water,
                confidence: "low",
              },
            }
          : {
              status: "fail",
              reason: `${waterLabels[brief.water]} is probably not enough for this plant.`,
              evidence: {
                source: "Editorial pilot grouping; horticultural review required",
                observedValue: plant.water,
                requiredValue: brief.water,
                confidence: "low",
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
      evaluate: (_plant, brief) => ({
        status: "unknown",
        reason:
          brief.soil === "not-sure"
            ? "You chose “I’m not sure” for soil."
            : `We have not yet checked whether this plant suits ${brief.soil} soil.`,
        evidence: {
          source: "No comprehensive source in the current data foundation",
          observedValue: null,
          requiredValue: brief.soil,
          confidence: "unknown",
        },
      }),
    },
    {
      id: "drainage",
      description: "The drainage suits this plant.",
      evaluate: (_plant, brief) => ({
        status: "unknown",
        reason:
          brief.drainage === "not-sure"
            ? "You chose “I’m not sure” for drainage."
            : `We have not yet checked whether this plant suits ${brief.drainage} drainage.`,
        evidence: {
          source: "No comprehensive source in the current data foundation",
          observedValue: null,
          requiredValue: brief.drainage,
          confidence: "unknown",
        },
      }),
    },
  ];
}

function equalWeightCalibration(brief: GardenBrief): PlanningCalibration {
  const matrix = brief.goals.map(() => brief.goals.map(() => 1));
  const audit = auditAhpMatrix(matrix);
  if (!audit.accepted) {
    throw new Error(
      `Equal-weight baseline unexpectedly failed AHP audit: ${audit.errors.join(" ")}`,
    );
  }

  return {
    status: "baseline-equal-weights",
    criteria: [...brief.goals],
    audit,
    note:
      "All selected goals currently carry equal weight. Replace this baseline only with a reviewed AHP matrix that passes the consistency check.",
  };
}

function assessPlant(
  plant: Plant,
  brief: GardenBrief,
  calibration: PlanningCalibration,
): PlantAssessment {
  const feasibility = evaluateHardConstraints(
    plant,
    brief,
    feasibilityConstraints(),
    "review",
  );
  const goalProgram = evaluateGoalProgram(
    brief.goals.map((goal, index) => ({
      id: goal,
      actual: plant.goals.includes(goal) ? 1 : 0,
      target: 1,
      underPenalty: calibration.audit.weights[index],
      overPenalty: 0,
      priority: 1,
    })),
  );
  const suitability = Math.max(
    0,
    100 * (1 - goalProgram.totalWeightedPenalty),
  );
  const matchedGoals = brief.goals.filter((goal) => plant.goals.includes(goal));
  const reasons = matchedGoals
    .slice(0, 3)
    .map((goal) => goalLabels[goal]);

  if (plant.spreadCm !== null) {
    reasons.push(`${(plant.spreadCm / 100).toFixed(2)} m estimated spread`);
  }
  if (reasons.length === 0) {
    reasons.push("No match was found for the goals you chose");
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
    suitability,
    reasons: reasons.slice(0, 3),
    canopyAreaM2:
      plant.spreadCm === null ||
      plant.spreadCm / 100 < MIN_LAYOUT_CANOPY_DIAMETER_M
        ? null
        : circleAreaFromDiameterCm(plant.spreadCm),
    category: categoryForPlant(plant),
  };
}

function fitAllocationToLayout(
  initial: QuantityAllocation,
  plantsById: ReadonlyMap<string, Plant>,
  brief: GardenBrief,
): { quantities: QuantityAllocation; layout: RectangularLayout } {
  const counts = new Map(
    initial.quantities.map(({ id, quantity }) => [id, quantity]),
  );
  const diagnostics = [...initial.diagnostics];
  let layout: RectangularLayout;

  while (true) {
    const species = [...counts.entries()]
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const plant = plantsById.get(id);
        if (!plant || plant.spreadCm === null) {
          throw new Error(`Layout data disappeared for "${id}".`);
        }
        return { id, quantity, diameterM: plant.spreadCm / 100 };
      });
    layout = placeCanopiesInRectangle(
      species,
      brief.bedWidthM,
      brief.bedLengthM,
    );
    if (layout.status === "complete") break;

    const firstUnplaced = layout.unplaced[0];
    const current = counts.get(firstUnplaced.plantId) ?? 0;
    if (current <= 0) break;
    counts.set(firstUnplaced.plantId, current - 1);
    diagnostics.push(
      `Reduced ${firstUnplaced.plantId} to ${current - 1} because every plant would not fit inside the bed.`,
    );
  }

  const initialById = new Map(
    initial.quantities.map((quantity) => [quantity.id, quantity]),
  );
  const quantities = [...counts.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map<PlantQuantity>(([id, quantity]) => {
      const initialQuantity = initialById.get(id);
      if (!initialQuantity) {
        throw new Error(`Quantity data disappeared for "${id}".`);
      }
      return {
        id,
        quantity,
        canopyAreaEachM2: initialQuantity.canopyAreaEachM2,
        allocatedCanopyAreaM2:
          initialQuantity.canopyAreaEachM2 * quantity,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const usedCanopyAreaM2 = quantities.reduce(
    (sum, item) => sum + item.allocatedCanopyAreaM2,
    0,
  );

  return {
    quantities: {
      ...initial,
      quantities,
      usedCanopyAreaM2,
      unusedCanopyAreaM2: Math.max(
        0,
        initial.usableCanopyAreaM2 - usedCanopyAreaM2,
      ),
      totalPlants: quantities.reduce(
        (sum, quantity) => sum + quantity.quantity,
        0,
      ),
      diagnostics,
    },
    layout,
  };
}

export function buildGardenPlan(
  plants: readonly Plant[],
  brief: GardenBrief,
): GardenPlan {
  const validation = validateGardenBrief(brief);
  if (!validation.valid || validation.bedAreaM2 === null) {
    throw new Error(
      `Cannot build a plan from an invalid garden brief: ${validation.issues.map(({ message }) => message).join(" ")}`,
    );
  }

  const calibration = equalWeightCalibration(brief);
  const assessments = plants
    .map((plant) => assessPlant(plant, brief, calibration))
    .sort(
      (left, right) =>
        (left.status === "excluded" ? 1 : 0) -
          (right.status === "excluded" ? 1 : 0) ||
        right.suitability - left.suitability ||
        left.plantId.localeCompare(right.plantId),
    );
  const counts = {
    candidate: assessments.filter(({ status }) => status === "candidate")
      .length,
    review: assessments.filter(({ status }) => status === "review").length,
    excluded: assessments.filter(({ status }) => status === "excluded").length,
  };
  const openSpaceRatio = densityOpenSpace[brief.density];
  const eligible = assessments.filter(
    (assessment) =>
      assessment.status !== "excluded" &&
      assessment.canopyAreaM2 !== null &&
      assessment.suitability > 0,
  );
  const assumptions = [
    "This plan uses a starter list of 48 local plants from SANPC, BODATSA and BioSCape.",
    "The area, light, water and garden-use advice still needs checking by a plant expert.",
    "We do not yet have reliable soil and drainage guidance for every plant.",
    "Every goal you chose currently counts equally.",
    `Your “${brief.density}” setting leaves about ${Math.round(openSpaceRatio * 100)}% of the bed open.`,
    `We cap the plan at ${densityPlantLimitPerM2[brief.density]} plants per square metre to avoid unrealistic quantities.`,
    `Spread records below ${MIN_LAYOUT_CANOPY_DIAMETER_M} m are not used in the layout until we can check them.`,
    "The circles use recorded plant spread as a guide, not exact nursery spacing.",
  ];
  const diagnostics: string[] = [];

  if (eligible.length === 0) {
    diagnostics.push(
      "None of the plants that passed the checks had both a usable spread measurement and a match for your goals.",
    );
    return {
      status: "no-plan",
      brief,
      bedAreaM2: validation.bedAreaM2,
      openSpaceRatio,
      calibration,
      assessments,
      counts,
      groupSelection: null,
      quantities: null,
      layout: null,
      assumptions,
      diagnostics,
    };
  }

  const groupCandidates = eligible.map((assessment) => ({
    id: assessment.plantId,
    suitability: assessment.suitability,
    canopyArea: assessment.canopyAreaM2 as number,
    category: assessment.category,
  }));
  const categories = new Set(
    groupCandidates.map((candidate) => candidate.category),
  );
  const categoryRules = [
    ...(categories.has("upper structure")
      ? [
          {
            category: "upper structure",
            minimumRatio: 0.08,
            maximumRatio: 0.45,
          },
        ]
      : []),
    ...(categories.has("mid layer")
      ? [
          {
            category: "mid layer",
            minimumRatio: 0.08,
            maximumRatio: 0.45,
          },
        ]
      : []),
    ...(categories.has("ground layer")
      ? [{ category: "ground layer", maximumRatio: 0.35 }]
      : []),
    ...(categories.has("seasonal layer")
      ? [{ category: "seasonal layer", maximumRatio: 0.25 }]
      : []),
  ];
  const groupSelection = selectGroupGreedy(groupCandidates, {
    bedArea: validation.bedAreaM2,
    openSpaceRatio,
    categoryRules,
    maximumSpecies: densitySpeciesLimit[brief.density],
  });

  if (
    groupSelection.status !== "solution" ||
    groupSelection.selectedIds.length === 0
  ) {
    diagnostics.push(...groupSelection.diagnostics);
    return {
      status: "no-plan",
      brief,
      bedAreaM2: validation.bedAreaM2,
      openSpaceRatio,
      calibration,
      assessments,
      counts,
      groupSelection,
      quantities: null,
      layout: null,
      assumptions,
      diagnostics,
    };
  }

  const assessmentsById = new Map(
    assessments.map((assessment) => [assessment.plantId, assessment]),
  );
  const quantityCandidates = groupSelection.selectedIds.map((id) => {
    const assessment = assessmentsById.get(id);
    if (!assessment || assessment.canopyAreaM2 === null) {
      throw new Error(`Selected plant "${id}" has no quantity inputs.`);
    }
    return {
      id,
      suitability: assessment.suitability,
      canopyAreaM2: assessment.canopyAreaM2,
    };
  });
  const initialQuantities = allocatePlantQuantities(quantityCandidates, {
    bedAreaM2: validation.bedAreaM2,
    openSpaceRatio,
    maximumTotalPlants: Math.max(
      groupSelection.selectedIds.length,
      Math.min(
        240,
        Math.ceil(
          validation.bedAreaM2 * densityPlantLimitPerM2[brief.density],
        ),
      ),
    ),
  });
  const fitted = fitAllocationToLayout(
    initialQuantities,
    new Map(plants.map((plant) => [plant.id, plant])),
    brief,
  );

  diagnostics.push(...groupSelection.diagnostics);
  diagnostics.push(...fitted.quantities.diagnostics);
  diagnostics.push(...fitted.layout.diagnostics);

  return {
    status:
      fitted.layout.status === "complete" &&
      fitted.layout.placements.length > 0
        ? "provisional-plan"
        : "no-plan",
    brief,
    bedAreaM2: validation.bedAreaM2,
    openSpaceRatio,
    calibration,
    assessments,
    counts,
    groupSelection,
    quantities: fitted.quantities,
    layout: fitted.layout,
    assumptions,
    diagnostics,
  };
}
