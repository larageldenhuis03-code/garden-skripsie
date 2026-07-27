import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import {
  allocatePlantQuantities,
  auditRectangularLayout,
  auditAhpMatrix,
  buildGardenPlan,
  checkGroupSelection,
  compareGoalPrograms,
  evaluateGoalProgram,
  evaluateHardConstraints,
  placeCanopiesInRectangle,
  parseGardenBrief,
  selectGroupGreedy,
  validateGardenBrief,
  workingExampleBrief,
  workingExampleOutput,
  type GardenBrief,
  type HardConstraint,
} from "../app/lib/planning/index.ts";

const completeBrief: GardenBrief = {
  area: "cape-town",
  soil: "sandy",
  drainage: "free",
  sun: "full",
  water: "low",
  bedWidthM: 2,
  bedLengthM: 3,
  density: "balanced",
  goals: ["flowers", "pollinators"],
};

test("garden brief validates dimensions, goals and persisted input", () => {
  const valid = validateGardenBrief(completeBrief);
  assert.equal(valid.valid, true);
  assert.equal(valid.bedAreaM2, 6);
  assert.deepEqual(parseGardenBrief(completeBrief), completeBrief);

  const invalid = validateGardenBrief({
    ...completeBrief,
    bedWidthM: 0.2,
    goals: [],
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.bedAreaM2, null);
  assert.ok(invalid.issues.some(({ field }) => field === "bedWidthM"));
  assert.ok(invalid.issues.some(({ field }) => field === "goals"));
  assert.equal(parseGardenBrief({ ...completeBrief, bedLengthM: 100 }), null);
});

test("AHP derives expected weights from a consistent reciprocal matrix", () => {
  const result = auditAhpMatrix([
    [1, 2, 4],
    [1 / 2, 1, 2],
    [1 / 4, 1 / 2, 1],
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.accepted, true);
  assert.ok(result.consistencyRatio !== null);
  assert.ok(Math.abs(result.consistencyRatio) < 1e-12);
  assert.deepEqual(
    result.weights.map((weight) => Number(weight.toFixed(6))),
    [0.571429, 0.285714, 0.142857],
  );
  assert.ok(
    Math.abs(result.weights.reduce((sum, weight) => sum + weight, 0) - 1) <
      1e-12,
  );
});

test("AHP rejects inconsistent judgements and malformed reciprocity", () => {
  const inconsistent = auditAhpMatrix([
    [1, 9, 1],
    [1 / 9, 1, 9],
    [1, 1 / 9, 1],
  ]);
  assert.equal(inconsistent.valid, true);
  assert.equal(inconsistent.accepted, false);
  assert.ok((inconsistent.consistencyRatio ?? 0) > 0.1);

  const malformed = auditAhpMatrix([
    [1, 3],
    [1 / 2, 1],
  ]);
  assert.equal(malformed.valid, false);
  assert.equal(malformed.accepted, false);
  assert.match(malformed.errors.join(" "), /not reciprocal/);
});

test("hard constraints keep failures and unknown evidence out of feasibility", () => {
  type Candidate = { spreadCm: number | null; soil: string | null };
  type Context = { maximumSpreadCm: number; requiredSoil: string };

  const constraints: HardConstraint<Candidate, Context>[] = [
    {
      id: "spread",
      description: "Mature spread fits the available width.",
      evaluate: (candidate, context) =>
        candidate.spreadCm === null
          ? { status: "unknown", reason: "Mature spread is missing." }
          : candidate.spreadCm <= context.maximumSpreadCm
            ? { status: "pass", reason: "Mature spread fits." }
            : { status: "fail", reason: "Mature spread is too wide." },
    },
    {
      id: "soil",
      description: "Reviewed soil compatibility.",
      evaluate: (candidate, context) =>
        candidate.soil === null
          ? { status: "unknown", reason: "Soil compatibility is not reviewed." }
          : candidate.soil === context.requiredSoil
            ? { status: "pass", reason: "Soil compatibility is reviewed." }
            : { status: "fail", reason: "Soil type is incompatible." },
    },
  ];

  const review = evaluateHardConstraints(
    { spreadCm: null, soil: "sand" },
    { maximumSpreadCm: 100, requiredSoil: "sand" },
    constraints,
    "review",
  );
  assert.equal(review.status, "review");
  assert.equal(review.feasible, false);
  assert.equal(review.trace[0].status, "unknown");

  const rejected = evaluateHardConstraints(
    { spreadCm: null, soil: "sand" },
    { maximumSpreadCm: 100, requiredSoil: "sand" },
    constraints,
    "reject",
  );
  assert.equal(rejected.status, "infeasible");
});

test("Goal Programming exposes directional deviations and honours priorities", () => {
  const candidateA = evaluateGoalProgram([
    {
      id: "water",
      actual: 2,
      target: 4,
      underPenalty: 3,
      overPenalty: 0,
      priority: 1,
    },
    {
      id: "flowering",
      actual: 5,
      target: 3,
      underPenalty: 1,
      overPenalty: 2,
      priority: 2,
    },
  ]);

  assert.deepEqual(
    candidateA.deviations.map(
      ({ id, underDeviation, overDeviation, weightedPenalty }) => ({
        id,
        underDeviation,
        overDeviation,
        weightedPenalty,
      }),
    ),
    [
      {
        id: "water",
        underDeviation: 2,
        overDeviation: 0,
        weightedPenalty: 6,
      },
      {
        id: "flowering",
        underDeviation: 0,
        overDeviation: 2,
        weightedPenalty: 4,
      },
    ],
  );

  const candidateB = evaluateGoalProgram([
    {
      id: "water",
      actual: 3,
      target: 4,
      underPenalty: 3,
      overPenalty: 0,
      priority: 1,
    },
    {
      id: "flowering",
      actual: -100,
      target: 3,
      underPenalty: 1,
      overPenalty: 0,
      priority: 2,
    },
  ]);

  assert.ok(candidateB.totalWeightedPenalty > candidateA.totalWeightedPenalty);
  assert.ok(compareGoalPrograms(candidateB, candidateA) < 0);
});

test("binary group selection checks area constraints and builds a feasible subset", () => {
  const candidates = [
    { id: "flower-a", suitability: 8, canopyArea: 2, category: "flowers" },
    { id: "flower-b", suitability: 1, canopyArea: 3, category: "flowers" },
    { id: "frame-a", suitability: 9, canopyArea: 4, category: "structure" },
    { id: "frame-b", suitability: 2, canopyArea: 1, category: "structure" },
  ];
  const model = {
    bedArea: 10,
    openSpaceRatio: 0.2,
    categoryRules: [
      { category: "flowers", minimumRatio: 0.2, maximumRatio: 0.4 },
      { category: "structure", maximumRatio: 0.5 },
    ],
  };

  const invalidSelection = checkGroupSelection(
    candidates,
    ["flower-a", "flower-b", "frame-a"],
    model,
  );
  assert.equal(invalidSelection.feasible, false);
  assert.ok(
    invalidSelection.violations.some(
      ({ constraint }) => constraint === "total-area",
    ),
  );

  const result = selectGroupGreedy(candidates, model);
  assert.equal(result.status, "solution");
  assert.equal(result.modelKind, "binary-species-subset");
  assert.equal(result.check.feasible, true);
  assert.ok(result.selectedIds.includes("flower-a"));
  assert.match(
    result.diagnostics.join(" "),
    /quantities and positions are worked out next/i,
  );
});

test("greedy failure is not presented as a mathematical infeasibility proof", () => {
  const result = selectGroupGreedy(
    [{ id: "frame-a", suitability: 4, canopyArea: 2, category: "structure" }],
    {
      bedArea: 10,
      openSpaceRatio: 0.2,
      categoryRules: [{ category: "flowers", minimumRatio: 0.2 }],
    },
  );

  assert.equal(result.status, "no-feasible-greedy-solution");
  assert.equal(result.check.feasible, false);
  assert.match(result.diagnostics.join(" "), /could not add enough plants/i);
});

test("group model rejects contradictory category minimums", () => {
  assert.throws(
    () =>
      selectGroupGreedy(
        [
          { id: "a", suitability: 4, canopyArea: 1, category: "flowers" },
          { id: "b", suitability: 3, canopyArea: 1, category: "structure" },
        ],
        {
          bedArea: 10,
          openSpaceRatio: 0.3,
          categoryRules: [
            { category: "flowers", minimumRatio: 0.4 },
            { category: "structure", minimumRatio: 0.4 },
          ],
        },
      ),
    /minimums exceed the usable planting-area ratio/,
  );
});

test("group selection enforces an explicit species-count limit", () => {
  const candidates = [
    { id: "a", suitability: 9, canopyArea: 0.5, category: "flowers" },
    { id: "b", suitability: 8, canopyArea: 0.5, category: "flowers" },
    { id: "c", suitability: 7, canopyArea: 0.5, category: "structure" },
  ];
  const result = selectGroupGreedy(candidates, {
    bedArea: 10,
    openSpaceRatio: 0.2,
    categoryRules: [],
    maximumSpecies: 2,
  });

  assert.equal(result.status, "solution");
  assert.equal(result.selectedIds.length, 2);
  assert.equal(result.check.feasible, true);
});

test("integer quantities stay inside the usable canopy allowance", () => {
  const allocation = allocatePlantQuantities(
    [
      { id: "structure", suitability: 90, canopyAreaM2: 1.2 },
      { id: "flowers", suitability: 80, canopyAreaM2: 0.4 },
    ],
    {
      bedAreaM2: 6,
      openSpaceRatio: 0.3,
      maximumTotalPlants: 8,
    },
  );

  assert.ok(allocation.quantities.every(({ quantity }) => quantity >= 1));
  assert.ok(allocation.quantities.every(({ quantity }) => Number.isInteger(quantity)));
  assert.ok(
    allocation.usedCanopyAreaM2 <= allocation.usableCanopyAreaM2 + 1e-9,
  );
  assert.ok(allocation.totalPlants <= 8);
  assert.match(
    allocation.diagnostics.join(" "),
    /recorded plant spread as a guide/i,
  );
});

test("rectangular layout returns boundary-safe, non-overlapping coordinates", () => {
  const layout = placeCanopiesInRectangle(
    [
      { id: "large", quantity: 2, diameterM: 1 },
      { id: "small", quantity: 4, diameterM: 0.5 },
    ],
    3,
    2,
  );

  assert.equal(layout.status, "complete");
  assert.equal(layout.placements.length, 6);
  assert.deepEqual(auditRectangularLayout(layout), []);
  assert.ok(layout.realisedOpenSpaceRatio > 0);
});

test("rectangular layout reports footprints it cannot safely place", () => {
  const layout = placeCanopiesInRectangle(
    [{ id: "tree", quantity: 1, diameterM: 3 }],
    2,
    4,
  );

  assert.equal(layout.status, "partial");
  assert.equal(layout.placements.length, 0);
  assert.equal(layout.unplaced.length, 1);
  assert.match(layout.unplaced[0].reason, /wider/i);
});

test("the mined 48-plant pilot produces a traceable provisional plan", () => {
  const plan = buildGardenPlan(plants, {
    ...completeBrief,
    goals: [...completeBrief.goals],
  });

  assert.equal(plan.status, "provisional-plan");
  assert.equal(plan.calibration.status, "baseline-equal-weights");
  assert.equal(plan.calibration.audit.accepted, true);
  assert.equal(plan.assessments.length, 48);
  assert.ok(plan.counts.review > 0);
  assert.ok(plan.counts.excluded > 0);
  assert.ok(plan.quantities);
  assert.ok(plan.layout);
  assert.equal(plan.layout?.status, "complete");
  assert.deepEqual(auditRectangularLayout(plan.layout!), []);
  assert.ok((plan.quantities?.totalPlants ?? 0) > 0);
  assert.ok((plan.quantities?.totalPlants ?? 0) <= 30);
  assert.match(
    plan.assumptions.join(" "),
    /starter list of 48 local plants from SANPC/i,
  );
  assert.match(plan.assumptions.join(" "), /soil and drainage/i);
  assert.match(plan.assumptions.join(" "), /cap the plan at/i);
});

test("the guided test garden matches its promised output", () => {
  const plan = buildGardenPlan(plants, {
    ...workingExampleBrief,
    goals: [...workingExampleBrief.goals],
  });

  assert.equal(plan.status, "provisional-plan");
  assert.equal(plan.quantities?.totalPlants, workingExampleOutput.totalPlants);
  assert.equal(
    plan.quantities?.quantities.length,
    workingExampleOutput.species,
  );
  assert.equal(
    Math.round((plan.layout?.realisedOpenSpaceRatio ?? 0) * 100),
    workingExampleOutput.openSpacePercent,
  );
});

test("tiny canopy records cannot dominate a long-bed plan", () => {
  const plan = buildGardenPlan(plants, {
    area: "cape-town",
    soil: "not-sure",
    drainage: "free",
    sun: "full",
    water: "moderate",
    bedWidthM: 2,
    bedLengthM: 5,
    density: "open",
    goals: ["flowers", "pollinators"],
  });
  const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

  assert.equal(plan.status, "provisional-plan");
  assert.ok(plan.layout);
  assert.ok(plan.quantities);
  assert.ok((plan.layout?.realisedOpenSpaceRatio ?? 1) < 0.65);
  assert.ok(
    plan.quantities!.quantities.every(
      ({ id }) => (plantsById.get(id)?.spreadCm ?? 0) >= 15,
    ),
  );
  assert.ok(
    plan.quantities!.quantities.every(
      ({ quantity }) => quantity <= plan.quantities!.totalPlants / 2,
    ),
  );
  assert.deepEqual(auditRectangularLayout(plan.layout!), []);
});
