/**
 * Ground cover as a mat (SEARCH.matModel, a study seam on coverage-test).
 * The switch is turned on only inside each test and always restored.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import {
  areaBandIndex,
  buildGardenPlan,
  buildGardenPlanVariants,
  PLACEMENT,
  RULES,
  SEARCH,
  toleratesShade,
  type GardenBrief,
} from "../app/lib/planning/index.ts";

const base: GardenBrief = {
  biomes: ["Fynbos"],
  bioregion: "Southwest Fynbos Bioregion",
  soil: "loam",
  wind: "none",
  viewingEdge: "north",
  sun: "part",
  water: "moderate",
  bedWidthM: 5,
  bedLengthM: 3,
  style: "cottage",
  colour: { mode: "none" },
  extras: [],
};
// Small, medium and large beds (the rulebook's H2 bands).
const BRIEFS: GardenBrief[] = [
  base,
  { ...base, style: "mediterranean", sun: "full", water: "low", wind: "affected", bedWidthM: 8, bedLengthM: 5 },
  { ...base, style: "fynbos", soil: "not-sure", wind: "affected", bedWidthM: 12, bedLengthM: 8 },
];

type Bag = Record<string, unknown>;
function withMat<T>(run: () => T): T {
  const search = SEARCH as unknown as Bag;
  const placement = PLACEMENT as unknown as Bag;
  const before = [search.matModel, placement.contactBonus];
  search.matModel = true;
  placement.contactBonus = 0;
  try {
    return run();
  } finally {
    [search.matModel, placement.contactBonus] = before;
  }
}

test("the mat is off unless switched on", () => {
  for (const brief of BRIEFS) assert.equal(buildGardenPlan(plants, brief).layout?.mat, undefined);
});

for (const brief of BRIEFS) {
  test(`mat rules hold: ${brief.style} ${brief.bedWidthM} x ${brief.bedLengthM} m`, () => {
    const plan = withMat(() => buildGardenPlan(plants, brief));
    const layout = plan.layout;
    assert.ok(layout?.mat, "a mat is laid");
    const mat = layout.mat;
    const style = RULES.styles[brief.style === "undecided" ? "generic" : brief.style];

    // Exactly open_min of the bed is left bare.
    assert.equal(layout.realisedOpenSpaceRatio, Math.ceil(style.openMin * mat.grid ** 2) / mat.grid ** 2);

    // Species count by band: small 1, medium <= 2, large <= 3.
    const band = areaBandIndex(brief.bedWidthM * brief.bedLengthM);
    assert.ok(mat.species.length <= band + 1, `${mat.species.length} species in band ${band}`);

    // Every mat species is a true carpeter, and none is left as circles.
    for (const s of mat.species) {
      const plant = plants.find((p) => p.id === s.plantId);
      assert.ok(plant, `${s.plantId} is in the catalogue`);
      assert.ok(plant.plantType?.some((t) => t === "ground cover" || t === "moss"), `${s.plantId} is a carpeter type`);
      assert.ok(!layout.placements.some((p) => p.plantId === s.plantId), `${s.plantId} has no circles`);
      assert.equal(s.count, Math.ceil(s.areaM2 * s.densityPerM2));
      const q = plan.quantities?.quantities.find((x) => x.id === s.plantId);
      assert.equal(q?.quantity, s.count, "the plant list buys the mat count");
    }

    // Sun patches are separate bands across the long axis, never mixed.
    const G = mat.grid;
    const alongX = brief.bedWidthM >= brief.bedLengthM;
    const along = (cell: number) => (alongX ? cell % G : Math.floor(cell / G));
    const sunOwners = mat.species.filter((s) => s.sunAreaM2 > 0).length;
    const firstAt = new Map<number, number>();
    const lastAt = new Map<number, number>();
    mat.cells.forEach((cell, i) => {
      if (mat.species[mat.owners[i]].sunAreaM2 === 0) return;
      const k = mat.owners[i];
      firstAt.set(k, Math.min(firstAt.get(k) ?? Infinity, along(cell)));
      lastAt.set(k, Math.max(lastAt.get(k) ?? -Infinity, along(cell)));
    });
    for (let k = 1; k < sunOwners; k += 1) {
      assert.ok((firstAt.get(k) as number) >= (lastAt.get(k - 1) as number), "bands do not overlap");
    }
  });
}

test("a shade patch uses a shade-tolerant species", () => {
  for (const brief of BRIEFS) {
    const plan = withMat(() => buildGardenPlan(plants, brief));
    for (const s of plan.layout?.mat?.species ?? []) {
      if (s.shadeAreaM2 === 0) continue;
      const plant = plants.find((p) => p.id === s.plantId);
      assert.ok(plant && toleratesShade(plant), `${s.plantId} tolerates shade`);
    }
  }
});

test("the mat is reproducible and does not change the specimens or Z", () => {
  for (const brief of BRIEFS) {
    const once = withMat(() => buildGardenPlan(plants, brief));
    const twice = withMat(() => buildGardenPlan(plants, brief));
    assert.deepEqual(once.layout?.mat, twice.layout?.mat);
    const offV2 = withMat(() => {
      (SEARCH as unknown as Bag).matModel = false;
      return buildGardenPlan(plants, brief);
    });
    assert.equal(once.engine?.z, offV2.engine?.z);
    const carpeters = new Set(once.layout?.mat?.chosenBySearch ?? []);
    const specimens = (plan: typeof once) =>
      plan.layout!.placements.filter((p) => !carpeters.has(p.plantId)).map((p) => `${p.plantId}@${p.xM},${p.yM}`);
    assert.deepEqual(specimens(once), specimens(offV2));
  }
});

test("options use different mat species where the pool allows", () => {
  const options = withMat(() => buildGardenPlanVariants(plants, BRIEFS[2]));
  const mats = options.map((plan) => (plan.layout?.mat?.species ?? []).map((s) => s.plantId));
  const all = mats.flat();
  assert.equal(new Set(all).size, all.length, JSON.stringify(mats));
});

