// layout-v2b (owner prompt, 14 Oct 2026): D29b relative height gradient.
// Pins its own flags - config (o): gradient, tree rule, curve, placement
// order and fill - so it tests that configuration whatever the defaults.
import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import { LAYOUT_V2B } from "../app/lib/planning/engineConfig.ts";
import {
  buildGardenPlanVariants,
  computeHeightTiers,
  computeSpreadBands,
  createRng,
  placeSelection,
  RULES,
  scorePlantStage1,
  speciesInfo,
  viewingAxis,
  type GardenBrief,
  type SpeciesInfo,
} from "../app/lib/planning/index.ts";

Object.assign(LAYOUT_V2B, { d29b: true, treeHard: true, curve: true, order: true, fill: true, driftSplit: false });

const edgeFrontMid = RULES.stage4.heightBands.edgeFrontMid;
const byId = new Map(plants.map((p) => [p.id, p]));
const base: Omit<GardenBrief, "wind" | "viewingEdge"> = {
  biomes: ["Fynbos"],
  bioregion: "Southwest Fynbos Bioregion",
  soil: "sandy",
  sun: "full",
  water: "moderate",
  bedWidthM: 8,
  bedLengthM: 6,
  style: "fynbos",
  colour: { mode: "none" },
  extras: [],
};

test("D29b: B1223 (2 m) and B1172 (1 m) stand behind the short plants, from every viewing edge", () => {
  const tiers = computeHeightTiers(plants);
  const spreads = computeSpreadBands(plants);
  const short = plants
    .filter((p) => p.heightCm !== null && p.heightCm < 30 && p.spreadCm !== null && p.spreadCm >= 30 && p.spreadCm <= 60)
    .slice(0, 2)
    .map((p) => p.id);
  assert.equal(short.length, 2);
  for (const edge of ["north", "east", "south", "west"] as const) {
    const brief: GardenBrief = { ...base, viewingEdge: edge, wind: "none", water: "moist", style: "undecided" };
    const infos = new Map<string, SpeciesInfo>();
    for (const id of ["B1223", "B1172", ...short]) {
      const plant = byId.get(id);
      assert.ok(plant, `${id} is not in the catalogue`);
      const info = speciesInfo(plant, scorePlantStage1(plant, { brief, savedPlantIds: [] }).score, tiers, spreads, 48);
      assert.ok(info, `${id}: no species info`);
      infos.set(id, info);
    }
    const selection = new Map<string, number>([["B1223", 3], ["B1172", 1], ...short.map((id) => [id, 3] as [string, number])]);
    const result = placeSelection(selection, infos, { widthM: 8, depthM: 6, windSite: 0, rowsAvailable: 0, frontEdge: edge }, createRng(`b1223-${edge}`));
    const axis = viewingAxis(edge, 8, 6);
    const meanDepth = (ids: string[]) => {
      const xs = result.layout.placements.filter((p) => ids.includes(p.plantId)).map((p) => axis.depthOf(p.xM, p.yM) / axis.span);
      assert.ok(xs.length > 0, `${edge}: ${ids.join(", ")} not placed`);
      return xs.reduce((s, x) => s + x, 0) / xs.length;
    };
    const shortDepth = meanDepth(short);
    for (const id of ["B1223", "B1172"]) {
      const d = meanDepth([id]);
      assert.ok(d > shortDepth, `${edge}: ${id} at ${d.toFixed(2)} is not behind the short plants (${shortDepth.toFixed(2)})`);
      assert.ok(d >= edgeFrontMid, `${edge}: ${id} at ${d.toFixed(2)} sits in the front ${edgeFrontMid}`);
    }
    // The taller of the two stands further back (the gradient is relative).
    assert.ok(meanDepth(["B1223"]) > meanDepth(["B1172"]), `${edge}: B1223 should stand behind B1172`);
  }
});

test("D24 (b), east view, option 1: tall plants behind short ones (fails on engine-final)", () => {
  const plan = buildGardenPlanVariants(plants, { ...base, wind: "affected", viewingEdge: "east" })[0];
  const layout = plan.layout;
  assert.ok(layout, "no layout");
  const axis = viewingAxis("east", layout.bedWidthM, layout.bedLengthM);
  const mean = (pick: (h: number) => boolean) => {
    const xs = layout.placements.filter((p) => {
      const h = byId.get(p.plantId)?.heightCm;
      return h != null && pick(h);
    });
    return xs.reduce((s, p) => s + axis.depthOf(p.xM, p.yM), 0) / xs.length;
  };
  const tall = mean((h) => h >= 100);
  const short = mean((h) => h < 50);
  assert.ok(tall > short, `tall ${tall.toFixed(2)} m, short ${short.toFixed(2)} m from the viewer`);
});

test("D29b tree rule: no tree centred in front of band_edge_front_mid (d_eff), and the check is reported", () => {
  // Briefs that bring trees in: windy and calm, deep and shallow, all edges.
  let trees = 0;
  for (const edge of ["north", "east", "south", "west"] as const) {
    for (const [wind, W, L] of [["none", 8, 6], ["affected", 8, 6], ["affected", 8, 2]] as const) {
      for (const plan of buildGardenPlanVariants(plants, { ...base, style: "mediterranean", wind, viewingEdge: edge, bedWidthM: W, bedLengthM: L })) {
        if (!plan.layout) continue;
        const check = plan.engine?.placementChecks.find((c) => c.id === "D29b-tree");
        assert.ok(check, `${edge} ${wind} ${W}x${L} ${plan.character}: no D29b-tree check`);
        assert.ok(check.pass, `${edge} ${wind} ${W}x${L} ${plan.character}: ${check.detail}`);
        trees += plan.layout.placements.filter((p) => (byId.get(p.plantId)?.plantType ?? []).includes("tree")).length;
      }
    }
  }
  assert.ok(trees > 0, "no tree was placed in any of these briefs, so the rule was not exercised");
});

test("D29b: the soft gradient never excludes a plant - every hard placement check passes on the regression-style briefs", () => {
  for (const edge of ["north", "east", "south", "west"] as const) {
    for (const plan of buildGardenPlanVariants(plants, { ...base, wind: "none", viewingEdge: edge, bedWidthM: 6, bedLengthM: 2, sun: "part", water: "moist" })) {
      assert.equal(plan.status, "provisional-plan", `${edge}: ${plan.diagnostics.join(" | ")}`);
      for (const check of plan.engine?.placementChecks.filter((c) => c.kind === "hard") ?? []) {
        assert.ok(check.pass, `${edge} ${plan.character} ${check.id}: ${check.detail}`);
      }
    }
  }
});
