/**
 * Diagnostic only: for one brief, print every placed group with its
 * layer, height, where the depth rule wanted it and where it actually
 * went - measured both from the edge the gardener said they stand on and
 * from the north edge the rulebook assumes.
 *
 * It answers "why is that tall plant at the front?" from the engine's own
 * output rather than from the picture. It reads the plan and changes
 * nothing.
 *
 * Run: node --experimental-strip-types scripts/depth-probe.ts
 */
import { plants } from "../app/data/plants.ts";
import { buildGardenPlanVariants, type GardenBrief } from "../app/lib/planning/index.ts";
import { viewingAxis, targetDepth, windProfile } from "../app/lib/planning/stage4.ts";
import {
  speciesInfo,
  computeHeightTiers,
  computeSpreadBands,
} from "../app/lib/planning/engineData.ts";

const brief: GardenBrief = {
  biomes: ["Forest", "Fynbos"],
  bioregion: "Eastern Fynbos-Renosterveld Bioregion",
  soil: "clay",
  wind: "none",
  viewingEdge: "west",
  sun: "part",
  water: "moist",
  bedWidthM: 5.5,
  bedLengthM: 3,
  style: "undecided",
  colour: { mode: "none" },
  extras: [],
};

const byId = new Map(plants.map((p) => [p.id, p]));
const short = (n: string) => n.split(/[;(]/)[0].trim().slice(0, 30);
const tiers = computeHeightTiers(plants);
const bands = computeSpreadBands(plants);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

for (const [index, plan] of buildGardenPlanVariants(plants, brief).entries()) {
  const layout = plan.layout;
  if (!layout) {
    console.log(`\nOPTION ${index + 1}: no layout`);
    continue;
  }
  const W = layout.bedWidthM;
  const L = layout.bedLengthM;
  const west = viewingAxis(brief.viewingEdge, W, L);
  const north = viewingAxis("north", W, L);
  const profile = windProfile({
    windSite: 0,
    rowsAvailable: Math.floor(L / 1.2 + 1e-9),
  } as never);
  console.log(`\nOPTION ${index + 1} (${plan.character})  bed ${W} x ${L} m, profile ${profile}`);
  console.log(
    "  layer  height   wanted      actual, from WEST (she stands here)   actual, from NORTH   plant",
  );

  const groups = new Map<string, { xM: number; yM: number }[]>();
  for (const p of layout.placements) {
    groups.set(p.plantId, [...(groups.get(p.plantId) ?? []), { xM: p.xM, yM: p.yM }]);
  }
  const rows = [...groups.entries()].flatMap(([id, pts]) => {
    const plant = byId.get(id);
    if (!plant) return [];
    const info = speciesInfo(plant, 0, tiers, bands, W * L);
    if (!info) return [];
    return [{
      plant,
      info,
      fromWest: mean(pts.map((p) => west.depthOf(p.xM, p.yM))),
      fromNorth: mean(pts.map((p) => north.depthOf(p.xM, p.yM))),
      n: pts.length,
    }];
  });
  rows.sort((a, b) => b.plant.heightCm! - a.plant.heightCm!);
  for (const r of rows) {
    const t = targetDepth(r.info.layer, profile);
    console.log(
      [
        `  ${r.info.layer}`,
        `${String(r.plant.heightCm).padStart(4)}cm`,
        t === null ? "  anywhere" : `${(t * west.span).toFixed(2)} m W / ${(t * north.span).toFixed(2)} m N`,
        `${r.fromWest.toFixed(2)} m`.padStart(22),
        `${r.fromNorth.toFixed(2)} m`.padStart(20),
        ` ${short(r.plant.commonName)}`,
      ].join("  "),
    );
  }
}
