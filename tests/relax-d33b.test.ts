// D33b final adjustments (owner prompt, 14 Oct 2026). Pins its own flags:
// D29b config (o) with relaxation variant v7 (the layout-v2f default) -
// power-diagram Lloyd steps, edge guard, size swaps, gap fill beside its
// own group and group cohesion; no short-plant clamp (v3), which breaks the B1223/B1172
// layering test.
import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import { LAYOUT_V2B, RELAX } from "../app/lib/planning/engineConfig.ts";
import { buildGardenPlanVariants, computeHeightTiers, computeSpreadBands, speciesInfo, type GardenBrief, type GardenPlan } from "../app/lib/planning/index.ts";
import { buildScenarios } from "../scripts/batch-test/scenarios.ts";

Object.assign(LAYOUT_V2B, { d29b: true, treeHard: true, curve: true, order: true, fill: true, driftSplit: false });
const V4 = { on: true, method: "lloyd" as const, edgeGuard: true, swaps: true, shortClamp: false, gapFill: true, cohesion: true, cohesionFill: true };

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
  test(`layout-v2g v8${pool ? "b (with pool species)" : ""}: every v7 plant stays exactly where it was, Z unchanged, added plants touch nothing, inside the bed, hard checks hold, cover within cover_max`, () => {
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
          for (const q of after) if (q !== p) assert.ok(Math.hypot(p.xM - q.xM, p.yM - q.yM) >= p.radiusM + q.radiusM - 1e-6, `${label}: ${p.instanceId} touches ${q.instanceId}`);
          if (!pool) assert.ok(v7[i].layout!.placements.some((q) => q.plantId === p.plantId), `${label}: ${p.plantId} is a new species without lastFillPool`);
        }
        assert.ok((plan.engine?.placementChecks ?? []).every((c) => c.kind !== "hard" || c.pass), `${label}: a hard check failed`);
        assert.ok(plan.quantities!.usedCanopyAreaM2 <= plan.quantities!.usableCanopyAreaM2 + 1e-6, `${label}: over cover_max`);
      }
    }
  });
}
