/**
 * What "cover" means in this engine, measured.
 *
 * H1, A4, the batch runner's over-planted check and the plan's open-space
 * figure all use the SUM of canopy circle areas. P2 lets circles overlap
 * by delta x min(r_i, r_j), so that sum is not the ground actually
 * covered. This prints both for a spread of briefs:
 *
 *   nominal = SUM(pi r^2) / (W x L)        <- what every rule uses
 *   true    = union of the circles / (W x L)  <- what a gardener sees
 *
 * Read-only: it plans each brief and measures the result.
 *
 * Run: node --experimental-strip-types scripts/cover-audit.ts
 */
import { plants } from "../app/data/plants.ts";
import { buildGardenPlanVariants, type GardenBrief } from "../app/lib/planning/index.ts";
import { RULES } from "../app/lib/planning/rules.ts";

const BASE: GardenBrief = {
  biomes: ["Fynbos"],
  bioregion: "Southwest Fynbos Bioregion",
  soil: "sandy",
  wind: "none",
  viewingEdge: "north",
  sun: "full",
  water: "moderate",
  bedWidthM: 6,
  bedLengthM: 4,
  style: "fynbos",
  colour: { mode: "none" },
  extras: [],
};

/** Union area by a fine grid: a cell counts if its centre is inside any circle. */
function unionCover(
  placements: { xM: number; yM: number; radiusM: number }[],
  W: number,
  L: number,
  n = 600,
): number {
  const cols = n;
  const rows = Math.max(1, Math.round((n * L) / W));
  let inside = 0;
  for (let j = 0; j < rows; j += 1) {
    const y = ((j + 0.5) / rows) * L;
    for (let i = 0; i < cols; i += 1) {
      const x = ((i + 0.5) / cols) * W;
      for (const p of placements) {
        const dx = x - p.xM;
        const dy = y - p.yM;
        if (dx * dx + dy * dy <= p.radiusM * p.radiusM) { inside += 1; break; }
      }
    }
  }
  return inside / (cols * rows);
}

const CASES: { label: string; brief: GardenBrief }[] = [
  { label: "2 x 1.5 m fynbos", brief: { ...BASE, bedWidthM: 2, bedLengthM: 1.5 } },
  { label: "6 x 4 m fynbos", brief: { ...BASE } },
  { label: "6 x 3 m mediterranean", brief: { ...BASE, bedWidthM: 6, bedLengthM: 3, style: "mediterranean" } },
  { label: "10 x 6 m cottage", brief: { ...BASE, bedWidthM: 10, bedLengthM: 6, style: "cottage", soil: "clay", sun: "part", water: "moist" } },
  { label: "20 x 10 m generic", brief: { ...BASE, bedWidthM: 20, bedLengthM: 10, style: "undecided" } },
];

console.log("rulebook cover bands:");
for (const [k, v] of Object.entries(RULES.styles)) {
  console.log(`  ${k.padEnd(14)} cover_min ${v.coverMin}  cover_max ${v.coverMax}`);
}
console.log("");
console.log(
  ["case", "opt", "nominal", "true", "nominal/true", "H1 cap", "binds at 1.0?"].join("\t"),
);
for (const { label, brief } of CASES) {
  const variants = buildGardenPlanVariants(plants, brief);
  for (const [i, plan] of variants.entries()) {
    const layout = plan.layout;
    if (!layout) { console.log(`${label}\t${i + 1}\tno layout`); continue; }
    const W = layout.bedWidthM;
    const L = layout.bedLengthM;
    const nominal = layout.canopyAreaM2 / (W * L);
    const real = unionCover(layout.placements, W, L);
    const styleKey = brief.style === "undecided" ? "generic" : brief.style;
    const cap = (RULES.styles as Record<string, { coverMax: number }>)[styleKey].coverMax;
    console.log(
      [
        label,
        i + 1,
        nominal.toFixed(3),
        real.toFixed(3),
        (nominal / real).toFixed(2),
        cap,
        nominal > 1 ? "YES" : "no",
      ].join("\t"),
    );
  }
}
