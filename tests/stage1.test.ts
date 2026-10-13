import assert from "node:assert/strict";
import test from "node:test";

import { plants, type Plant } from "../app/data/plants.ts";
import {
  buildGardenPlan,
  countSurvivingPlants,
  evaluateHardFilters,
  scorePlantStage1,
  scorePoolStage1,
  stage1RawMax,
  survivesHardFilters,
  STAGE1_WEIGHTS,
  type GardenBrief,
} from "../app/lib/planning/index.ts";

/** Stage 1 - the plant score. These are the seven acceptance tests the
 * owner specified; every one must pass. */

const WIND_LEVELS = ["none", "protected", "affected"] as const;

const baseBrief: GardenBrief = {
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

/** A real catalogue record with the Stage 1 fields overridden, so the
 * arithmetic is fixed by the test rather than by whatever the data holds. */
function plantWith(overrides: Partial<Plant>): Plant {
  return { ...plants[0], id: "TEST-PLANT", ...overrides };
}

const close = (actual: number, expected: number, places = 4) =>
  assert.ok(
    Math.abs(actual - expected) < 0.5 * 10 ** -places,
    `expected ${expected}, got ${actual}`,
  );

test("1. the worked example: raw_max 1.4235, raw 1.1545, score 0.811", () => {
  // Style Fynbos (fits), 3 colours picked (2 match), 2 extras picked
  // (1 matches), the user has saved plants but not this one, and the bed
  // is protected from wind (W_site 0.5) with a wind-resilient plant.
  const brief: GardenBrief = {
    ...baseBrief,
    style: "fynbos",
    colour: { mode: "custom", colours: ["Red", "Yellow", "Blue"] },
    extras: ["fragrance", "wildlife"],
    wind: "protected",
  };
  const plant = plantWith({
    biome: ["Fynbos"],
    plantType: ["restio"],
    flowerColour: ["Red", "Yellow"],
    specialFeatures: ["Fragrant"],
  });
  const result = scorePlantStage1(plant, {
    brief,
    savedPlantIds: ["SOME-OTHER-PLANT"],
  });

  close(result.rawMax, 1.4235);
  close(result.raw, 1.1545);
  close(result.score, 0.811, 3);

  // And the breakdown adds up term by term.
  close(result.terms.style.contribution, 0.637);
  close(result.terms.colour.contribution, 0.105 * (2 / 3));
  close(result.terms.extras.contribution, 0.129);
  close(result.terms.saved.contribution, 0);
  close(result.terms.wind.contribution, 0.3185);
  assert.equal(result.terms.wind.siteFactor, 0.5);
});

test("2. a plant matching every active term scores exactly 1", () => {
  const brief: GardenBrief = {
    ...baseBrief,
    style: "fynbos",
    colour: { mode: "custom", colours: ["Red", "Yellow"] },
    extras: ["fragrance", "wildlife"],
    wind: "affected",
  };
  const plant = plantWith({
    biome: ["Fynbos"],
    plantType: ["ground cover"],
    flowerColour: ["Red", "Yellow"],
    specialFeatures: ["Fragrant", "Attracts birds"],
  });
  const result = scorePlantStage1(plant, {
    brief,
    savedPlantIds: [plant.id],
  });
  assert.equal(result.score, 1);
  close(result.raw, result.rawMax);
});

test("3. inactive inputs add nothing to raw_max", () => {
  // Style chosen; no colour, no extras, wind none.
  const brief: GardenBrief = { ...baseBrief, style: "fynbos" };
  close(stage1RawMax({ brief, savedPlantIds: [] }), 0.637);
  close(stage1RawMax({ brief, savedPlantIds: ["B0001"] }), 0.637 + 0.105);

  // The inactive terms report zero contribution for every plant.
  for (const plant of plants.slice(0, 200)) {
    const { terms } = scorePlantStage1(plant, { brief, savedPlantIds: [] });
    assert.equal(terms.colour.contribution, 0);
    assert.equal(terms.extras.contribution, 0);
    assert.equal(terms.saved.contribution, 0);
    assert.equal(terms.wind.contribution, 0);
  }
});

test("4. nothing chosen: raw_max 0 and every score 0, no crash", () => {
  const inputs = { brief: baseBrief, savedPlantIds: [] };
  assert.equal(stage1RawMax(inputs), 0);
  for (const result of scorePoolStage1(plants, inputs)) {
    assert.equal(result.rawMax, 0);
    assert.equal(result.score, 0);
    assert.ok(Number.isFinite(result.score));
  }
  // The whole engine still runs end to end.
  const plan = buildGardenPlan(plants, baseBrief);
  assert.ok(plan.assessments.length > 0);
});

test("5. the candidate pool is unchanged for any wind value", () => {
  const survivorsFor = (wind: (typeof WIND_LEVELS)[number]) =>
    plants
      .filter((plant) => survivesHardFilters(plant, { ...baseBrief, wind }))
      .map((plant) => plant.id)
      .join(",");
  const pools = WIND_LEVELS.map(survivorsFor);
  assert.equal(new Set(pools).size, 1, "wind changed the Stage 0 pool");

  const counts = WIND_LEVELS.map((wind) =>
    countSurvivingPlants(plants, { ...baseBrief, wind }),
  );
  assert.equal(new Set(counts).size, 1);

  // Relaxation never offers wind.
  const outcome = evaluateHardFilters(plants, {
    ...baseBrief,
    wind: "affected",
  });
  assert.ok(!outcome.relaxations.some((o) => String(o.filter) === "wind"));

  // Stage 1 returns exactly one score per pooled plant at every wind level.
  const pool = plants.filter((plant) => survivesHardFilters(plant, baseBrief));
  for (const wind of WIND_LEVELS) {
    const scored = scorePoolStage1(pool, {
      brief: { ...baseBrief, wind },
      savedPlantIds: [],
    });
    assert.deepEqual(
      scored.map((s) => s.plantId),
      pool.map((p) => p.id),
    );
  }

  // Plan statuses (candidate / review / excluded) are identical too.
  const statuses = WIND_LEVELS.map((wind) =>
    buildGardenPlan(plants, { ...baseBrief, wind })
      .assessments.map((a) => `${a.plantId}:${a.status}`)
      .sort()
      .join(","),
  );
  assert.equal(new Set(statuses).size, 1);
});

test("6. every plant in the dataset scores within [0, 1]", () => {
  const briefs: GardenBrief[] = [
    baseBrief,
    { ...baseBrief, style: "mediterranean" },
    { ...baseBrief, style: "cottage", colour: { mode: "scheme", scheme: "warm" } },
    {
      ...baseBrief,
      style: "fynbos",
      colour: { mode: "scheme", scheme: "neutral" },
      extras: ["low-maintenance", "privacy", "pollinators", "fragrance", "wildlife"],
      wind: "affected",
    },
    { ...baseBrief, colour: { mode: "custom", colours: ["Pink"] }, wind: "protected" },
  ];
  for (const brief of briefs) {
    for (const savedPlantIds of [[], [plants[0].id, plants[1].id]]) {
      for (const result of scorePoolStage1(plants, { brief, savedPlantIds })) {
        assert.ok(
          result.score >= 0 && result.score <= 1,
          `${result.plantId} scored ${result.score}`,
        );
        assert.ok(result.raw >= 0 && result.raw <= result.rawMax + 1e-12);
        for (const term of Object.values(result.terms)) {
          assert.ok(term.value >= 0 && term.value <= 1);
          assert.ok(term.contribution >= 0, "no term may be negative");
        }
      }
    }
  }
});

test("7. blank colour and blank special_features score 0, never an error", () => {
  const brief: GardenBrief = {
    ...baseBrief,
    colour: { mode: "scheme", scheme: "warm" },
    extras: ["fragrance", "privacy"],
  };
  for (const blank of [null, []]) {
    const plant = plantWith({ flowerColour: blank, specialFeatures: blank });
    const result = scorePlantStage1(plant, { brief, savedPlantIds: [] });
    assert.equal(result.terms.colour.value, 0);
    assert.equal(result.terms.extras.value, 0);
    assert.equal(result.score, 0);
  }

  // And real catalogue records with blanks behave the same.
  const noColour = plants.find((p) => !p.flowerColour?.length);
  const noFeatures = plants.find((p) => !p.specialFeatures?.length);
  assert.ok(noColour && noFeatures);
  assert.equal(
    scorePlantStage1(noColour, { brief, savedPlantIds: [] }).terms.colour.value,
    0,
  );
  assert.equal(
    scorePlantStage1(noFeatures, { brief, savedPlantIds: [] }).terms.extras.value,
    0,
  );
});

test("saved plants and wind cannot bring back a plant Stage 0 removed", () => {
  const removed = plants.find(
    (plant) =>
      !survivesHardFilters(plant, baseBrief) &&
      (plant.plantType ?? []).includes("ground cover"),
  );
  assert.ok(removed, "expected a wind-resilient plant that fails a filter");
  const plan = buildGardenPlan(
    plants,
    { ...baseBrief, wind: "affected" },
    { savedPlantIds: [removed.id] },
  );
  const assessment = plan.assessments.find((a) => a.plantId === removed.id);
  assert.equal(assessment?.status, "excluded");
  assert.equal(assessment?.stage1, null, "a removed plant is never scored");
  assert.equal(assessment?.suitability, 0);
});

test("every Stage 1 weight comes from the single config", () => {
  // Read from Algorithm_rulebook.xlsx (1_Parameters) via the generated
  // rules file - these are the rulebook's values, not typed-in copies.
  assert.deepEqual(STAGE1_WEIGHTS, {
    style: 0.637,
    colour: 0.105,
    extras: 0.258,
    saved: 0.105,
    wind: 0.637,
  });
  // No shade weight: b_shade was removed (Step 3a, 13 Oct 2026); the shade
  // bonus is future work.
});
