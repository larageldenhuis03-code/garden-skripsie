// D33 final relaxation pass (owner prompt, 14 Oct 2026). Pins its own
// flags so it tests the pass itself, on the engine-final layout (D29b off)
// and on D29b + curve (config (n)).
import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import { LAYOUT_V2B, RELAX } from "../app/lib/planning/engineConfig.ts";
import { largestEmptyPatchOf } from "../app/lib/planning/relax.ts";
import { buildGardenPlanVariants, minCentreDistance, type GardenBrief, type GardenPlan } from "../app/lib/planning/index.ts";
import { largestEmptyPatch, plantedCells } from "../scripts/batch-test/metrics.ts";

const byId = new Map(plants.map((p) => [p.id, p]));
const BRIEFS: [string, GardenBrief][] = [
  ["fixed case", { biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none", viewingEdge: "south", sun: "part", water: "moist", bedWidthM: 6, bedLengthM: 2, style: "fynbos", colour: { mode: "none" }, extras: [] }],
  ["windy 8 x 2 m, east view", { biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "affected", viewingEdge: "east", sun: "full", water: "moderate", bedWidthM: 8, bedLengthM: 2, style: "undecided", colour: { mode: "none" }, extras: [] }],
  ["mediterranean 12 x 8 m, north view", { biomes: ["Fynbos", "Succulent Karoo"], bioregion: "Karoo Renosterveld Bioregion", soil: "loam", wind: "affected", viewingEdge: "north", sun: "full", water: "moderate", bedWidthM: 12, bedLengthM: 8, style: "mediterranean", colour: { mode: "none" }, extras: [] }],
];
const CONFIGS: [string, Partial<typeof LAYOUT_V2B>][] = [
  ["engine-final", { d29b: false, treeHard: false, curve: false, order: false, fill: false, driftSplit: false }],
  ["D29b + curve", { d29b: true, treeHard: true, curve: true, order: false, fill: true, driftSplit: false }],
];

function run(brief: GardenBrief, relax: boolean): GardenPlan[] {
  RELAX.on = relax;
  try {
    return buildGardenPlanVariants(plants, brief);
  } finally {
    RELAX.on = false;
  }
}

test("D33: the relax pass's patch measure is the batch metric's", () => {
  Object.assign(LAYOUT_V2B, CONFIGS[1][1]);
  for (const [, brief] of BRIEFS) {
    for (const plan of run(brief, false)) {
      const l = plan.layout!;
      const mine = largestEmptyPatchOf(l.placements.map((p) => ({ x: p.xM, y: p.yM, r: p.radiusM })), l.bedWidthM, l.bedLengthM);
      assert.equal(mine, largestEmptyPatch(plantedCells(l.placements, l.bedWidthM, l.bedLengthM)));
    }
  }
});

for (const [name, flags] of CONFIGS) {
  test(`D33 on ${name}: same plants and Z, every check holds, fixed plants stay, accepted only when the gap shrinks`, () => {
    Object.assign(LAYOUT_V2B, flags);
    let accepted = 0;
    for (const [label, brief] of BRIEFS) {
      const plain = run(brief, false);
      const relaxed = run(brief, true);
      assert.equal(relaxed.length, plain.length, `${label}: option count`);
      relaxed.forEach((plan, i) => {
        const before = plain[i];
        const where = `${label} ${plan.character}`;
        // Moves plants only: the same species, sizes and Z.
        assert.equal(plan.engine?.z, before.engine?.z, `${where}: Z changed`);
        assert.deepEqual(plan.quantities?.quantities.map((q) => `${q.id}x${q.quantity}`), before.quantities?.quantities.map((q) => `${q.id}x${q.quantity}`), `${where}: selection changed`);
        const a = plan.layout!;
        const b = before.layout!;
        for (const check of plan.engine?.placementChecks.filter((c) => c.kind === "hard") ?? []) {
          assert.ok(check.pass, `${where} ${check.id}: ${check.detail}`);
        }
        const line = plan.diagnostics.filter((d) => d.startsWith("D33 relax:")).at(-1);
        assert.ok(line, `${where}: no D33 log line`);
        const moved = a.placements.some((p, k) => p.xM !== b.placements[k].xM || p.yM !== b.placements[k].yM);
        if (line.includes("accepted")) {
          accepted += 1;
          const [, from, to] = /patch ([\d.]+) -> ([\d.]+)/.exec(line) ?? [];
          assert.ok(Number(to) < Number(from), `${where}: accepted without a smaller gap (${from} -> ${to})`);
        } else {
          assert.ok(!moved, `${where}: rejected, yet plants moved`);
        }
        a.placements.forEach((p, k) => {
          const q = b.placements[k];
          assert.equal(p.plantId, q.plantId);
          const info = byId.get(p.plantId);
          // Feature plant and windbreak row never move.
          if ((p as { windbreakRow?: boolean }).windbreakRow) assert.ok(p.xM === q.xM && p.yM === q.yM, `${where}: windbreak ${p.instanceId} moved`);
          if (info && (p as { layer?: string }).layer === "L2") {
            // A climber that had a host still touches it.
            const hosted = (list: typeof a.placements, c: typeof p) =>
              list.some((h) => (h as { layer?: string }).layer === "L1" && Math.hypot(h.xM - c.xM, h.yM - c.yM) <= minCentreDistance(h.radiusM, c.radiusM) + 1e-3);
            if (hosted(b.placements, q)) assert.ok(hosted(a.placements, p), `${where}: climber ${p.instanceId} left its host`);
          }
        });
      });
    }
    // The pass is not a no-op on these briefs (at least one plan relaxes).
    if (name === "D29b + curve") assert.ok(accepted > 0, "no plan was relaxed");
  });
}
