import assert from "node:assert/strict";
import test from "node:test";

import { plants, type Plant } from "../app/data/plants.ts";
import {
  bandFor,
  bedScaledGroupSizes,
  c1Thresholds,
  exceedsFootprintCap,
  footprintCapM2,
  footprintCapSpreadM,
  SMALL_GROUP_MAX,
  SMALL_SPREAD_MAX_CM,
  areaBandIndex,
  MIN_GROUPED_SHARE,
  SINGLETON_K_BY_BAND,
  buildGardenPlan,
  buildGardenPlanVariants,
  computeHeightTiers,
  computeSpreadBands,
  createRng,
  engineSite,
  evaluateSelection,
  F4_NEMBA_SPECIES,
  isFeaturePlant,
  minCentreDistance,
  onExclusionList,
  onFeatureList,
  P2_OVERLAP_TOLERANCE,
  PLACEMENT,
  SHADE_ENABLED,
  placeSelection,
  RULES,
  runEngine,
  scorePlantStage1,
  speciesInfo,
  spreadBandOf,
  stage1RawMax,
  stateFrom,
  survivesHardFilters,
  targetDepth,
  depthAxisFor,
  viewingAxis,
  windProfile,
  type EngineSite,
  type GardenBrief,
  type SpeciesInfo,
} from "../app/lib/planning/index.ts";

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

const close = (actual: number, expected: number, tolerance = 5e-4) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, got ${actual}`);

// ---------------------------------------------------------------------------
// The rulebook is the source of the numbers
// ---------------------------------------------------------------------------

test("engine numbers are read from the rulebook", () => {
  assert.equal(RULES.source, "Algorithm_rulebook.xlsx");
  assert.equal(RULES.stage2.lambda, 0.5);
  assert.deepEqual(RULES.stage2.goalWeights, [0.2, 0.2, 0.2, 0.2, 0.2]);
  assert.deepEqual(RULES.stage2.speciesBands.map((b) => [b.sMin, b.sMax]), [[3, 6], [5, 12], [10, 20]]);
  assert.equal(RULES.stage3.alpha, 0.95);
  assert.equal(RULES.stage3.iterations, 2000);
  // cover_min 0.90 for every style (owner, 13 Oct 2026, rulebook 6f37affddbc2;
  // was 0.85 for cottage). cover_max is 1.0 for every style.
  assert.equal(RULES.styles.cottage.coverMin, 0.9);
  assert.equal(RULES.styles.cottage.coverMax, 1);
  assert.equal(RULES.styles.fynbos.structMin, 1);
  assert.equal(RULES.styles.cottage.structMin, 0);
});

test("P30 and P60 are recalculated from the data, matching the rulebook log", () => {
  // 3_Height_Tiers logs P30 = 50 cm and P60 = 100 cm for n = 2,843.
  const tiers = computeHeightTiers(plants);
  assert.equal(tiers.n, 2843);
  assert.equal(tiers.p30, 50);
  assert.equal(tiers.p60, 100);
  // Spread bands (owner decision: dataset terciles) are recalculated too.
  const bands = computeSpreadBands(plants);
  assert.ok(bands.p33 > 0 && bands.p33 < bands.p67);
});

test("bed-area bands follow 1_Parameters band boundaries", () => {
  assert.deepEqual(bandFor(9.99), { maxAreaM2: 10, sMin: 3, sMax: 6 });
  assert.deepEqual(bandFor(10), { maxAreaM2: 50, sMin: 5, sMax: 12 });
  assert.deepEqual(bandFor(50), { maxAreaM2: 50, sMin: 5, sMax: 12 });
  assert.deepEqual(bandFor(50.1), { maxAreaM2: 900, sMin: 10, sMax: 20 });
});

// ---------------------------------------------------------------------------
// 9_Hand_Check reproduced: Z = 0.770
// ---------------------------------------------------------------------------

test("the rulebook hand check, re-run with the current rulebook values, and all five hard constraints pass", () => {
  // 10_Open_Items row 65: the hand check must be re-run because G3 moved
  // from two halves to three thirds (and k_headroom from 1.5 to 2.0).
  // The old Z of 0.770 used A3 = 1.000; with thirds A3 = 1/3 + 1/3 +
  // 1/3 x (2 distinct non-feature sizes / D_min_effective 3) = 0.889.
  // 9_Hand_Check test bed: 6 x 4 m, Mediterranean, protected from wind,
  // user colours red, yellow, white, blue. Species, n_i and score_i are the
  // hand check's own values.
  const info = (
    id: string,
    type: string,
    heightCm: number,
    spreadCm: number,
    colour: string,
    season: "spring" | "summer" | "autumn" | "winter",
    score: number,
    feature: boolean,
    layer: SpeciesInfo["layer"],
  ): SpeciesInfo => ({
    id,
    score,
    diameterM: spreadCm / 100,
    areaM2: Math.PI * (spreadCm / 200) ** 2,
    heightCm,
    tier: heightCm >= 100 ? "tall" : heightCm >= 50 ? "medium" : "short",
    layer,
    types: [type],
    colours: [colour],
    seasons: [season],
    feature,
    allowedN: feature ? [1, 3, 5, 7] : [3, 5, 7],
    windres: false,
    shade: false,
    hedge: false,
    genus: id.split(" ")[0],
  });
  const species = [
    info("Coleonema album", "shrub", 200, 100, "White", "spring", 0.64717246224095537, false, "L1"),
    info("Carpobrotus edulis", "ground cover", 20, 100, "Yellow", "spring", 0.85405690200210738, false, "L6"),
    info("Crassula coccinea", "succulent", 40, 40, "Red", "winter", 0.55655075518089214, false, "L6"),
    info("Olea exasperata", "tree", 700, 200, "Cream", "summer", 0.67123287671232879, true, "L1"),
    info("Eriocephalus racemosus", "shrub", 150, 100, "White", "autumn", 0.55655075518089214, false, "L1"),
  ];
  const n = [3, 5, 5, 1, 3];
  const site: EngineSite = {
    widthM: 6,
    depthM: 4,
    areaM2: 24,
    style: RULES.styles.mediterranean,
    ...bandFor(24),
    userColours: ["Red", "Yellow", "White", "Blue"],
    windSite: 0.5,
    rowsAvailable: 3,
    windbreakRequired: false,
  };
  const infos = new Map(species.map((s) => [s.id, s]));
  const selection = new Map(species.map((s, index) => [s.id, n[index]]));
  const result = evaluateSelection(stateFrom(selection, infos, site));

  assert.equal(result.totalPlants, 17);
  close(result.plantedAreaM2, 12.409290981679682, 1e-9);
  close(result.rMaxEffective, 0.4, 1e-12); // MAX(0.20, k_headroom 2.0 / 5)
  close(result.goals.A1, 0.61176470588235299, 1e-9);
  close(result.goals.A2, 0.75, 1e-12);
  close(result.goals.A3, 8 / 9, 1e-12);
  // A4 = MIN(1, planted / (cover_min x W x L)) with the rulebook's CURRENT
  // Mediterranean cover_min (0.5 when the hand check was written -> 1.000;
  // raised to 0.6 on 2026-09-22 -> 12.41 / 14.4 = 0.862).
  const a4 = Math.min(1, 12.409290981679682 / (RULES.styles.mediterranean.coverMin * 24));
  close(result.goals.A4, a4, 1e-12);
  close(result.goals.A5, 1, 1e-12);
  close(result.sBar, 0.66679063617016876, 1e-9);
  close(
    result.z,
    0.5 * 0.66679063617016876 + 0.5 * 0.2 * (0.61176470588235299 + 0.75 + 8 / 9 + a4 + 1),
    1e-9,
  ); // 0.758 at cover_min 0.5; 0.745 at 0.6
  for (const check of result.hard) assert.ok(check.pass, `${check.id} failed: ${check.detail}`);
  // H5: the largest capped share is 5/17 = 0.294 against the 0.300 cap.
  close(result.hard.find((h) => h.id === "H5")!.value, 5 / 17, 1e-12);
});

test("G3 in thirds: two types, no structure, no size choice scores 0.556", () => {
  // 9_Hand_Check A77's weaker bed, under the test-run-1 G3: (1/3)(2/3) for
  // type variety + 0 for structure + (1/3)(1) for size variety (both
  // species may only use groups of 3, so D_min_effective = 1 and variety
  // is not asked for).
  const make = (id: string, type: string): SpeciesInfo => ({
    id, score: 0.5, diameterM: 0.3, areaM2: Math.PI * 0.15 ** 2, heightCm: 30,
    tier: "short", layer: "L6", types: [type], colours: [], seasons: [],
    feature: false, allowedN: [3], windres: false, shade: false, hedge: false, genus: id,
  });
  const species = [make("a", "ground cover"), make("b", "succulent")];
  const site = engineSite({ ...baseBrief, style: "mediterranean", bedWidthM: 6, bedLengthM: 4 });
  const state = stateFrom(new Map([["a", 3], ["b", 3]]), new Map(species.map((s) => [s.id, s])), site);
  close(state.goals().A3, 5 / 9, 1e-12);
});

test("shade is switched off: the hand check keeps raw_max 1.4235 and score 0.811", () => {
  // TR1-4: shade_enabled = false. On the hand-check bed (6 x 4 m, 3 rows,
  // a style with struct_min 1) the rulebook's shade condition would hold,
  // yet raw_max must stay 1.4235 and the worked-example plant 0.811.
  assert.equal(SHADE_ENABLED, false);
  const brief: GardenBrief = {
    ...baseBrief,
    style: "fynbos",
    colour: { mode: "custom", colours: ["Red", "Yellow", "Blue"] },
    extras: ["fragrance", "wildlife"],
    wind: "protected",
    bedWidthM: 6,
    bedLengthM: 4,
  };
  const plant: Plant = {
    ...plants[0],
    id: "WORKED",
    biome: ["Fynbos"],
    plantType: ["restio"],
    flowerColour: ["Red", "Yellow"],
    specialFeatures: ["Fragrant"],
    sun: ["part"],
  };
  const result = scorePlantStage1(plant, { brief, savedPlantIds: ["X"] });
  close(stage1RawMax({ brief, savedPlantIds: ["X"] }), 1.4235, 1e-9);
  close(result.rawMax, 1.4235, 1e-9);
  close(result.raw, 1.1545, 1e-9);
  close(result.score, 0.811, 5e-4);
  assert.equal(result.terms.shade.active, false);
  assert.equal(result.terms.shade.contribution, 0);
});

// ---------------------------------------------------------------------------
// Stage 0 additions
// ---------------------------------------------------------------------------

test("F4: the invasive list is loaded and every plant is checked against it", () => {
  // The list is real, not a stub. If this drops to zero the check is dead.
  assert.ok(F4_NEMBA_SPECIES.length > 1000, `only ${F4_NEMBA_SPECIES.length} species loaded`);
  assert.ok(F4_NEMBA_SPECIES.includes("Acacia saligna"));

  // The matcher excludes a listed name and its subspecies, but not a
  // different species whose name merely starts the same way.
  assert.equal(onExclusionList("Acacia saligna", ["Acacia saligna"]), true);
  assert.equal(onExclusionList("Acacia saligna subsp. lindleyi", ["Acacia saligna"]), true);
  assert.equal(onExclusionList("Acacia salignaX", ["Acacia saligna"]), false);

  // Every plant is traced through the constraint...
  const plan = buildGardenPlan(plants, baseBrief);
  assert.ok(plan.assessments[0].feasibility.trace.some((t) => t.constraintId === "not-invasive"));

  // ...and a listed species put through the engine is failed by it.
  const invasive: Plant = { ...plants[0], id: "test-invasive", scientificName: "Acacia saligna" };
  const traced = buildGardenPlan([invasive, ...plants], baseBrief).assessments.find(
    (a) => a.plantId === "test-invasive",
  );
  const f4 = traced?.feasibility.trace.find((t) => t.constraintId === "not-invasive");
  assert.equal(f4?.status, "fail");
  assert.equal(traced?.feasibility.feasible, false);
});

test("F4: no plant in the shipped catalogue is on the invasive list", () => {
  // The catalogue's invasive species were removed upstream, in a pipeline
  // that is retired and no longer runs. This is the check that the removal
  // held - a failure means an invasive species can be recommended.
  const listed = plants.filter((plant) =>
    onExclusionList(plant.scientificName, F4_NEMBA_SPECIES),
  );
  assert.deepEqual(
    listed.map((plant) => plant.scientificName),
    [],
    "invasive species present in the catalogue",
  );
});

test("feature plant = on the list AND over the rulebook's size threshold", () => {
  // Thresholds come from RULES so a rulebook change updates the test
  // instead of breaking it (they moved 150/100 -> 300/200 on 2026-09-30).
  const { minHeightCm, minSpreadCm } = RULES.stage2.featureThreshold;
  const base = { ...plants[0], family: "Proteaceae" };
  const kingProtea = { ...base, scientificName: "Protea cynaroides" };
  // Listed and big enough: a feature.
  assert.equal(isFeaturePlant({ ...kingProtea, heightCm: minHeightCm + 10, spreadCm: minSpreadCm - 20 }), true);
  assert.equal(isFeaturePlant({ ...kingProtea, heightCm: minHeightCm - 60, spreadCm: minSpreadCm + 20 }), true);
  // Listed but exactly at the threshold: not a feature (strictly greater).
  assert.equal(isFeaturePlant({ ...kingProtea, heightCm: minHeightCm, spreadCm: minSpreadCm }), false);
  // Big but not listed: not a feature - and the Proteaceae family rule is gone.
  const otherProtea = { ...base, scientificName: "Leucospermum cordifolium", heightCm: minHeightCm + 50, spreadCm: minSpreadCm + 50 };
  assert.equal(onFeatureList(otherProtea), false);
  assert.equal(isFeaturePlant(otherProtea), false);
  // The two removed species no longer qualify.
  for (const name of ["Podocarpus falcatus", "Cyathea dregei"]) {
    assert.equal(onFeatureList({ ...base, scientificName: name }), false);
  }
});

test("F9: parasitic plants never reach the pool", () => {
  const parasitic = plants.filter((p) => (p.plantType ?? []).includes("parasitic"));
  assert.ok(parasitic.length > 0);
  for (const plant of parasitic) {
    assert.equal(survivesHardFilters(plant, baseBrief), false);
  }
});

test("F5 never uses wind, and wind never filters", () => {
  const rose: Plant = { ...plants[0], scientificName: "Rosa banksiae", water: "low" };
  // Excluded on a low-water site...
  assert.equal(survivesHardFilters(rose, { ...baseBrief, water: "low" }), false);
  // ...and the wind answer makes no difference either way.
  for (const wind of ["none", "protected", "affected"] as const) {
    assert.equal(survivesHardFilters(rose, { ...baseBrief, water: "low", wind }), false);
    assert.equal(
      survivesHardFilters(plants[0], { ...baseBrief, wind }),
      survivesHardFilters(plants[0], baseBrief),
    );
  }
});

// ---------------------------------------------------------------------------
// Stage 4 profile (Option C + owner's no-wind decision)
// ---------------------------------------------------------------------------

test("wind profile follows Option C, with L1 at the back when there is no wind", () => {
  assert.equal(windProfile({ widthM: 4, depthM: 4, windSite: 0, rowsAvailable: 3 }), "standard");
  assert.equal(windProfile({ widthM: 4, depthM: 4, windSite: 0.5, rowsAvailable: 3 }), "ramp");
  assert.equal(windProfile({ widthM: 4, depthM: 2, windSite: 1, rowsAvailable: 1 }), "windbreak");
  assert.equal(targetDepth("L1", "standard"), 0.8);
  assert.equal(targetDepth("L1", "windbreak"), 0.8);
  assert.equal(targetDepth("L1", "ramp"), 0);
  assert.equal(targetDepth("L6", "ramp"), 0.8); // depth column inverts
  assert.equal(targetDepth("L3", "standard"), null);
});

test("P2 allows delta of the SMALLER radius, not of the combined radii", () => {
  // Rulebook 6_Stage3_4_Rules C15:D15, revised 2026-10-05:
  // d_ij >= r_i + r_j - delta * MIN(r_i, r_j).
  assert.equal(P2_OVERLAP_TOLERANCE, 0.15);

  // Equal plants: the allowance is 15% of one radius, not of both.
  close(minCentreDistance(0.5, 0.5), 1 - 0.15 * 0.5, 1e-12);

  // Unequal plants: the big neighbour no longer buys the small one a large
  // absolute overlap. Under the old rule this was 0.85 x 1.2 = 1.020 m,
  // costing the 0.2 m plant 0.180 m - most of its radius.
  close(minCentreDistance(1, 0.2), 1.2 - 0.15 * 0.2, 1e-12);
  assert.ok(
    minCentreDistance(1, 0.2) > 0.85 * 1.2,
    "the revised rule must be stricter than the one it replaced",
  );

  // The rulebook states the same test as a ratio; it must agree exactly.
  for (const [ri, rj] of [[0.5, 0.5], [1, 0.2], [0.3, 1.4], [0.05, 0.05]]) {
    const overlap = ri + rj - minCentreDistance(ri, rj);
    close(overlap / Math.min(ri, rj), P2_OVERLAP_TOLERANCE, 1e-12);
  }
});

// ---------------------------------------------------------------------------
// Whole engine over a batch of briefs
// ---------------------------------------------------------------------------

const batch: GardenBrief[] = [
  baseBrief,
  { ...baseBrief, bedWidthM: 6, bedLengthM: 4, style: "mediterranean", wind: "protected", colour: { mode: "scheme", scheme: "warm" } },
  { ...baseBrief, bedWidthM: 2, bedLengthM: 2, wind: "affected" },
  { ...baseBrief, bedWidthM: 20, bedLengthM: 10, style: "fynbos" },
  { ...baseBrief, bedWidthM: 5, bedLengthM: 3, style: "cottage", extras: ["pollinators"] },
  { ...baseBrief, bedWidthM: 8, bedLengthM: 6, sun: "part", water: "moist", soil: "loam", wind: "affected" },
];

test("every delivered plan satisfies H1-H5 and P1-P2, with sizes from H3", () => {
  for (const brief of batch) {
    const plan = buildGardenPlan(plants, brief);
    assert.equal(plan.status, "provisional-plan", `no plan for ${brief.bedWidthM}x${brief.bedLengthM} ${brief.style}`);
    const engine = plan.engine!;
    for (const check of engine.hard) {
      assert.ok(check.pass, `${check.id} failed: ${check.detail}`);
    }
    for (const check of engine.placementChecks.filter((c) => c.kind === "hard")) {
      assert.ok(check.pass, `${check.id} failed: ${check.detail}`);
    }
    assert.ok(engine.z >= 0 && engine.z <= 1 + 1e-9);
    // Every placed plant is fully inside the bed and none overlap.
    const placements = plan.layout!.placements;
    for (const p of placements) {
      assert.ok(p.xM >= p.radiusM - 1e-6 && p.xM <= brief.bedWidthM - p.radiusM + 1e-6);
      assert.ok(p.yM >= p.radiusM - 1e-6 && p.yM <= brief.bedLengthM - p.radiusM + 1e-6);
    }
    for (let i = 0; i < placements.length; i += 1) {
      for (let j = i + 1; j < placements.length; j += 1) {
        const a = placements[i];
        const b = placements[j];
        assert.ok(Math.hypot(a.xM - b.xM, a.yM - b.yM) >= minCentreDistance(a.radiusM, b.radiusM) - 1e-6);
      }
    }
    // Placement matches the chosen quantities exactly.
    assert.equal(placements.length, plan.quantities!.totalPlants);
  }
});

test("the same inputs reproduce the same garden, and regenerate changes it", () => {
  const brief = batch[1];
  const once = buildGardenPlan(plants, brief);
  const again = buildGardenPlan(plants, brief);
  assert.deepEqual(once.layout?.placements, again.layout?.placements);
  const other = buildGardenPlanVariants(plants, brief, { variationCounter: 1 });
  assert.notEqual(other[0].seed, once.seed);
});

test("a windy shallow bed gets a single-species windward row", () => {
  const plan = buildGardenPlan(plants, batch[2]);
  assert.equal(plan.engine?.windProfile, "windbreak");
  const row = plan.layout!.placements.filter((p) => (p as { windbreakRow?: boolean }).windbreakRow);
  assert.ok(row.length > 0, "P3: a windward row is required");
  assert.equal(new Set(row.map((p) => p.plantId)).size, 1, "P7: one species per row");
  // TR1-6: windward = south and east edges. The row starts on one of them;
  // plants beyond the edge row form staggered leeward rows (P8, R-STRU-022).
  const { bedWidthM: W, bedLengthM: L } = batch[2];
  const onWindwardEdge = (p: (typeof row)[number]) =>
    Math.abs(p.yM + p.radiusM - L) < 1e-6 || Math.abs(p.xM + p.radiusM - W) < 1e-6;
  const first = row.find((p) => p.sequence === 0)!;
  assert.ok(onWindwardEdge(first), `${first.instanceId} is not on a windward edge`);
  // P11 keeps only its length test.
  const p11 = plan.engine!.placementChecks.find((c) => c.id === "P11");
  assert.ok(p11 && !/angle/i.test(p11.detail));
});

test("placement alone never breaks P1/P2 even for an over-full request", () => {
  // Ask for far more than fits: placement must fail cleanly, never overlap.
  const tiers = computeHeightTiers(plants);
  const bands = computeSpreadBands(plants);
  const brief = { ...baseBrief, bedWidthM: 1, bedLengthM: 1 };
  const big = plants
    .filter((p) => p.spreadCm !== null && p.spreadCm >= 60 && p.spreadCm <= 100 && p.heightCm !== null)
    .slice(0, 3);
  const infos = new Map(
    big.map((p) => {
      const score = scorePlantStage1(p, { brief, savedPlantIds: [] }).score;
      const record = { ...computeInfo(p, score, tiers, bands) };
      return [record.id, record];
    }),
  );
  const selection = new Map([...infos.keys()].map((id) => [id, 3]));
  const result = placeSelection(selection, infos, { widthM: 1, depthM: 1, windSite: 0, rowsAvailable: 0 }, createRng("x"));
  const placements = result.layout.placements;
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      assert.ok(Math.hypot(a.xM - b.xM, a.yM - b.yM) >= minCentreDistance(a.radiusM, b.radiusM) - 1e-6);
    }
  }
  assert.equal(result.status, "failed");
});

function computeInfo(
  plant: Plant,
  score: number,
  tiers: ReturnType<typeof computeHeightTiers>,
  bands: ReturnType<typeof computeSpreadBands>,
): SpeciesInfo {
  const info = speciesInfo(plant, score, tiers, bands);
  assert.ok(info);
  return info;
}

// ---------------------------------------------------------------------------
// Regression briefs (TR1-9) - replace the single fixed guided garden. Each
// covers a different sun / water / soil combination; together they cover
// every style and wind both on and off.
// ---------------------------------------------------------------------------

export const TEST_BRIEFS: { label: string; brief: GardenBrief }[] = [
  {
    label: "A fynbos, full sun / low water / sandy, no wind, 6 x 4 m",
    brief: { ...baseBrief, style: "fynbos", sun: "full", water: "low", soil: "sandy", wind: "none", bedWidthM: 6, bedLengthM: 4, colour: { mode: "scheme", scheme: "warm" } },
  },
  {
    label: "B mediterranean, full sun / low water / loam, wind affected, 8 x 5 m",
    brief: { ...baseBrief, style: "mediterranean", sun: "full", water: "low", soil: "loam", wind: "affected", bedWidthM: 8, bedLengthM: 5, extras: ["low-maintenance"] },
  },
  {
    label: "C cottage, part sun / moderate water / loam, no wind, 5 x 3 m",
    brief: { ...baseBrief, style: "cottage", sun: "part", water: "moderate", soil: "loam", wind: "none", bedWidthM: 5, bedLengthM: 3, extras: ["pollinators", "fragrance"] },
  },
  {
    label: "D undecided, sheltered / moist / clay, wind protected, 4 x 2 m",
    brief: { ...baseBrief, style: "undecided", sun: "sheltered", water: "moist", soil: "clay", wind: "protected", bedWidthM: 4, bedLengthM: 2 },
  },
  {
    label: "E fynbos, part sun / moderate water / soil not sure, wind affected, 12 x 8 m",
    brief: { ...baseBrief, style: "fynbos", sun: "part", water: "moderate", soil: "not-sure", wind: "affected", bedWidthM: 12, bedLengthM: 8, colour: { mode: "custom", colours: ["Pink", "White"] }, extras: ["wildlife"] },
  },
];

for (const { label, brief } of TEST_BRIEFS) {
  test(`test brief ${label}: a valid plan with every hard rule met`, () => {
    const plan = buildGardenPlan(plants, brief);
    assert.equal(plan.status, "provisional-plan", plan.diagnostics.join(" | "));
    for (const check of plan.engine!.hard) assert.ok(check.pass, `${check.id}: ${check.detail}`);
    for (const check of plan.engine!.placementChecks.filter((c) => c.kind === "hard")) {
      assert.ok(check.pass, `${check.id}: ${check.detail}`);
    }
    // Wind shapes placement, never the pool.
    assert.equal(plan.engine!.windProfile === "standard", brief.wind === "none");
  });

  test(`test brief ${label}: groups are not all the same size (TR1-2)`, () => {
    const plan = buildGardenPlan(plants, brief);
    const sizes = (plan.quantities?.quantities ?? []).map((q) => q.quantity);
    if (sizes.length < 4) return; // the rule applies to beds with 4+ species
    assert.ok(
      new Set(sizes).size > 1,
      `all ${sizes.length} groups are size ${sizes[0]} (sizes ${sizes.join(",")})`,
    );
  });
}

// ---------------------------------------------------------------------------
// k_headroom (TR2): brief E now varies its groups, and a sensitivity test
// ---------------------------------------------------------------------------

function poolFor(brief: GardenBrief): SpeciesInfo[] {
  const tiers = computeHeightTiers(plants);
  const bands = computeSpreadBands(plants);
  const site = engineSite(brief);
  return plants
    .filter((plant) => survivesHardFilters(plant, brief))
    .flatMap((plant) => {
      const info = speciesInfo(plant, scorePlantStage1(plant, { brief, savedPlantIds: [] }).score, tiers, bands);
      return info && info.diameterM >= 0.15 && info.diameterM <= Math.min(site.widthM, site.depthM) ? [info] : [];
    });
}

test("brief E with k_headroom 2.0: groups larger than 3, no species above 0.20", () => {
  const brief = TEST_BRIEFS[4].brief;
  const plan = buildGardenPlan(plants, brief);
  const quantities = plan.quantities!.quantities;
  const total = plan.quantities!.totalPlants;
  assert.ok(quantities.some((q) => q.quantity > 3), "expected at least one group above 3");
  for (const q of quantities) {
    assert.ok(q.quantity / total <= 0.2 + 1e-9, `${q.id} takes ${(q.quantity / total).toFixed(3)} of the bed`);
  }
});

test("sensitivity: brief E at k_headroom 1.5 / 2.0 / 2.5", () => {
  const brief = TEST_BRIEFS[4].brief;
  const pool = poolFor(brief);
  const seed = "sensitivity-E";
  const rows: string[] = [];
  for (const kHeadroom of [1.5, 2.0, 2.5]) {
    const run = runEngine(pool, { ...engineSite(brief), kHeadroom }, seed);
    assert.equal(run.status, "plan");
    const sizes = [...run.selection.values()].sort((a, b) => a - b);
    const total = sizes.reduce((sum, n) => sum + n, 0);
    const cap = Math.max(RULES.styles.fynbos.rMax, kHeadroom / sizes.length);
    assert.ok(Math.max(...sizes) / total <= cap + 1e-9, "H5 must hold at every k");
    rows.push(`k=${kHeadroom}: sizes ${sizes.join(",")} | species ${sizes.length} | plants ${total} | cap ${cap.toFixed(3)} | Z ${run.evaluation!.z.toFixed(4)}`);
  }
  console.log(["", "k_headroom sensitivity, brief E", ...rows.map((row) => `  ${row}`)].join("\n"));
});

// ---------------------------------------------------------------------------
// Viewing edge (owner decision, 2026-09-28): the gardener says which side
// they look from, and ONE of the three options steps its heights up away
// from that edge. Wind is untouched - the windward row stays on the true
// south and east edges whatever is chosen.
// ---------------------------------------------------------------------------

test("the viewing axis measures depth from the chosen edge", () => {
  const W = 6;
  const L = 4;
  // North is the rulebook's assumption: depth is the distance down the page.
  const north = viewingAxis("north", W, L);
  assert.equal(north.span, L);
  assert.equal(north.across, W);
  assert.equal(north.depthOf(1, 3), 3);
  assert.deepEqual(north.pointAt(3, 1), { x: 1, y: 3 });

  // From the south edge the same point is shallow, not deep.
  const south = viewingAxis("south", W, L);
  assert.equal(south.span, L);
  assert.equal(south.depthOf(1, 3), 1);
  assert.deepEqual(south.pointAt(3, 1), { x: 1, y: 1 });

  // From east or west the bed is measured across its width instead.
  const east = viewingAxis("east", W, L);
  assert.equal(east.span, W);
  assert.equal(east.across, L);
  assert.equal(east.depthOf(5, 2), 1);
  assert.deepEqual(east.pointAt(1, 2), { x: 5, y: 2 });

  const west = viewingAxis("west", W, L);
  assert.equal(west.depthOf(5, 2), 5);
  assert.deepEqual(west.pointAt(1, 2), { x: 1, y: 2 });

  // Every edge: a point built at a depth reports that depth back.
  for (const edge of ["north", "east", "south", "west"] as const) {
    const axis = viewingAxis(edge, W, L);
    assert.ok(Math.abs(axis.depthOf(...Object.values(axis.pointAt(1.5, 2)) as [number, number]) - 1.5) < 1e-9);
  }
});

test("every option is laid out from the viewing edge, not only one", () => {
  // Owner decision 12 October 2026, replacing 2026-09-28. Until then only
  // the last option measured depth from the gardener and the other two
  // assumed north, so a tall plant could land at the viewer's feet in two
  // plans out of three. This tests the rule itself - taller plants further
  // from the viewer than shorter ones - on EVERY option and EVERY edge,
  // which is stronger than the test it replaces (one option, compared only
  // with the others).
  //
  // No wind, so the standard profile applies. The windy deep-bed ramp is a
  // separate, deliberate exception, pinned by the next test.
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  for (const edge of ["north", "east", "south", "west"] as const) {
    const brief: GardenBrief = {
      ...baseBrief,
      bedWidthM: 8,
      bedLengthM: 6,
      style: "fynbos",
      wind: "none",
      viewingEdge: edge,
    };
    const variants = buildGardenPlanVariants(plants, brief);
    assert.ok(variants.length > 1, `${edge}: expected more than one option`);
    for (const plan of variants) {
      const layout = plan.layout;
      assert.ok(layout, `${edge} ${plan.character}: no layout`);
      const axis = viewingAxis(edge, layout.bedWidthM, layout.bedLengthM);
      const meanDepth = (test: (heightCm: number) => boolean) => {
        const picked = layout.placements.filter((p) => {
          const height = byId.get(p.plantId)?.heightCm;
          return height !== null && height !== undefined && test(height);
        });
        return picked.length === 0
          ? null
          : picked.reduce((sum, p) => sum + axis.depthOf(p.xM, p.yM), 0) / picked.length;
      };
      const tall = meanDepth((h) => h >= 100);
      const short = meanDepth((h) => h < 50);
      if (tall !== null && short !== null) {
        assert.ok(
          tall > short,
          `${edge} ${plan.character}: tall plants should sit further from the viewer than short ones (tall ${tall.toFixed(2)} m, short ${short.toFixed(2)} m)`,
        );
      }
      // The note that used to label one option as the odd one out must be
      // gone: it now describes every option, and claimed the rest used north.
      assert.doesNotMatch(
        plan.diagnostics.join(" "),
        /step up away from the north edge/i,
        `${edge} ${plan.character}: still claims the other options use north`,
      );
      // Every hard placement rule still holds.
      for (const check of plan.engine?.placementChecks.filter((c) => c.kind === "hard") ?? []) {
        assert.ok(check.pass, `${edge} ${plan.character} ${check.id}: ${check.detail}`);
      }
    }
  }
});

test("the wind ramp keeps the wind's axis, whatever the viewing edge", () => {
  // The aerodynamic ramp is a WIND rule: low plants on the windward south
  // and east side, rising to tall away from it. targetDepth writes that as
  // depth 0 on the north axis. If it were measured from the viewer, a
  // south-facing gardener would get the tallest plants ON the windward
  // edge - the opposite of the rule. So under the ramp, depth is measured
  // from north for every edge; under every other profile, from the viewer.
  const W = 8;
  const L = 6;
  const x = 2;
  const y = 1.5;
  for (const edge of ["north", "east", "south", "west"] as const) {
    assert.ok(
      Math.abs(depthAxisFor("ramp", edge, W, L).depthOf(x, y) - y) < 1e-9,
      `ramp, ${edge} viewer: depth must be measured from the north edge`,
    );
    const viewer = viewingAxis(edge, W, L);
    for (const profile of ["standard", "windbreak"] as const) {
      assert.ok(
        Math.abs(depthAxisFor(profile, edge, W, L).depthOf(x, y) - viewer.depthOf(x, y)) < 1e-9,
        `${profile}, ${edge} viewer: depth must be measured from the viewer`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Hand-check coverage (2026-09-29). The rulebook's 9_Hand_Check has one bed,
// and its H3 line only shows that group sizes are odd. These add the cases it
// does not reach: both wind settings, an empty colour and extras answer, the
// first and third bed-area bands, the spread-band rule behind H3, n = 1 for a
// feature plant only, and a selection that must be rejected. Each logs the
// code's Z on the same inputs so the workbook can record it.
// ---------------------------------------------------------------------------

/** A synthetic species with everything H1-H5 reads. */
function handSpecies(over: Partial<SpeciesInfo> & { id: string }): SpeciesInfo {
  const spreadCm = over.diameterM !== undefined ? over.diameterM * 100 : 60;
  return {
    score: 0.6,
    diameterM: spreadCm / 100,
    areaM2: Math.PI * (spreadCm / 200) ** 2,
    heightCm: 80,
    tier: "medium",
    layer: "L4",
    types: ["shrub"],
    colours: ["White"],
    seasons: ["spring"],
    feature: false,
    allowedN: [3, 5, 7],
    windres: false,
    shade: false,
    hedge: false,
    genus: over.id.split(" ")[0],
    ...over,
  };
}

function handSite(over: Partial<EngineSite> & { widthM: number; depthM: number }): EngineSite {
  const areaM2 = over.widthM * over.depthM;
  return {
    areaM2,
    style: RULES.styles.fynbos,
    ...bandFor(areaM2),
    userColours: [],
    windSite: 0,
    rowsAvailable: Math.floor(over.depthM / RULES.stage4.rowPitchM),
    windbreakRequired: false,
    ...over,
  };
}

function handEvaluate(species: SpeciesInfo[], counts: [string, number][], site: EngineSite) {
  const infos = new Map(species.map((s) => [s.id, s]));
  return evaluateSelection(stateFrom(new Map(counts), infos, site));
}

test("hand check: wind off and wind on give the same Stage 2 verdict", () => {
  // Wind never filters and never scores in Stage 2 - it shapes placement.
  // Same selection, W_site 0 and 1: Z and every hard check must match.
  const species = [
    handSpecies({ id: "a", diameterM: 0.6 }),
    handSpecies({ id: "b", diameterM: 0.8, colours: ["Red"] }),
    handSpecies({ id: "c", diameterM: 0.5, colours: ["Yellow"] }),
  ];
  const counts: [string, number][] = [["a", 3], ["b", 3], ["c", 3]];
  const calm = handEvaluate(species, counts, handSite({ widthM: 4, depthM: 3, windSite: 0 }));
  const windy = handEvaluate(species, counts, handSite({ widthM: 4, depthM: 3, windSite: 1 }));

  assert.equal(calm.z.toFixed(6), windy.z.toFixed(6), "wind must not move Stage 2's Z");
  assert.deepEqual(
    calm.hard.map((h) => [h.id, h.pass]),
    windy.hard.map((h) => [h.id, h.pass]),
  );
  console.log(`  hand check wind 0 vs 1: Z = ${calm.z.toFixed(4)} both`);
});

test("hand check: with no colours chosen, A2 scores colour variety instead", () => {
  // Not obvious from the rulebook and worth pinning: when the user asks for
  // no colour, G2 does not score 0 and does not score a free 1 - it falls
  // back to how many distinct colours the bed has, against c_min.
  const site = handSite({ widthM: 4, depthM: 3, userColours: [] });

  const oneColour = handEvaluate(
    [handSpecies({ id: "a", colours: ["White"] }),
     handSpecies({ id: "b", colours: [] }),
     handSpecies({ id: "c", colours: [] })],
    [["a", 3], ["b", 3], ["c", 3]],
    site,
  );
  assert.equal(oneColour.goals.A2, Math.min(1, 1 / RULES.stage2.cMin));

  // A bed with no recorded colour at all scores 0 on G2 - missing evidence
  // is not a pass.
  const noColour = handEvaluate(
    [handSpecies({ id: "a", colours: [] }),
     handSpecies({ id: "b", colours: [] }),
     handSpecies({ id: "c", colours: [] })],
    [["a", 3], ["b", 3], ["c", 3]],
    site,
  );
  assert.equal(noColour.goals.A2, 0);
  assert.ok(noColour.z > 0, "the plan still scores on its other goals");
  console.log(`  hand check no colours: A2 = ${oneColour.goals.A2} with one colour, ${noColour.goals.A2} with none (c_min ${RULES.stage2.cMin}); Z ${oneColour.z.toFixed(4)} vs ${noColour.z.toFixed(4)}`);
});

test("hand check: bed-area bands 1 and 3 enforce their own species counts (H2)", () => {
  const many = Array.from({ length: 12 }, (_, i) => handSpecies({ id: `s${i}`, diameterM: 0.4 }));

  // Band 1 (<= 10 m2) asks for 3-6 species: 12 is too many.
  const band1 = handEvaluate(
    many,
    many.map((s) => [s.id, 3] as [string, number]),
    handSite({ widthM: 3, depthM: 3 }),
  );
  const h2Band1 = band1.hard.find((h) => h.id === "H2")!;
  assert.equal(h2Band1.pass, false, "12 species must fail H2 on a 9 m2 bed");
  assert.equal(h2Band1.limit, "3 to 6 species");

  // Band 3 (> 50 m2) asks for 10-20: the same 12 species now pass.
  const band3 = handEvaluate(
    many,
    many.map((s) => [s.id, 3] as [string, number]),
    handSite({ widthM: 12, depthM: 8 }),
  );
  const h2Band3 = band3.hard.find((h) => h.id === "H2")!;
  assert.equal(h2Band3.pass, true, "12 species must pass H2 on a 96 m2 bed");
  assert.equal(h2Band3.limit, "10 to 20 species");
  console.log(`  hand check bands: 12 species -> band 1 Z ${band1.z.toFixed(4)} (H2 fail), band 3 Z ${band3.z.toFixed(4)} (H2 pass)`);
});

test("hand check: H3 reads the spread band's allowed sizes, not merely odd numbers", () => {
  // A wide species may only be grouped 1 or 3; 5 is not allowed for it even
  // though 5 is odd and is allowed for a narrow species.
  const wide = handSpecies({ id: "wide", diameterM: 1.6, allowedN: [1, 3] });
  const narrow = handSpecies({ id: "narrow", diameterM: 0.3, allowedN: [1, 3, 5, 7, 9, 11, 15] });
  const filler = handSpecies({ id: "filler", diameterM: 0.4 });
  const site = handSite({ widthM: 6, depthM: 4 });

  const bad = handEvaluate([wide, narrow, filler], [["wide", 5], ["narrow", 5], ["filler", 3]], site);
  const badH3 = bad.hard.find((h) => h.id === "H3")!;
  assert.equal(badH3.pass, false, "5 is odd but not allowed for a wide species");
  assert.match(badH3.detail, /wide x5/);

  const good = handEvaluate([wide, narrow, filler], [["wide", 3], ["narrow", 5], ["filler", 3]], site);
  assert.equal(good.hard.find((h) => h.id === "H3")!.pass, true);
  console.log(`  hand check H3 spread band: wide x5 rejected, wide x3 accepted (Z ${good.z.toFixed(4)})`);
});

test("hand check: H3 honours each species' own allowed sizes for n = 1", () => {
  const site = handSite({ widthM: 6, depthM: 4 });
  const filler = handSpecies({ id: "filler", diameterM: 0.4 });
  const second = handSpecies({ id: "second", diameterM: 0.45 });
  const check = (allowedN: number[]) => {
    const solo = handSpecies({ id: "solo", diameterM: 0.5, allowedN });
    return handEvaluate([solo, filler, second], [["solo", 1], ["filler", 3], ["second", 3]], site)
      .hard.find((h) => h.id === "H3")!;
  };
  assert.equal(check([1, 3]).pass, true, "a species allowed 1 may stand alone");
  const refused = check([3, 5, 7]);
  assert.equal(refused.pass, false, "a species not allowed 1 may not");
  assert.match(refused.detail, /solo x1/);
});

test("H3: allowedN follows the band and the layer, not just the feature flag", () => {
  // The same rule at the source - speciesInfo builds allowedN, so this
  // pins which plants can ever be offered a group of one.
  const tiers = computeHeightTiers(plants);
  const bands = computeSpreadBands(plants);
  const infos = plants
    .flatMap((plant) => {
      const info = speciesInfo(plant, 0.5, tiers, bands);
      return info ? [{ plant, info }] : [];
    });

  for (const { plant, info } of infos) {
    const allowsOne = info.allowedN.includes(1);
    const band = spreadBandOf(plant.spreadCm as number, bands);
    if (info.layer === "L3" || info.layer === "L4") {
      assert.equal(allowsOne, info.feature, `${plant.id}: ${info.layer} may only be single when it is the feature`);
    } else if (band === 0 && !info.feature) {
      assert.equal(allowsOne, false, `${plant.id}: band 1 keeps 1 for the feature plant only`);
    }
  }
  const singles = infos.filter(({ info }) => info.allowedN.includes(1));
  console.log(`  H3 allowedN: ${singles.length} of ${infos.length} species may form a group of one`);
});

test("hand check: a deliberately bad selection is rejected, with the reason", () => {
  // One species takes far more than its share: H5 must catch it.
  const hog = handSpecies({ id: "hog", diameterM: 0.5 });
  const a = handSpecies({ id: "a", diameterM: 0.4 });
  const b = handSpecies({ id: "b", diameterM: 0.4 });
  const result = handEvaluate(
    [hog, a, b],
    [["hog", 15], ["a", 3], ["b", 3]],
    handSite({ widthM: 6, depthM: 4 }),
  );
  const h5 = result.hard.find((h) => h.id === "H5")!;
  assert.equal(h5.pass, false, "15 of 21 plants in one species must fail H5");
  assert.ok(h5.value > 0.5, `expected a large share, got ${h5.value}`);
  assert.ok(result.hard.some((h) => !h.pass), "the selection must be reported infeasible");
  console.log(`  hand check deliberate failure: H5 share ${h5.value.toFixed(3)} against ${h5.limit}, Z ${result.z.toFixed(4)}`);
});

test("B1: 60 random candidate positions are drawn per plant per restart", () => {
  // The rulebook parameter is the count itself now (random_draws_per_plant);
  // Stage 4 uses it as given. Before 2026-09-30 it was a budget of 240 that
  // Stage 4 quartered, which meant the workbook, the report and the code all
  // stated different numbers. Either spelling must still yield 60, so the
  // workbook and the code can be updated in either order.
  assert.equal(PLACEMENT.randomDraws, 60);
  assert.equal(PLACEMENT.restarts, RULES.stage4.placementRestarts);

  // The split across those draws: in-band first, then anywhere in the bed.
  const inBand = Math.floor(PLACEMENT.randomDraws * PLACEMENT.inBandShare);
  assert.equal(inBand, 36, "60 x 0.6 = 36 draws inside the layer's depth band");
  assert.equal(PLACEMENT.randomDraws - inBand, 24, "the remaining 24 may land anywhere");

  // Contact points are added on top, so the candidate set is always larger
  // than the random draws alone - the scheme is hybrid, not tangency-only.
  assert.ok(PLACEMENT.randomDraws > 0, "random draws must never fall to zero");
});

// ---------------------------------------------------------------------------
// H3b: the singleton limit (owner decision, 2026-09-30)
//   n1 <= MIN(k_band, FLOOR((1 - min_grouped_share) x S))
// with k_band by BED AREA band, the feature plant counted in n1, and band 1
// keeping n = 1 for the feature plant only.
// ---------------------------------------------------------------------------

test("H3b: the singleton limit for S = 5, 6, 10 and 20 across the bands", () => {
  assert.deepEqual([...SINGLETON_K_BY_BAND], [1, 2, 4]);
  assert.equal(MIN_GROUPED_SHARE, 0.6);

  // One bed per area band: 9 m2 (band 1), 24 m2 (band 2), 100 m2 (band 3).
  const beds: [number, number, number][] = [[3, 3, 0], [6, 4, 1], [10, 10, 2]];
  for (const [W, L, band] of beds) {
    assert.equal(areaBandIndex(W * L), band, `${W}x${L} should be band ${band + 1}`);
  }

  // limit = MIN(k_band, FLOOR(0.4 S)).
  const expected: Record<number, [number, number, number]> = {
    //  S: [band 1, band 2, band 3]
    5: [1, 2, 2],
    6: [1, 2, 2],
    10: [1, 2, 4],
    20: [1, 2, 4],
  };
  for (const [sText, wanted] of Object.entries(expected)) {
    const S = Number(sText);
    for (const [W, L, band] of beds) {
      const species = Array.from({ length: S }, (_, i) =>
        handSpecies({ id: `s${i}`, diameterM: 0.3, allowedN: [1, 3] }),
      );
      const state = stateFrom(
        new Map(species.map((s) => [s.id, 3])),
        new Map(species.map((s) => [s.id, s])),
        handSite({ widthM: W, depthM: L }),
      );
      assert.equal(
        state.singletonLimit(),
        wanted[band],
        `S = ${S} on band ${band + 1} should allow ${wanted[band]} singletons`,
      );
    }
  }
  console.log("  H3b limits: S=5 -> 1/2/2, S=6 -> 1/2/2, S=10 -> 1/2/4, S=20 -> 1/2/4 (bands 1/2/3)");
});

test("H3b: a selection over the limit is rejected, at or under it is accepted", () => {
  const site = handSite({ widthM: 6, depthM: 4 }); // band 2, k = 2
  const species = Array.from({ length: 5 }, (_, i) =>
    handSpecies({ id: `s${i}`, diameterM: 0.5, allowedN: [1, 3] }),
  );
  const infos = new Map(species.map((s) => [s.id, s]));
  const evaluate = (counts: number[]) =>
    evaluateSelection(stateFrom(new Map(species.map((s, i) => [s.id, counts[i]])), infos, site));

  // S = 5 on band 2: MIN(2, FLOOR(0.4 x 5) = 2) = 2.
  const ok = evaluate([1, 1, 3, 3, 3]);
  assert.equal(ok.hard.find((h) => h.id === "H3b")!.pass, true);
  const tooMany = evaluate([1, 1, 1, 3, 3]);
  const check = tooMany.hard.find((h) => h.id === "H3b")!;
  assert.equal(check.pass, false);
  assert.equal(check.value, 3);
  assert.match(check.detail, /3 species are single plants; at most 2 may be/);
  // The optimiser's own gate agrees with the reported check.
  assert.equal(
    stateFrom(new Map(species.map((s, i) => [s.id, [1, 1, 1, 3, 3][i]])), infos, site).withinLimits(),
    false,
    "withinLimits must reject what H3b rejects, or the search could build it",
  );
});

// ---------------------------------------------------------------------------
// User exclusions (2026-10-01)
//
// An excluded plant leaves the pool at Stage 0, which means it is never
// scored and cannot reach a layout. The exclusion is a preference, not
// evidence: it is recorded against the user's device, never against the
// species, so putting a plant back must restore it exactly.
// ---------------------------------------------------------------------------

const planBrief: GardenBrief = {
  ...baseBrief,
  bedWidthM: 6,
  bedLengthM: 4,
  style: "fynbos",
  water: "moderate",
};

test("an excluded plant cannot appear in any of the three options", () => {
  const before = buildGardenPlanVariants(plants, planBrief);
  const chosen = before[0].quantities?.quantities[0]?.id;
  assert.ok(chosen, "expected a plan to exclude a plant from");

  const after = buildGardenPlanVariants(plants, planBrief, {
    excludedPlantIds: [chosen],
  });
  for (const variant of after) {
    const ids = (variant.quantities?.quantities ?? []).map((q) => q.id);
    assert.ok(
      !ids.includes(chosen),
      `${chosen} is excluded but still appears in ${variant.character}`,
    );
  }
});

test("exclusion removes the plant from the pool, not just from the result", () => {
  const plant = plants.find((p) => survivesHardFilters(p, planBrief))!;
  assert.equal(survivesHardFilters(plant, planBrief, [plant.id]), false);

  const plan = buildGardenPlan(plants, planBrief, { excludedPlantIds: [plant.id] });
  const assessment = plan.assessments.find((a) => a.plantId === plant.id)!;
  assert.equal(assessment.status, "excluded");
  // Stage 1 never runs on an excluded plant, so no score can bring it back.
  assert.equal(assessment.stage1, null);
  const trace = assessment.feasibility.trace.find(
    (entry) => entry.constraintId === "not-excluded",
  );
  assert.ok(trace, "the exclusion must appear in the trace, not act invisibly");
  assert.equal(trace.status, "fail");
  assert.match(trace.reason, /You excluded this plant/);
});

test("putting a plant back restores the identical plan", () => {
  const plant = plants.find((p) => survivesHardFilters(p, planBrief))!;
  const excludedPlan = buildGardenPlan(plants, planBrief, {
    excludedPlantIds: [plant.id],
  });
  const restored = buildGardenPlan(plants, planBrief, { excludedPlantIds: [] });
  const plain = buildGardenPlan(plants, planBrief);
  assert.equal(restored.seed, plain.seed);
  assert.deepEqual(
    restored.quantities?.quantities,
    plain.quantities?.quantities,
    "an empty exclusion list must behave exactly as no exclusions at all",
  );
  assert.notEqual(excludedPlan.seed, plain.seed);
});

test("an empty exclusion list keeps the seed every saved garden was built with", () => {
  // The seed is stored with each saved layout and must still reproduce it,
  // so adding exclusions may not change the hash until one is actually set.
  const plain = buildGardenPlan(plants, planBrief);
  assert.equal(
    buildGardenPlan(plants, planBrief, { excludedPlantIds: [] }).seed,
    plain.seed,
  );
});

test("the trace never claims evidence for an exclusion the user made", () => {
  const plant = plants.find((p) => survivesHardFilters(p, planBrief))!;
  const plan = buildGardenPlan(plants, planBrief, { excludedPlantIds: [plant.id] });
  const trace = plan.assessments
    .find((a) => a.plantId === plant.id)!
    .feasibility.trace.find((entry) => entry.constraintId === "not-excluded")!;
  assert.match(
    String(trace.evidence?.source),
    /your choice/i,
    "an exclusion carries no horticultural source",
  );
  // The species record itself is untouched: no exclusion flag on the plant.
  assert.ok(!("excluded" in plant), "exclusion must never be written onto a species");
});

// ---------------------------------------------------------------------------
// P2 revised (rulebook 60273b1253ee, 2026-10-05)
//
// The rulebook states the rule twice - as a centre distance and as a ratio -
// and asks for the ratio to be checked on every pair of a real layout, not
// only on the formula. These are algebraically the same test; running both
// on built layouts is what catches a placement path that bypasses
// minCentreDistance.
// ---------------------------------------------------------------------------

test("no placed pair overlaps by more than delta of the smaller radius", () => {
  const delta = RULES.stage4.overlapDelta;
  let pairs = 0;
  let worstRatio = 0;
  let plansChecked = 0;

  for (const brief of batch) {
    for (const plan of buildGardenPlanVariants(plants, brief)) {
      const placements = plan.layout?.placements ?? [];
      if (placements.length < 2) continue;
      plansChecked += 1;
      for (let i = 0; i < placements.length; i += 1) {
        for (let j = i + 1; j < placements.length; j += 1) {
          const a = placements[i];
          const b = placements[j];
          const distance = Math.hypot(a.xM - b.xM, a.yM - b.yM);
          const overlap = Math.max(0, a.radiusM + b.radiusM - distance);
          const ratio = overlap / Math.min(a.radiusM, b.radiusM);
          worstRatio = Math.max(worstRatio, ratio);
          pairs += 1;
          assert.ok(
            ratio <= delta + 1e-6,
            `${a.plantId}/${b.plantId} overlap ${overlap.toFixed(3)} m = ` +
              `${(ratio * 100).toFixed(1)}% of the smaller radius (limit ${delta * 100}%)`,
          );
        }
      }
    }
  }

  assert.ok(plansChecked > 0, "expected at least one layout to check");
  console.log(
    `  P2 ratio: ${pairs} pairs across ${plansChecked} layouts, worst ` +
      `${(worstRatio * 100).toFixed(1)}% of the smaller radius (limit ${delta * 100}%)`,
  );
});

// ---------------------------------------------------------------------------
// C1: bed-scaled group sizes for small plants (2026-10-05)
// ---------------------------------------------------------------------------

test("C1: each band gains its extra group sizes at the stated bed area", () => {
  // The thresholds are derived from the parameters, not written down, so
  // this pins the behaviour and would fail loudly if a parameter moved.
  const expectedFirst: Record<number, { size: number; bedAreaM2: number }> = {
    0: { size: 19, bedAreaM2: 19 },
    1: { size: 9, bedAreaM2: 9 },
    2: { size: 5, bedAreaM2: 5 },
  };

  RULES.stage2.groupSizes.forEach((sizes, band) => {
    const thresholds = c1Thresholds(sizes);
    const first = thresholds[0];
    assert.ok(first, `band ${band + 1} should gain at least one size`);
    assert.deepEqual(
      { size: first.size, bedAreaM2: first.bedAreaM2 },
      expectedFirst[band],
      `band ${band + 1} first added size`,
    );

    // Every threshold must be the exact point of change: nothing added
    // just below it, that size present at it.
    for (const { size, bedAreaM2 } of thresholds) {
      const below = bedScaledGroupSizes(10, sizes, bedAreaM2 - 0.01) ?? sizes;
      const at = bedScaledGroupSizes(10, sizes, bedAreaM2) ?? sizes;
      assert.ok(!below.includes(size), `${size} must not be offered below ${bedAreaM2} m2`);
      assert.ok(at.includes(size), `${size} must be offered at ${bedAreaM2} m2`);
    }

    // C1 only ever adds: every size the band already had survives.
    const scaled = bedScaledGroupSizes(10, sizes, 1000);
    for (const size of sizes) {
      assert.ok(scaled!.includes(size), `${size} must still be allowed in band ${band + 1}`);
    }
    assert.ok(Math.max(...scaled!) <= SMALL_GROUP_MAX, "never above small_group_max");
  });

  // A species at or above the threshold is untouched, whatever the bed.
  assert.equal(bedScaledGroupSizes(SMALL_SPREAD_MAX_CM, [3, 5, 7], 1000), null);
  assert.equal(bedScaledGroupSizes(29, [3, 5, 7], null), null, "no bed area, no scaling");
});

// ---------------------------------------------------------------------------
// H7 footprint cap (rulebook 5_Stage2_Constraints row 11, 2026-10-05)
//
//   pi (s_i / 2)^2 <= phi * W * L   for every L1 species, else y_i = 0
// ---------------------------------------------------------------------------

test("H7 PASS: an L1 plant inside the cap is allowed and the check passes", () => {
  const site = handSite({ widthM: 6, depthM: 4 }); // 24 m2, cap 6.00 m2
  const cap = footprintCapM2(site.areaM2)!;
  // 2.70 m spread: area 5.73 m2, just inside the 2.76 m limit.
  const inside = handSpecies({ id: "inside", diameterM: 2.7, layer: "L1", allowedN: [1, 3] });
  assert.ok(inside.areaM2 < cap, `${inside.areaM2.toFixed(2)} should be under ${cap.toFixed(2)}`);
  assert.equal(exceedsFootprintCap(inside, site.areaM2), false);

  const others = [1, 2, 3].map((i) =>
    handSpecies({ id: `s${i}`, diameterM: 0.4, layer: "L4", allowedN: [3, 5] }),
  );
  const result = handEvaluate(
    [inside, ...others],
    [["inside", 1], ["s1", 3], ["s2", 3], ["s3", 3]],
    site,
  );
  const h7 = result.hard.find((h) => h.id === "H7")!;
  assert.equal(h7.pass, true);
  assert.equal(h7.value, 0);
});

test("H7 FAIL: an L1 plant over the cap is rejected and never selected", () => {
  const site = handSite({ widthM: 6, depthM: 4 });
  const cap = footprintCapM2(site.areaM2)!;
  // 3.2 m spread: area 8.04 m2, over the 6.00 m2 cap.
  const over = handSpecies({ id: "over", diameterM: 3.2, layer: "L1", allowedN: [1, 3] });
  assert.ok(over.areaM2 > cap);
  assert.equal(exceedsFootprintCap(over, site.areaM2), true);

  const others = [1, 2, 3].map((i) =>
    handSpecies({ id: `s${i}`, diameterM: 0.4, layer: "L4", allowedN: [3, 5] }),
  );
  const counts: [string, number][] = [["over", 1], ["s1", 3], ["s2", 3], ["s3", 3]];
  const result = handEvaluate([over, ...others], counts, site);
  const h7 = result.hard.find((h) => h.id === "H7")!;
  assert.equal(h7.pass, false);
  assert.equal(h7.value, 1);

  // withinLimits must agree, or Stage 3 could still build this selection.
  const infos = new Map([over, ...others].map((s) => [s.id, s]));
  assert.equal(
    stateFrom(new Map(counts), infos, site).withinLimits(),
    false,
    "withinLimits must reject what H7 rejects",
  );

  // And the engine never offers it: y_i = 0, with the exclusion logged.
  const run = runEngine([over, ...others], site, "h7-fail");
  assert.ok(
    !run.selection || !run.selection.has("over"),
    "an over-cap species must never be selected",
  );
  assert.ok(
    run.diagnostics.some((d) => d.includes("over") && d.includes("footprint")),
    `the exclusion must be logged; got ${JSON.stringify(run.diagnostics)}`,
  );
});

test("H7 applies to L1 only, and matches the rulebook's 2.76 m on a 6 x 4 m bed", () => {
  const site = handSite({ widthM: 6, depthM: 4 });
  // The same oversized canopy in a lower layer is untouched: H1 and H5
  // already hold those, which is the rulebook's reason for L1-only.
  const lower = handSpecies({ id: "lower", diameterM: 3.2, layer: "L4" });
  assert.equal(exceedsFootprintCap(lower, site.areaM2), false);

  close(footprintCapSpreadM(site.areaM2)!, 2.76, 5e-3);
  close(footprintCapM2(site.areaM2)!, 0.25 * 24, 1e-9);
});
