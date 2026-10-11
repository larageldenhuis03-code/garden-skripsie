/**
 * Two saved briefs, fingerprinted. Run before and after a UI change: the
 * plans must be byte-identical, which is how a layout task proves it did
 * not touch the engine.
 *
 * Run: node --experimental-strip-types scripts/brief-fingerprint.ts
 */
import { createHash } from "node:crypto";
import { plants } from "../app/data/plants.ts";
import { buildGardenPlanVariants, type GardenBrief } from "../app/lib/planning/index.ts";

const BRIEFS: { name: string; brief: GardenBrief }[] = [
  {
    name: "A  Stellenbosch fynbos 6 x 4, warm, pollinators",
    brief: {
      biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy",
      wind: "affected", viewingEdge: "north", sun: "full", water: "moderate",
      bedWidthM: 6, bedLengthM: 4, style: "fynbos",
      colour: { mode: "scheme", scheme: "warm" }, extras: ["pollinators", "fragrance"],
    },
  },
  {
    name: "B  Cottage 10 x 6 clay, part shade, birds",
    brief: {
      biomes: ["Fynbos"], bioregion: "Southern Fynbos Bioregion", soil: "clay",
      wind: "none", viewingEdge: "south", sun: "part", water: "moist",
      bedWidthM: 10, bedLengthM: 6, style: "cottage",
      colour: { mode: "none" }, extras: ["wildlife"],
    },
  },
];

for (const { name, brief } of BRIEFS) {
  const variants = buildGardenPlanVariants(plants, brief);
  const shape = variants.map((v) => ({
    character: v.character,
    seed: v.seed,
    status: v.status,
    z: v.engine?.z ?? null,
    species: (v.quantities?.quantities ?? []).map((q) => `${q.id}x${q.quantity}`),
    placements: (v.layout?.placements ?? []).map(
      (p) => `${p.plantId}@${p.xM.toFixed(4)},${p.yM.toFixed(4)}r${p.radiusM.toFixed(4)}`,
    ),
  }));
  const digest = createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 16);
  const first = shape[0];
  console.log(
    `${name}\n  seed ${first?.seed}  Z ${first?.z?.toFixed(4)}  ` +
      `${first?.species.length} species  ${first?.placements.length} plants  ` +
      `| fingerprint ${digest}`,
  );
}
