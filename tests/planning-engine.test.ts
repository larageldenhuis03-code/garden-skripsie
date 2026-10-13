import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import {
  allocatePlantQuantities,
  auditRectangularLayout,
  auditAhpMatrix,
  buildGardenPlan,
  buildGardenPlanVariants,
  planSeed,
  survivesHardFilters,
  checkGroupSelection,
  compareGoalPrograms,
  evaluateGoalProgram,
  evaluateHardConstraints,
  placeCanopiesInRectangle,
  parseGardenBrief,
  selectGroupGreedy,
  validateGardenBrief,
  type GardenBrief,
  type HardConstraint,
  BED_NORTH_EDGE,
  MINIMUM_VIABLE_POOL,
  RELAXATION_COSTS,
  RELAXATION_ORDER,
  type RelaxableFilter,
  acceptedSoils,
  acceptedSuns,
  acceptedWaterCeiling,
  canRelax,
  hasUnknownColour,
  matchesExtra,
  colourTerm,
  extrasTerm,
  pickedColours,
  scorePlantStage1,
  withRelaxedFilter,
  bedDimensionsCm,
  bedShapeFor,
  countSurvivingPlants,
  isWindResilient,
  evaluateHardFilters,
} from "../app/lib/planning/index.ts";
import { parseSavedLayout } from "../app/lib/storage.ts";

const completeBrief: GardenBrief = {
  biomes: ["Fynbos"],
  bioregion: "Southwest Fynbos Bioregion",
  soil: "sandy",
  wind: "none",
  viewingEdge: "north",
  sun: "full",
  water: "moderate",
  bedWidthM: 2,
  bedLengthM: 3,
  style: "undecided",
  colour: { mode: "none" },
  extras: [],
};

test("garden brief validates dimensions, goals and persisted input", () => {
  const valid = validateGardenBrief(completeBrief);
  assert.equal(valid.valid, true);
  assert.equal(valid.bedAreaM2, 6);
  assert.deepEqual(parseGardenBrief(completeBrief), completeBrief);

  const invalid = validateGardenBrief({
    ...completeBrief,
    bedWidthM: 0.2,
    style: "undecided",
    colour: { mode: "none" },
    extras: [],
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.bedAreaM2, null);
  assert.ok(invalid.issues.some(({ field }) => field === "bedWidthM"));
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

test("the combined plant database produces a traceable provisional plan", () => {
  const plan = buildGardenPlan(plants, { ...completeBrief });

  assert.equal(plan.status, "provisional-plan");
  assert.equal(plan.calibration.status, "baseline-equal-weights");
  assert.equal(plan.calibration.audit.accepted, true);
  assert.equal(plan.assessments.length, plants.length);
  // Unknown evidence now excludes rather than flagging (2026-09-29), so
  // the "review" bucket is empty by design and those plants appear as
  // excluded, each carrying the reason its data is missing.
  assert.equal(plan.counts.review, 0);
  assert.ok(plan.counts.excluded > 0);
  const missingData = plan.assessments.find((a) =>
    a.feasibility.trace.some((t) => t.status === "unknown"),
  );
  assert.ok(missingData, "expected at least one plant with missing evidence");
  assert.equal(missingData.status, "excluded");
  assert.match(
    missingData.feasibility.trace.find((t) => t.status === "unknown")!.reason,
    /do not have .* for this plant yet/i,
  );
  assert.ok(plan.quantities);
  assert.ok(plan.layout);
  assert.equal(plan.layout?.status, "complete");
  assert.deepEqual(auditRectangularLayout(plan.layout!), []);
  assert.ok((plan.quantities?.totalPlants ?? 0) > 0);
  assert.ok((plan.quantities?.totalPlants ?? 0) <= 30);
  // The notes are user-facing copy, so these assert what they must TELL
  // the reader, not the exact sentences (rewritten 2026-09-28).
  const notes = plan.assumptions.join(" ");
  assert.match(notes, /[\d ,]+ Western Cape plants/i);
  assert.match(notes, /algorithm rulebook \(version [0-9a-f]{12}\)/i);
  // The three limitations a reader must not miss.
  assert.match(notes, /invasive species are removed/i);
  assert.match(notes, /wind never removes a plant/i);
  assert.match(notes, /spread is measured for [\d ,]+ of these plants/i);
  assert.match(notes, /not reviewed horticultural advice/i);
  // Every hard rule held on the delivered plan.
  assert.ok(plan.engine);
  assert.ok(plan.engine.hard.every((check) => check.pass));
  assert.ok(plan.engine.placementChecks.filter((c) => c.kind === "hard").every((c) => c.pass));
});

test("tiny canopy records cannot dominate a long-bed plan", () => {
  const plan = buildGardenPlan(plants, {
    biomes: ["Fynbos"],
    bioregion: "Southwest Fynbos Bioregion",
    soil: "not-sure",
    wind: "none",
    viewingEdge: "north",
    sun: "full",
    water: "moderate",
      bedWidthM: 2,
    bedLengthM: 5,
    style: "undecided",
    colour: { mode: "none" },
    extras: [],
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

test("bed size reaches the optimiser in centimetres with the north edge", () => {
  const dimensions = bedDimensionsCm({
    ...completeBrief,
    bedWidthM: 2.4,
    bedLengthM: 3.05,
  });

  // Display stays in metres; every geometry input is centimetres (spec 0.6).
  assert.equal(dimensions.widthCm, 240);
  assert.equal(dimensions.lengthCm, 305);
  assert.equal(dimensions.northEdge, BED_NORTH_EDGE);
  assert.equal(BED_NORTH_EDGE, "top");
});

test("bed shape follows from the dimensions rather than being chosen", () => {
  assert.equal(bedShapeFor(2, 2), "square");
  // Within 5 cm still reads as square - nobody measures a bed to the mm.
  assert.equal(bedShapeFor(2, 2.04), "square");
  assert.equal(bedShapeFor(2, 3), "portrait");
  assert.equal(bedShapeFor(3, 2), "landscape");
});

test("site filters use any-match and report a surviving count", () => {
  const surviving = countSurvivingPlants(plants, completeBrief);
  assert.ok(surviving > 0);
  assert.ok(surviving < plants.length, "the filters must actually exclude something");

  // A plant listing several soils suits every one of them (spec 0.1).
  const multiSoil = plants.find(
    (plant) => (plant.soilType?.length ?? 0) > 1 && !plant.excludedFromLayout,
  );
  assert.ok(multiSoil, "expected a plant with more than one soil type");
  for (const soil of multiSoil.soilType ?? []) {
    const outcome = evaluateHardFilters(
      [multiSoil],
      { ...completeBrief, soil: soil as typeof completeBrief.soil },
    );
    assert.equal(
      outcome.survivingCount,
      1,
      `${multiSoil.scientificName} should survive a ${soil} brief`,
    );
  }
});

test("relaxation widens along the gradient, cheapest first, never biome", () => {
  const restrictive = {
    ...completeBrief,
    soil: "clay" as const,
    sun: "sheltered" as const,
    water: "low" as const,
  };
  const outcome = evaluateHardFilters(plants, restrictive);

  assert.ok(outcome.belowMinimum, "expected this brief to be too restrictive");
  assert.ok(outcome.survivingCount < MINIMUM_VIABLE_POOL);
  assert.ok(outcome.restrictive.length > 0, "must name what is restricting");

  // Offered cheapest first: soil 0.276 < water 0.316 < sun 0.408.
  const costs = outcome.relaxations.map((option) => option.cost);
  assert.deepEqual([...costs].sort((a, b) => a - b), costs);
  for (const option of outcome.relaxations) {
    assert.equal(option.cost, RELAXATION_COSTS[option.filter]);
    assert.ok(option.recoveredCount > outcome.survivingCount);
  }

  // Sun may be offered now that sheltered steps to part, but it must
  // always come last - it is the most expensive at 0.408.
  const sunOption = outcome.relaxations.find((option) => option.filter === "sun");
  if (sunOption) {
    assert.equal(outcome.relaxations.at(-1)?.filter, "sun");
  }
});

test("soil relaxation admits neighbours only, never the far end", () => {
  // sandy <-> loam <-> clay: relaxing sandy must not reach clay.
  assert.deepEqual(acceptedSoils({ ...completeBrief, soil: "sandy" }), ["sandy"]);
  assert.deepEqual(
    acceptedSoils(withRelaxedFilter({ ...completeBrief, soil: "sandy" }, "soil")),
    ["sandy", "loam"],
  );
  assert.deepEqual(
    acceptedSoils(withRelaxedFilter({ ...completeBrief, soil: "clay" }, "soil")),
    ["loam", "clay"],
  );
  // Loam sits in the middle, so it reaches both.
  assert.deepEqual(
    acceptedSoils(withRelaxedFilter({ ...completeBrief, soil: "loam" }, "soil")),
    ["sandy", "loam", "clay"],
  );
});

test("sun relaxation steps one level, never bridging full and sheltered", () => {
  // full <-> part <-> sheltered, neighbours only.
  assert.deepEqual(
    acceptedSuns(withRelaxedFilter({ ...completeBrief, sun: "full" }, "sun")),
    ["full", "part"],
  );
  assert.deepEqual(
    acceptedSuns(withRelaxedFilter({ ...completeBrief, sun: "sheltered" }, "sun")),
    ["sheltered", "part"],
  );
  // Part sits in the middle, so it reaches both.
  assert.deepEqual(
    acceptedSuns(withRelaxedFilter({ ...completeBrief, sun: "part" }, "sun")),
    ["part", "full", "sheltered"],
  );

  // The far ends are never joined, in either direction.
  const relaxedFull = acceptedSuns(
    withRelaxedFilter({ ...completeBrief, sun: "full" }, "sun"),
  );
  assert.ok(!relaxedFull.includes("sheltered"));
  const relaxedSheltered = acceptedSuns(
    withRelaxedFilter({ ...completeBrief, sun: "sheltered" }, "sun"),
  );
  assert.ok(!relaxedSheltered.includes("full"));

  // Every level now has somewhere to go, so all three can be relaxed.
  assert.equal(canRelax({ ...completeBrief, sun: "sheltered" }, "sun"), true);
});

test("water relaxation lifts the ceiling by exactly one step", () => {
  const low = { ...completeBrief, water: "low" as const };
  assert.equal(acceptedWaterCeiling(low), 0);
  assert.equal(acceptedWaterCeiling(withRelaxedFilter(low, "water")), 1);
  // Already at the wettest level, so there is nothing to widen.
  assert.equal(canRelax({ ...completeBrief, water: "moist" }, "water"), false);
});

test("style and colour rank but never filter", () => {
  const neutral = buildGardenPlan(plants, completeBrief);
  const styled = buildGardenPlan(plants, {
    ...completeBrief,
    style: "fynbos",
    colour: { mode: "scheme", scheme: "warm" },
  });

  // The pool is identical - preferences must not remove anything.
  assert.equal(styled.assessments.length, neutral.assessments.length);
  assert.equal(styled.counts.excluded, neutral.counts.excluded);
  assert.equal(styled.counts.candidate, neutral.counts.candidate);

  // No plant's raw_i falls when a preference is added. (score_i is
  // normalised by raw_max, so it may legitimately drop as a new term turns
  // on; raw_i is where "never penalise" is checked.)
  const before = new Map(
    neutral.assessments.map((a) => [a.plantId, a.stage1?.raw ?? 0]),
  );
  for (const assessment of styled.assessments) {
    assert.ok(
      (assessment.stage1?.raw ?? 0) >= (before.get(assessment.plantId) ?? 0) - 1e-9,
      `${assessment.plantId} was pushed down by a soft preference`,
    );
  }

  // And the preference actually changed the ordering.
  assert.notDeepEqual(
    styled.assessments.slice(0, 10).map((a) => a.plantId),
    neutral.assessments.slice(0, 10).map((a) => a.plantId),
  );
});

test("a missing flower colour is neutral, never a mismatch", () => {
  const colourless = plants.find((plant) => hasUnknownColour(plant));
  assert.ok(colourless, "expected a plant with no recorded colour");
  const warm = pickedColours({ mode: "scheme", scheme: "warm" });
  // D25: colour_unknown_score from the rulebook (0.5).
  assert.equal(colourTerm(colourless, warm), 0.5);
  assert.equal(colourTerm(colourless, pickedColours({ mode: "none" })), 0);

  // colour_i = matches / colours picked.
  const multi = plants.find((plant) => (plant.flowerColour?.length ?? 0) > 1);
  assert.ok(multi);
  const [first, second] = multi.flowerColour!;
  assert.equal(colourTerm(multi, [first]), 1);
  assert.equal(colourTerm(multi, [first, second]), 1);
  const absent = ["Red", "Blue", "Black"].find((c) => !multi.flowerColour!.includes(c));
  assert.ok(absent);
  assert.equal(colourTerm(multi, [first, absent]), 0.5);
});

test("extras promote matching species and never penalise the untagged", () => {
  const none = buildGardenPlan(plants, completeBrief);
  const withExtras = buildGardenPlan(plants, {
    ...completeBrief,
    extras: ["fragrance", "wildlife"],
  });

  // Soft: the pool is untouched.
  assert.equal(withExtras.assessments.length, none.assessments.length);
  assert.equal(withExtras.counts.candidate, none.counts.candidate);

  // No plant is worse off than it was with no extras selected - including
  // the ~32% carrying no recorded features at all.
  const before = new Map(none.assessments.map((a) => [a.plantId, a.stage1?.raw ?? 0]));
  for (const assessment of withExtras.assessments) {
    assert.ok((assessment.stage1?.raw ?? 0) >= (before.get(assessment.plantId) ?? 0) - 1e-9);
  }

  const untagged = plants.find((plant) => !plant.specialFeatures);
  assert.ok(untagged, "expected a plant with no recorded features");
  assert.equal(extrasTerm(untagged, ["fragrance", "wildlife"]), 0);
});

test("extras read only their own special_features tags", () => {
  const fragrant = plants.find((plant) =>
    (plant.specialFeatures ?? []).includes("Fragrant"),
  );
  assert.ok(fragrant);
  assert.equal(matchesExtra(fragrant, "fragrance"), true);

  // A plant tagged only Fragrant must not satisfy privacy or wildlife.
  const onlyFragrant = plants.find(
    (plant) =>
      (plant.specialFeatures ?? []).includes("Fragrant") &&
      !(plant.specialFeatures ?? []).some((f) =>
        ["Hedge/screen", "Attracts birds", "Feeds honeybees", "Attracts butterflies"].includes(f),
      ),
  );
  assert.ok(onlyFragrant);
  assert.equal(matchesExtra(onlyFragrant, "privacy"), false);
  assert.equal(matchesExtra(onlyFragrant, "wildlife"), false);
});

test("extras_i is the fraction of picked extras a plant satisfies", () => {
  const screening = plants.find(
    (plant) =>
      matchesExtra(plant, "privacy") && !matchesExtra(plant, "fragrance"),
  );
  assert.ok(screening);
  assert.equal(extrasTerm(screening, ["privacy"]), 1);
  assert.equal(extrasTerm(screening, ["privacy", "fragrance"]), 0.5);
});

test("three results are distinct, reproducible, and vary on regenerate", () => {
  const ids = (plan: ReturnType<typeof buildGardenPlan>) =>
    (plan.quantities?.quantities ?? []).map((q) => q.id).join(",");

  const first = buildGardenPlanVariants(plants, completeBrief, {
    variationCounter: 0,
  });
  assert.equal(first.length, 3);

  // Distinct from one another, and each labelled with its character.
  const sets = first.map(ids);
  assert.equal(new Set(sets).size, 3, "the three results must differ");
  assert.deepEqual(
    first.map((plan) => plan.character),
    ["Option 1", "Option 2", "Option 3"],
  );
  // Ranked by Z, best first (owner decision: top 3 distinct by Z).
  const zs = first.map((plan) => plan.engine?.z ?? 0);
  assert.deepEqual(zs, [...zs].sort((left, right) => right - left));

  // Reproducible: same brief, same counter, same result.
  const again = buildGardenPlanVariants(plants, completeBrief, {
    variationCounter: 0,
  });
  assert.deepEqual(again.map(ids), sets);
  assert.deepEqual(
    again.map((plan) => plan.seed),
    first.map((plan) => plan.seed),
  );

  // Regenerate deliberately produces a different set.
  const regenerated = buildGardenPlanVariants(plants, completeBrief, {
    variationCounter: 1,
  });
  assert.notEqual(regenerated[0].seed, first[0].seed);
  assert.notDeepEqual(regenerated.map(ids), sets);
});

test("the seed covers the whole input vector", () => {
  const base = planSeed(completeBrief, [], 0);
  assert.notEqual(planSeed({ ...completeBrief, sun: "part" }, [], 0), base);
  assert.notEqual(planSeed({ ...completeBrief, style: "fynbos" }, [], 0), base);
  assert.notEqual(planSeed({ ...completeBrief, extras: ["fragrance"] }, [], 0), base);
  assert.notEqual(planSeed(completeBrief, ["B0001"], 0), base);
  assert.notEqual(planSeed(completeBrief, [], 1), base);
  // Order must not matter, or the same garden would hash two ways.
  assert.equal(
    planSeed({ ...completeBrief, extras: ["wildlife", "fragrance"] }, [], 0),
    planSeed({ ...completeBrief, extras: ["fragrance", "wildlife"] }, [], 0),
  );
});

test("a saved plant is nudged up but never past a hard constraint", () => {
  // Not merely the first feasible plant: one that is not already top of
  // the list, or "saving raises its rank" has nothing to prove.
  const baseline = buildGardenPlan(plants, completeBrief);
  const feasible = plants.find(
    (plant) =>
      survivesHardFilters(plant, completeBrief) &&
      plant.layoutEligible &&
      baseline.assessments.findIndex((a) => a.plantId === plant.id) > 0,
  );
  assert.ok(feasible);

  const without = baseline;
  const withSaved = buildGardenPlan(plants, completeBrief, {
    savedPlantIds: [feasible.id],
  });
  const rank = (plan: ReturnType<typeof buildGardenPlan>) =>
    plan.assessments.findIndex((a) => a.plantId === feasible.id);
  assert.ok(rank(withSaved) < rank(without), "saving must raise a plant's rank");

  // But a plant that fails a site constraint stays excluded however much
  // the user likes it.
  const infeasible = plants.find(
    (plant) => !survivesHardFilters(plant, completeBrief),
  );
  assert.ok(infeasible);
  const withInfeasible = buildGardenPlan(plants, completeBrief, {
    savedPlantIds: [infeasible.id],
  });
  assert.equal(
    withInfeasible.assessments.find((a) => a.plantId === infeasible.id)?.status,
    "excluded",
  );
});

test("favouriting a plant makes it more likely to reach the layout", () => {
  // Feasible for this brief, and small enough to fit a 2 x 3 m bed.
  const favourites = plants
    .filter(
      (plant) =>
        survivesHardFilters(plant, completeBrief) &&
        plant.layoutEligible &&
        (plant.spreadCm ?? 0) >= 20 &&
        (plant.spreadCm ?? 0) <= 90,
    )
    .slice(0, 3)
    .map((plant) => plant.id);
  assert.equal(favourites.length, 3);

  const included = (planSet: ReturnType<typeof buildGardenPlanVariants>) =>
    planSet.map(
      (plan) =>
        (plan.quantities?.quantities ?? []).filter((q) =>
          favourites.includes(q.id),
        ).length,
    );

  const without = included(
    buildGardenPlanVariants(plants, completeBrief, { variationCounter: 0 }),
  );
  const withFavourites = included(
    buildGardenPlanVariants(plants, completeBrief, {
      savedPlantIds: favourites,
      variationCounter: 0,
    }),
  );

  // Favouriting must actually change what ends up in the bed.
  assert.ok(
    withFavourites.some((count, index) => count > without[index]),
    "favourited plants should reach the layout more often than unfavourited ones",
  );
  // saved_i is a Stage 1 term (b_saved), not a guarantee: a favourite
  // still has to earn its place against Z and fit H1-H5.
});

const WIND_LEVELS = ["none", "protected", "affected"] as const;

test("wind never changes the candidate pool", () => {
  // Wind is algorithm-driven: it has no plant attribute and must never
  // filter. For a fixed location, sun, water and soil the pool is
  // identical at every wind level.
  const pools = WIND_LEVELS.map((wind) =>
    countSurvivingPlants(plants, { ...completeBrief, wind }),
  );
  assert.equal(new Set(pools).size, 1, `pool differed by wind: ${pools}`);

  // And nothing wind-related may appear in any feasibility trace.
  for (const wind of WIND_LEVELS) {
    const plan = buildGardenPlan(plants, { ...completeBrief, wind });
    const traced = plan.assessments
      .slice(0, 50)
      .flatMap((assessment) => assessment.feasibility.trace);
    assert.ok(
      !traced.some((entry) => /wind/i.test(entry.constraintId)),
      "a hard constraint referenced wind",
    );
  }
});

test("wind is not offered as a relaxation", () => {
  // Relaxation applies only to hard filters, and wind is not one.
  const restrictive = {
    ...completeBrief,
    soil: "clay" as const,
    sun: "sheltered" as const,
    water: "low" as const,
    wind: "affected" as const,
  };
  const outcome = evaluateHardFilters(plants, restrictive);
  assert.ok(
    !outcome.relaxations.some((option) => String(option.filter) === "wind"),
  );
  assert.ok(!outcome.restrictive.some((filter) => String(filter) === "wind"));
});

test("wind scores through Stage 1 only, and only for resilient forms", () => {
  const resilient = plants.find(
    (plant) => survivesHardFilters(plant, completeBrief) && isWindResilient(plant),
  );
  const exposed = plants.find(
    (plant) => survivesHardFilters(plant, completeBrief) && !isWindResilient(plant),
  );
  assert.ok(resilient && exposed);

  const windTerm = (plant: typeof resilient, wind: (typeof WIND_LEVELS)[number]) =>
    scorePlantStage1(plant, { brief: { ...completeBrief, wind }, savedPlantIds: [] })
      .terms.wind;
  assert.equal(windTerm(resilient, "none").active, false);
  assert.equal(windTerm(resilient, "protected").contribution, 0.637 * 0.5);
  assert.equal(windTerm(resilient, "affected").contribution, 0.637);
  for (const wind of WIND_LEVELS) {
    assert.equal(windTerm(exposed, wind).contribution, 0);
  }
});

test("a shrub with no recorded height is not assumed to be low", () => {
  const unknownShrub = { ...plants[0], plantType: ["shrub"], heightCm: null, specialFeatures: null };
  assert.equal(isWindResilient(unknownShrub), false);
  assert.equal(isWindResilient({ ...unknownShrub, heightCm: 60 }), true);
  assert.equal(isWindResilient({ ...unknownShrub, heightCm: 180 }), false);
});

test("wind is part of the seed and survives a save/reopen round trip", () => {
  // Distinct seeds mean a saved layout reopens with the wind it was made
  // with, rather than silently becoming a different garden.
  const seeds = WIND_LEVELS.map((wind) =>
    planSeed({ ...completeBrief, wind }, [], 0),
  );
  assert.equal(new Set(seeds).size, WIND_LEVELS.length, "wind must reach the seed");

  // parseGardenBrief is what restores a saved layout's brief.
  for (const wind of WIND_LEVELS) {
    const restored = parseGardenBrief(
      JSON.parse(JSON.stringify({ ...completeBrief, wind })),
    );
    assert.ok(restored, `${wind} brief should round-trip`);
    assert.equal(restored.wind, wind);
  }
  // An unrecognised wind value is rejected rather than silently defaulted.
  assert.equal(parseGardenBrief({ ...completeBrief, wind: "gale" }), null);
});

test("pollinators and wildlife read disjoint tags", () => {
  // Insects belong to pollinators, birds to wildlife. Any overlap would
  // score one plant twice when both preferences are selected.
  const beeOnly = plants.find(
    (plant) =>
      (plant.specialFeatures ?? []).includes("Feeds honeybees") &&
      !(plant.specialFeatures ?? []).includes("Attracts birds"),
  );
  assert.ok(beeOnly, "expected a bee plant that does not attract birds");
  assert.equal(matchesExtra(beeOnly, "pollinators"), true);
  assert.equal(matchesExtra(beeOnly, "wildlife"), false);

  const birdOnly = plants.find(
    (plant) =>
      (plant.specialFeatures ?? []).includes("Attracts birds") &&
      !(plant.specialFeatures ?? []).includes("Feeds honeybees") &&
      !(plant.specialFeatures ?? []).includes("Attracts butterflies"),
  );
  assert.ok(birdOnly, "expected a bird plant that is not also a pollinator plant");
  assert.equal(matchesExtra(birdOnly, "wildlife"), true);
  assert.equal(matchesExtra(birdOnly, "pollinators"), false);

  // Butterflies count as pollinators, not wildlife.
  const butterflyOnly = plants.find(
    (plant) =>
      (plant.specialFeatures ?? []).includes("Attracts butterflies") &&
      !(plant.specialFeatures ?? []).includes("Attracts birds"),
  );
  assert.ok(butterflyOnly);
  assert.equal(matchesExtra(butterflyOnly, "pollinators"), true);
  assert.equal(matchesExtra(butterflyOnly, "wildlife"), false);
});

test("relaxation costs come from the survey weights, cheapest first", () => {
  // Table 3.3 of the report: sunlight 0.257, water 0.199, soil 0.174,
  // renormalised over these three filters (sum 0.630). If someone changes
  // a cost, this says where the number is supposed to come from.
  const survey = { sun: 0.257, water: 0.199, soil: 0.174 } as const;
  const total = survey.sun + survey.water + survey.soil;
  for (const [filter, weight] of Object.entries(survey) as [RelaxableFilter, number][]) {
    assert.ok(
      Math.abs(RELAXATION_COSTS[filter] - weight / total) < 5e-4,
      `${filter}: ${RELAXATION_COSTS[filter]} is not the survey weight ${weight} renormalised (${(weight / total).toFixed(4)})`,
    );
  }

  // The costs are a normalised weight vector.
  const sum = Object.values(RELAXATION_COSTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `costs should sum to 1, got ${sum}`);

  // What actually drives behaviour is the ordering, which the survey's
  // importance ranking reproduces: soil is cheapest to widen, light dearest.
  assert.deepEqual(RELAXATION_ORDER, ["soil", "water", "sun"]);
});

test("every recommended species passes every Stage 0 gate", () => {
  // T2 (Chapter 5): the permanent version of the exclusion trace. A plant
  // that reaches a plan must be layout-eligible, not parasitic, not
  // aquatic, have complete light/water/soil, share a biome with the place
  // and pass the site filters. Any failure here means Stage 0 leaked.
  const briefs: GardenBrief[] = [
    completeBrief,
    { ...completeBrief, sun: "part", water: "low", soil: "clay" },
    { ...completeBrief, sun: "sheltered", water: "moist", soil: "loam", bedWidthM: 10, bedLengthM: 6 },
  ];
  let checked = 0;
  for (const brief of briefs) {
    const plan = buildGardenPlan(plants, brief);
    if (plan.status !== "provisional-plan") continue;
    const byId = new Map(plants.map((plant) => [plant.id, plant]));
    for (const quantity of plan.quantities?.quantities ?? []) {
      const plant = byId.get(quantity.id);
      assert.ok(plant, `${quantity.id} is not in the catalogue`);
      checked += 1;
      assert.ok(plant.layoutEligible, `${plant.id} is not layout-eligible`);
      const types = plant.plantType ?? [];
      assert.ok(!types.includes("parasitic"), `${plant.id} is parasitic`);
      assert.ok(!types.includes("aquatic"), `${plant.id} is aquatic`);
      assert.ok(plant.sun && plant.water && plant.soilType, `${plant.id} has incomplete data`);
      assert.ok(
        (plant.biome ?? []).some((biome) => brief.biomes.includes(biome)),
        `${plant.id} shares no biome with the place`,
      );
      assert.ok(survivesHardFilters(plant, brief), `${plant.id} fails a site filter`);
    }
  }
  assert.ok(checked > 0, "expected at least one plan to check");
});

// ---------------------------------------------------------------------------
// Saved-garden labels (2026-10-11)
//
// A gardener can name a saved garden. The field is new, so the thing worth
// pinning is backward compatibility: every garden saved before today has no
// `label` and must still load.
// ---------------------------------------------------------------------------

test("saved gardens keep a label, and older saves without one still load", () => {
  const base = {
    createdAt: "2026-10-11T00:00:00.000Z",
    brief: completeBrief,
    species: [{ plantId: "B0001", quantity: 3 }],
  };

  const older = parseSavedLayout({ ...base, id: "layout-1", character: "Option 2" });
  assert.ok(older, "a garden saved before labels existed must still load");
  assert.equal(older.label, null, "no label reads as unlabelled, not as a blank name");
  assert.equal(older.character, "Option 2", "and it keeps the name it always showed");

  const named = parseSavedLayout({
    ...base,
    id: "layout-2",
    character: "Option 1",
    label: "Front bed by the gate",
  });
  assert.equal(named?.label, "Front bed by the gate");

  // Whitespace is not a name: it clears back to the default rather than
  // leaving a garden with a blank title in the list.
  const blank = parseSavedLayout({ ...base, id: "layout-3", character: "Option 3", label: "   " });
  assert.equal(blank?.label, null);

  // A non-string label is ignored rather than crashing the whole store.
  const junk = parseSavedLayout({ ...base, id: "layout-4", character: "Option 1", label: 42 });
  assert.equal(junk?.label, null);
});
