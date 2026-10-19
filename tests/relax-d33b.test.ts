// D33b final adjustments (owner prompt, 14 Oct 2026). Pins its own flags:
// D29b config (o) with relaxation variant v7 (the layout-v2f default) -
// power-diagram Lloyd steps, edge guard, size swaps, gap fill beside its
// own group and group cohesion; no short-plant clamp (v3), which breaks the B1223/B1172
// layering test.
import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import { KEEP_PLACED, LAYOUT_V2B, RELAX } from "../app/lib/planning/engineConfig.ts";
import { buildGardenPlanVariants, computeHeightTiers, computeSpreadBands, createRng, minCentreDistance, placeSelection, RULES, scorePlantStage1, speciesInfo, viewingAxis, type GardenBrief, type GardenPlan, type SpeciesInfo } from "../app/lib/planning/index.ts";
import { buildScenarios } from "../scripts/batch-test/scenarios.ts";

Object.assign(LAYOUT_V2B, { d29b: true, treeHard: true, curve: true, order: true, fill: true, driftSplit: false });
// v7 exactly: the later fills (v8 lastFill, v9 openFill - on by default
// since 19 Oct) are pinned off so these tests keep testing v7.
const V4 = { on: true, method: "lloyd" as const, edgeGuard: true, swaps: true, shortClamp: false, gapFill: true, cohesion: true, cohesionFill: true, lastFill: false, lastFillPool: false, openFill: false };

const S006 = buildScenarios().find((s) => s.id === "S006")!.brief;
const BRIEFS: [string, GardenBrief][] = [
  ["S006 mediterranean 12 x 8 m, east view", S006],
  ["fixed case", { biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none", viewingEdge: "south", sun: "part", water: "moist", bedWidthM: 6, bedLengthM: 2, style: "fynbos", colour: { mode: "none" }, extras: [] }],
  ["windy 8 x 2 m, east view", { biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "affected", viewingEdge: "east", sun: "full", water: "moderate", bedWidthM: 8, bedLengthM: 2, style: "undecided", colour: { mode: "none" }, extras: [] }],
];

function run(brief: GardenBrief, relax: Partial<typeof RELAX>): GardenPlan[] {
  const saved = { ...RELAX };
  Object.assign(RELAX, relax);
  try {
    return buildGardenPlanVariants(plants, brief);
  } finally {
    Object.assign(RELAX, saved);
  }
}

const tiers = computeHeightTiers(plants);
const spreads = computeSpreadBands(plants);
const maxAllowed = (id: string, area: number) => {
  const plant = plants.find((p) => p.id === id)!;
  return Math.max(...speciesInfo(plant, 0, tiers, spreads, area)!.allowedN);
};

test("D33b v7: same selection and Z, nothing outside the bed, nothing removed, every hard check holds", () => {
  let added = 0;
  for (const [label, brief] of BRIEFS) {
    const plain = run(brief, { on: false });
    const relaxed = run(brief, V4);
    assert.equal(relaxed.length, plain.length, `${label}: option count`);
    relaxed.forEach((plan, i) => {
      const where = `${label} ${plan.character}`;
      assert.equal(plan.engine?.z, plain[i].engine?.z, `${where}: Z changed`);
      const layout = plan.layout!;
      const W = layout.bedWidthM;
      const L = layout.bedLengthM;
      for (const p of layout.placements) {
        assert.ok(
          p.xM - p.radiusM >= -1e-6 && p.xM + p.radiusM <= W + 1e-6 && p.yM - p.radiusM >= -1e-6 && p.yM + p.radiusM <= L + 1e-6,
          `${where}: ${p.instanceId} is not fully inside the bed`,
        );
      }
      assert.ok(layout.placements.length >= plain[i].layout!.placements.length, `${where}: a plant was removed`);
      const counts = plan.diagnostics.filter((d) => d.startsWith("D33 counts:")).at(-1);
      assert.ok(counts && /removed=0/.test(counts), `${where}: ${counts}`);
      for (const check of plan.engine?.placementChecks.filter((c) => c.kind === "hard") ?? []) {
        assert.ok(check.pass, `${where} ${check.id}: ${check.detail}`);
      }
      added += layout.placements.length - plain[i].layout!.placements.length;
    });
  }
  assert.ok(added > 0, "the gap fill never added a plant on these briefs, so it was not exercised");
});

test("D33b v7 gap fill: only selected species, within H3 max and the H5 cap, and the planting list matches the drawing", () => {
  for (const [label, brief] of BRIEFS) {
    const area = brief.bedWidthM * brief.bedLengthM;
    const plain = run(brief, { on: false });
    for (const [i, plan] of run(brief, V4).entries()) {
      const where = `${label} ${plan.character}`;
      const before = new Map(plain[i].quantities!.quantities.map((q) => [q.id, q.quantity]));
      const drawn = new Map<string, number>();
      for (const p of plan.layout!.placements) drawn.set(p.plantId, (drawn.get(p.plantId) ?? 0) + 1);
      const listed = new Map(plan.quantities!.quantities.map((q) => [q.id, q.quantity]));
      assert.deepEqual([...listed].sort(), [...drawn].sort(), `${where}: planting list and drawing disagree`);
      const total = [...listed.values()].reduce((s, n) => s + n, 0);
      const h5 = Number(/<= ([\d.]+)/.exec(plan.engine!.hard.find((c) => c.id === "H5")!.limit)?.[1]);
      // v7: every added plant stands within cohesionMaxGapM of its own species.
      const ps = plan.layout!.placements;
      for (const p of ps.filter((q) => (q as { gapFill?: boolean }).gapFill)) {
        const gap = Math.min(...ps.filter((q) => q !== p && q.plantId === p.plantId).map((q) => Math.hypot(p.xM - q.xM, p.yM - q.yM) - p.radiusM - q.radiusM));
        assert.ok(gap <= RELAX.cohesionMaxGapM + 1e-6, `${where}: added ${p.instanceId} stands ${(gap * 100).toFixed(1)} cm from its group`);
      }
      for (const [id, n] of listed) {
        assert.ok(before.has(id), `${where}: ${id} is a new species`);
        if (n === before.get(id)) continue;
        assert.ok(n <= maxAllowed(id, area), `${where}: ${id} x${n} is over its H3 maximum`);
        assert.ok(n / total <= h5 + 1e-9, `${where}: ${id} share ${(n / total).toFixed(3)} is over the H5 cap ${h5}`);
      }
    }
  }
});

test("D33b v7 cohesion: no grouped plant ends further than max(10 cm, its gap as placed) from its nearest group-mate", () => {
  const gapToMate = (ps: readonly { plantId: string; xM: number; yM: number; radiusM: number }[], k: number) => {
    let best = Infinity;
    ps.forEach((q, j) => {
      if (j !== k && q.plantId === ps[k].plantId) best = Math.min(best, Math.hypot(ps[k].xM - q.xM, ps[k].yM - q.yM) - ps[k].radiusM - q.radiusM);
    });
    return best;
  };
  for (const [label, brief] of BRIEFS) {
    const plain = run(brief, { on: false });
    for (const [i, plan] of run(brief, { ...V4, gapFill: false }).entries()) {
      const before = plain[i].layout!.placements;
      const after = plan.layout!.placements;
      assert.equal(after.length, before.length);
      after.forEach((p, k) => {
        const limit = Math.max(RELAX.cohesionMaxGapM, gapToMate(before, k));
        if (!Number.isFinite(limit)) return; // a group of one
        assert.ok(gapToMate(after, k) <= limit + 1e-6, `${label} ${plan.character}: ${p.instanceId} is ${(gapToMate(after, k) * 100).toFixed(1)} cm from its nearest group-mate (limit ${(limit * 100).toFixed(1)} cm)`);
      });
    }
  }
});

// layout-v2g v8 (owner idea, 19 Oct 2026): the last-resort fill only adds.
for (const pool of [false, true]) {
  test(`layout-v2g v8${pool ? "b (with pool species)" : ""}: every v7 plant stays exactly where it was, Z unchanged, added plants within P2, inside the bed, hard checks hold, cover within cover_max`, () => {
    for (const [label, brief] of BRIEFS) {
      const v7 = run(brief, V4);
      for (const [i, plan] of run(brief, { ...V4, lastFill: true, lastFillPool: pool }).entries()) {
        const before = v7[i].layout!.placements;
        const after = plan.layout!.placements;
        assert.equal(plan.engine?.z, v7[i].engine?.z, `${label}: Z changed`);
        assert.ok(after.length >= before.length);
        before.forEach((p, k) => {
          assert.equal(after[k].instanceId, p.instanceId);
          assert.ok(Math.hypot(after[k].xM - p.xM, after[k].yM - p.yM) < 1e-9, `${label}: ${p.instanceId} moved`);
        });
        const W = brief.bedWidthM;
        const L = brief.bedLengthM;
        for (const p of after.slice(before.length)) {
          assert.ok(p.xM >= p.radiusM - 1e-6 && p.xM <= W - p.radiusM + 1e-6 && p.yM >= p.radiusM - 1e-6 && p.yM <= L - p.radiusM + 1e-6, `${label}: ${p.instanceId} outside the bed`);
          // A (owner, 19 Oct): added plants keep P2 like every other plant
          // (overlap up to overlap_delta of the smaller radius), not 0%.
          for (const q of after) if (q !== p) assert.ok(Math.hypot(p.xM - q.xM, p.yM - q.yM) >= minCentreDistance(p.radiusM, q.radiusM) - 1e-6, `${label}: ${p.instanceId} overlaps ${q.instanceId} beyond P2`);
          if (!pool) assert.ok(v7[i].layout!.placements.some((q) => q.plantId === p.plantId), `${label}: ${p.plantId} is a new species without lastFillPool`);
        }
        assert.ok((plan.engine?.placementChecks ?? []).every((c) => c.kind !== "hard" || c.pass), `${label}: a hard check failed`);
        assert.ok(plan.quantities!.usedCanopyAreaM2 <= plan.quantities!.usableCanopyAreaM2 + 1e-6, `${label}: over cover_max`);
      }
    }
  });
}

// layout-v2g v9h (owner, 19 Oct 2026): the open fill is on by default, and
// no plant it adds of h_back_min or taller may be centred in the front band.
test("layout-v2g v9: v7's plants stay put, Z unchanged, hard checks hold, and no added tall plant is centred in the front band", () => {
  const { hBackMin, edgeFrontMid } = RULES.stage4.heightBands;
  let added = 0;
  for (const [label, brief] of BRIEFS) {
    const v7 = run(brief, V4);
    for (const [i, plan] of run(brief, { ...V4, openFill: true }).entries()) {
      const where = `${label} ${plan.character}`;
      const before = v7[i].layout!.placements;
      const after = plan.layout!.placements;
      assert.equal(plan.engine?.z, v7[i].engine?.z, `${where}: Z changed`);
      assert.ok(after.length >= before.length, `${where}: a plant was removed`);
      before.forEach((p, k) => {
        assert.equal(after[k].instanceId, p.instanceId, `${where}: order changed`);
        assert.ok(Math.hypot(after[k].xM - p.xM, after[k].yM - p.yM) < 1e-9, `${where}: ${p.instanceId} moved`);
      });
      const axis = viewingAxis(brief.viewingEdge, plan.layout!.bedWidthM, plan.layout!.bedLengthM);
      for (const p of after.slice(before.length)) {
        added += 1;
        const h = plants.find((x) => x.id === p.plantId)!.heightCm ?? 0;
        if (h >= hBackMin) {
          assert.ok(axis.depthOf(p.xM, p.yM) >= edgeFrontMid * axis.span - 1e-6, `${where}: added ${p.instanceId} (${h} cm) is centred in the front band`);
        }
      }
      assert.ok((plan.engine?.placementChecks ?? []).every((c) => c.kind !== "hard" || c.pass), `${where}: a hard check failed`);
    }
  }
  assert.ok(added > 0, "the open fill added nothing on these briefs, so it was not exercised");
});

// layout-v2g v9c (owner, 19 Oct 2026): limits on what the open fill adds.
test("layout-v2g v9c: at most 7 new species per layout, and no added plant narrower than 30 cm", () => {
  const V9C = { ...V4, openFill: true, openFillMaxNewSpecies: 7, openFillMinSpreadM: 0.3, openFillFallback: false };
  let added = 0;
  for (const [label, brief] of BRIEFS) {
    const v7 = run(brief, V4);
    for (const [i, plan] of run(brief, V9C).entries()) {
      const where = `${label} ${plan.character}`;
      const planned = new Set(v7[i].quantities!.quantities.map((q) => q.id));
      const newSpecies = plan.quantities!.quantities.filter((q) => !planned.has(q.id)).length;
      assert.ok(newSpecies <= 7, `${where}: ${newSpecies} new species`);
      for (const p of plan.layout!.placements.slice(v7[i].layout!.placements.length)) {
        added += 1;
        assert.ok(2 * p.radiusM >= 0.3 - 1e-9, `${where}: added ${p.instanceId} is ${(200 * p.radiusM).toFixed(0)} cm across`);
      }
      assert.equal(plan.engine?.z, v7[i].engine?.z, `${where}: Z changed`);
    }
  }
  assert.ok(added > 0, "the open fill added nothing on these briefs, so v9c was not exercised");
});

// layout-v2g v10 (owner, 19 Oct 2026): keep what fits.
test("layout-v2g v10: a species with no room left is left out and the rest kept (KEEP_PLACED); off, the layout fails as before", () => {
  const tiers = computeHeightTiers(plants);
  const spreads = computeSpreadBands(plants);
  const brief: GardenBrief = { ...BRIEFS[1][1], bedWidthM: 8, bedLengthM: 2, viewingEdge: "south" };
  const info = (id: string) => {
    const plant = plants.find((p) => p.id === id)!;
    return speciesInfo(plant, scorePlantStage1(plant, { brief, savedPlantIds: [] }).score, tiers, spreads, 16) as SpeciesInfo;
  };
  // Three groups of about 2 m across cannot all fit on an 8 x 2 m bed.
  const big = plants
    .filter((p) => p.spreadCm !== null && p.spreadCm >= 180 && p.spreadCm <= 200 && p.heightCm !== null && p.heightCm < 300)
    .map((p) => info(p.id))
    .filter((x) => x && !x.feature && x.layer !== "L2" && x.allowedN.includes(3))
    .slice(0, 3);
  const small = plants
    .filter((p) => p.spreadCm !== null && p.spreadCm >= 30 && p.spreadCm <= 50 && p.heightCm !== null && p.heightCm < 40)
    .map((p) => info(p.id))
    .filter((x) => x && !x.feature && x.layer !== "L2" && x.allowedN.includes(3))
    .slice(0, 2);
  assert.equal(big.length, 3);
  assert.equal(small.length, 2);
  const infos = new Map([...big, ...small].map((x) => [x.id, x]));
  const selection = new Map([...infos.keys()].map((id) => [id, 3]));
  const site = { widthM: 8, depthM: 2, windSite: 0, rowsAvailable: 1, frontEdge: "south" as const };
  const saved = KEEP_PLACED.on;
  try {
    KEEP_PLACED.on = false;
    assert.equal(placeSelection(selection, infos, site, createRng("v10")).status, "failed");
    KEEP_PLACED.on = true;
    const result = placeSelection(selection, infos, site, createRng("v10"));
    assert.equal(result.status, "complete");
    assert.ok((result.skipped ?? []).length > 0, "nothing was left out, so the test bed is not over-full");
    for (const id of result.skipped ?? []) {
      assert.ok(!result.realised.has(id), `${id} is still in realised`);
      assert.ok(result.layout.diagnostics.some((d) => d.startsWith(`KP: ${id} left out`)), `${id}: no KP line`);
      assert.ok(!result.layout.placements.some((p) => p.plantId === id), `${id} is still drawn`);
    }
    const ps = result.layout.placements;
    for (let i = 0; i < ps.length; i += 1) {
      for (let j = i + 1; j < ps.length; j += 1) {
        assert.ok(Math.hypot(ps[i].xM - ps[j].xM, ps[i].yM - ps[j].yM) >= minCentreDistance(ps[i].radiusM, ps[j].radiusM) - 1e-6, `${ps[i].instanceId} overlaps ${ps[j].instanceId}`);
      }
    }
    for (const check of result.checks.filter((c) => c.kind === "hard")) assert.ok(check.pass, `${check.id}: ${check.detail}`);
  } finally {
    KEEP_PLACED.on = saved;
  }
});

// A and B (owner, 19 Oct 2026).
test("A: added plants may overlap their neighbours, but never beyond P2; B: single new-species plants only with openFillSingles", () => {
  const V9C = { ...V4, openFill: true, openFillMaxNewSpecies: 7, openFillMinSpreadM: 0.3, openFillFallback: false, addedOverlap: true };
  let overlaps = 0;
  for (const [label, brief] of BRIEFS) {
    const v7 = run(brief, { ...V4, addedOverlap: true });
    for (const singles of [false, true]) {
      for (const [i, plan] of run(brief, { ...V9C, openFillSingles: singles }).entries()) {
        const where = `${label} ${plan.character} (singles ${singles})`;
        const ps = plan.layout!.placements;
        for (const p of ps.filter((q) => (q as { gapFill?: boolean }).gapFill)) {
          for (const q of ps) {
            if (q === p) continue;
            const d = Math.hypot(p.xM - q.xM, p.yM - q.yM);
            assert.ok(d >= minCentreDistance(p.radiusM, q.radiusM) - 1e-6, `${where}: ${p.instanceId} overlaps ${q.instanceId} beyond P2`);
            if (d < p.radiusM + q.radiusM - 1e-6) overlaps += 1;
          }
        }
        assert.equal(plan.engine?.z, v7[i].engine?.z, `${where}: Z changed`);
        assert.ok((plan.engine?.placementChecks ?? []).every((c) => c.kind !== "hard" || c.pass), `${where}: a hard check failed`);
        const singleLines = plan.diagnostics.filter((d) => d.includes("single (B)"));
        if (!singles) assert.equal(singleLines.length, 0, `${where}: a single new-species plant without openFillSingles`);
      }
    }
  }
  assert.ok(overlaps > 0, "no added plant overlapped a neighbour, so A was not exercised");
});
