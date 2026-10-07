/**
 * Two checks on the rulebook's own arithmetic.
 *
 * 1. CAPACITY. For each bed size, the most planted cover the rules can
 *    possibly reach, against the cover_min each style demands. The bound
 *    is Sum(n_i * a_i) <= S_max * max_b(n_allowed(b) * a_max(b)), taking
 *    the real catalogue's largest canopy in each spread band. It ignores
 *    geometry (P1/P2), so it is an upper bound: if cover_min is above it,
 *    no arrangement whatsoever can satisfy H1.
 *
 * 2. ANNEALING. What simulated annealing actually contributes, read from
 *    the search trace the engine already records (greedyZ -> improvedZ ->
 *    annealedZ -> finalZ), plus how fast the temperature collapses.
 *
 * Run: npm run study:capacity
 */

import { plants } from "../app/data/plants.ts";
import {
  bandFor,
  buildGardenPlanVariants,
  computeSpreadBands,
  MIN_LAYOUT_CANOPY_DIAMETER_M,
  RULES,
  type GardenBrief,
} from "../app/lib/planning/index.ts";

const styles = ["fynbos", "mediterranean", "cottage", "generic"] as const;

// --------------------------------------------------------------- 1. capacity
function capacity(): void {
  const bands = computeSpreadBands(plants);
  const bandIndex = (spreadCm: number) =>
    spreadCm <= bands.p33 ? 0 : spreadCm <= bands.p67 ? 1 : 2;

  // The engine only ever considers a species whose canopy is at least
  // MIN_LAYOUT_CANOPY_DIAMETER_M across and no wider than the bed's short
  // side, so the bound must obey both or it is meaningless.
  const usable = plants.filter(
    (p) => p.layoutEligible && p.spreadCm !== null && p.spreadCm / 100 >= MIN_LAYOUT_CANOPY_DIAMETER_M,
  );

  console.log("1. CAPACITY - can the rules reach cover_min at all?");
  console.log("");
  console.log("  Spread bands: p33 " + bands.p33 + " cm, p67 " + bands.p67 + " cm");
  console.log("  Group sizes by band: " + JSON.stringify(RULES.stage2.groupSizes));
  console.log("  Only species at least " + MIN_LAYOUT_CANOPY_DIAMETER_M + " m across and no wider than the bed count.");
  console.log("  H5 note: with S equal groups each share is 1/S and r_max_eff = MAX(r_max, " +
    RULES.stage2.kHeadroom + "/S) >= 1/S, so H5 never caps the total.");
  console.log("");

  const beds: [number, number][] = [
    [1, 1], [2, 3], [4, 3], [6, 4], [10, 5], [10, 10], [20, 20], [30, 30],
  ];

  console.log("    bed        area   S_max  widest fits  max cover   " + styles.map((x) => x.slice(0, 6).padEnd(9)).join(""));
  console.log("    " + "-".repeat(66 + styles.length * 9));
  for (const [W, L] of beds) {
    const area = W * L;
    const band = bandFor(area);
    const shortSide = Math.min(W, L);
    const fits = usable.filter((p) => (p.spreadCm as number) / 100 <= shortSide);
    if (fits.length === 0) {
      console.log("    " + (W + "x" + L).padEnd(11) + String(area).padEnd(7) + String(band.sMax).padEnd(7) + "no species fits");
      continue;
    }
    // Best a single species can contribute: its canopy area times the
    // largest group its spread band allows.
    let perSpecies = 0;
    let widest = 0;
    for (const p of fits) {
      const spread = p.spreadCm as number;
      const areaEach = Math.PI * (spread / 200) ** 2;
      const maxN = Math.max(...RULES.stage2.groupSizes[bandIndex(spread)]);
      perSpecies = Math.max(perSpecies, areaEach * maxN);
      widest = Math.max(widest, spread);
    }
    const maxCover = (band.sMax * perSpecies) / area;
    const verdicts = styles.map((style) => {
      const need = RULES.styles[style].coverMin;
      return ((maxCover >= need ? "ok " : "NO ") + need.toFixed(2)).padEnd(9);
    });
    console.log(
      "    " + (W + "x" + L).padEnd(11) + String(area).padEnd(7) + String(band.sMax).padEnd(7) +
      (widest + " cm").padEnd(13) + (maxCover * 100).toFixed(0).padStart(5) + "%      " + verdicts.join(""),
    );
  }

  // The floor on the smallest beds: S_min species at the smallest group.
  const smallest = RULES.stage2.speciesBands[0];
  const minGroup = Math.min(...RULES.stage2.groupSizes.flat().filter((n) => n > 1));
  const smallestCanopy = Math.PI * (MIN_LAYOUT_CANOPY_DIAMETER_M / 2) ** 2;
  const floorPlants = smallest.sMin * minGroup;
  console.log("");
  console.log("  FLOOR on a small bed: band 1 asks for at least " + smallest.sMin +
    " species, and the smallest non-feature group is " + minGroup + ",");
  console.log("  so at least " + floorPlants + " plants. At the smallest canopy the engine accepts (" +
    MIN_LAYOUT_CANOPY_DIAMETER_M + " m across, " + smallestCanopy.toFixed(4) + " m2) that is " +
    (floorPlants * smallestCanopy).toFixed(2) + " m2,");
  console.log("  which on a 1 x 1 m bed is " + ((floorPlants * smallestCanopy) * 100).toFixed(0) +
    "% cover - against a cover_min of " + (RULES.styles.fynbos.coverMin * 100).toFixed(0) + "-" +
    (RULES.styles.cottage.coverMin * 100).toFixed(0) + "%.");
  console.log("");
  console.log("  NOTE: N_min = " + RULES.stage2.nMin + " is the minimum POOL (species surviving Stage 0),");
  console.log("  not plants in a bed. A 1 x 1 m bed is never asked to hold 15 plants; it is asked");
  console.log("  for " + smallest.sMin + "-" + smallest.sMax + " species.");
}

// -------------------------------------------------------------- 2. annealing
function annealing(): void {
  console.log("\n\n2. ANNEALING - what does it actually contribute?\n");
  const alpha = RULES.stage3.alpha;
  const iterations = RULES.stage3.iterations;
  const frozenAt = Math.log(0.01) / Math.log(alpha);
  console.log(`  alpha ${alpha}, ${iterations} iterations.`);
  console.log(`  T falls to 1% of T0 after ${frozenAt.toFixed(0)} iterations, so ${(100 * (1 - frozenAt / iterations)).toFixed(1)}% of the run is effectively frozen.`);
  console.log(`  alpha^${iterations} = ${Math.pow(alpha, iterations).toExponential(1)} - the last iterations are pure hill-climbing.\n`);

  const base: GardenBrief = {
    biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy",
    wind: "none", viewingEdge: "north", sun: "full", water: "moderate",
    bedWidthM: 6, bedLengthM: 4, style: "fynbos", colour: { mode: "none" }, extras: [],
  };
  const briefs: [string, GardenBrief][] = [
    ["fynbos 6x4", base],
    ["mediterranean 8x5", { ...base, style: "mediterranean", water: "low", soil: "loam", wind: "affected", bedWidthM: 8, bedLengthM: 5 }],
    ["cottage 5x3", { ...base, style: "cottage", sun: "part", soil: "loam", bedWidthM: 5, bedLengthM: 3 }],
    ["generic 4x2", { ...base, style: "undecided", sun: "sheltered", water: "moist", soil: "clay", bedWidthM: 4, bedLengthM: 2 }],
    ["fynbos 12x8", { ...base, sun: "part", soil: "not-sure", wind: "affected", bedWidthM: 12, bedLengthM: 8 }],
  ];

  console.log("  brief                greedyZ  improvedZ  annealedZ  finalZ   gain(anneal)  worse-moves  T0");
  const gains: number[] = [];
  let improvedCount = 0;
  let total = 0;
  for (const [label, brief] of briefs) {
    for (const plan of buildGardenPlanVariants(plants, brief)) {
      const t = plan.engine?.search;
      if (!t) continue;
      const gain = t.annealedZ - t.improvedZ;
      gains.push(gain);
      total += 1;
      if (gain > 1e-9) improvedCount += 1;
      console.log(
        `  ${label.padEnd(20)} ${t.greedyZ.toFixed(4)}   ${t.improvedZ.toFixed(4)}     ${t.annealedZ.toFixed(4)}     ${t.finalZ.toFixed(4)}   ${gain >= 0 ? "+" : ""}${gain.toFixed(4)}        ${String(t.acceptedWorse).padStart(3)}          ${t.t0.toFixed(4)}`,
      );
    }
  }
  const mean = gains.reduce((a, b) => a + b, 0) / gains.length;
  console.log(
    `\n  Across ${total} runs: annealing improved Z in ${improvedCount}/${total} (${((improvedCount / total) * 100).toFixed(0)}%),\n` +
      `  mean gain ${mean >= 0 ? "+" : ""}${mean.toFixed(5)}, best ${Math.max(...gains).toFixed(4)}, worst ${Math.min(...gains).toFixed(4)}.`,
  );
  console.log(
    "\n  Read with care: annealedZ is the BEST Z the annealing pass saw, so it can only\n" +
      "  equal or beat improvedZ. A gain of 0 means the pass found nothing the local\n" +
      "  improvement had not already found.",
  );
}

capacity();
annealing();
