/**
 * Stage 4 depth bands: the current single band against a per-layer rule.
 *
 * OLD is what the engine does today: a plant's depth is drawn within
 * v_target +/- depth_tol, with depth_tol = 0.10 for every layer
 * (app/lib/planning/stage4.ts, `choose`, via RULES.stage4.depthTol).
 *
 * NEW is a candidate rule, NOT currently implemented anywhere in the
 * engine or the rulebook:
 *
 *   band_width_Lx = MIN(band_max, MAX(band_min_Lx,
 *                       A_x / (W * L * fill_target)))
 *
 * with A_x the total canopy area of that layer's plants, centred on
 * v_target and slid inward if it runs past 0 or 1. Both rules are fed to
 * the SAME placer through `PlacementSite.bands`, so what is compared is
 * the band rule and nothing else.
 *
 * Note on the brief: it wrote the denominator as "bed_length * L *
 * fill_target". Taken literally that squares the length. It is read here
 * as bed WIDTH x bed LENGTH, which is what makes band_width a fraction of
 * depth and matches metric 2's own denominator (band width * L * W).
 *
 * Held constant per bed: the species and group sizes (chosen once, before
 * either rule runs), the seed, and every placement rule - P1 and P2 are
 * enforced inside the placer and re-checked here independently.
 *
 * Run: npm run study:bands
 * Writes: scripts/band_eval.csv
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { plants } from "../app/data/plants.ts";
import {
  computeHeightTiers,
  computeSpreadBands,
  createRng,
  engineSite,
  minCentreDistance,
  placeSelection,
  RULES,
  runEngine,
  scorePlantStage1,
  speciesInfo,
  survivesHardFilters,
  targetDepth,
  windProfile,
  type GardenBrief,
  type Selection,
  type SpeciesInfo,
} from "../app/lib/planning/index.ts";
import type { LayerId } from "../app/lib/planning/rules.ts";

// ---------------------------------------------------------------- setup
const BANDED_LAYERS: LayerId[] = ["L1", "L4", "L5", "L6"];
/** Swept uniformly across the four banded layers. */
const BAND_MINS = [0.2, 0.25, 0.3, 0.35, 0.4];
/** The first run's per-layer floors, retained as a variant so that
 * per-layer and uniform can be compared on the SAME selection. */
const FIRST_RUN_MINS: Record<string, number> = { L1: 0.4, L4: 0.55, L5: 0.45, L6: 0.4 };
const BAND_MAX = 0.6;
const FILL_TARGET = 0.8;
/** Two styles so L4 and L5 actually receive plants. */
const STYLES = ["mediterranean", "cottage"] as const;
const OLD_TOL = RULES.stage4.depthTol; // 0.10, the half-width used today
const SEEDS = 10;
const BEDS: [number, number][] = [
  [6, 2.4], [6, 3.6], [6, 6.0],
  [10, 2.4], [10, 3.6], [10, 6.0],
];

const baseBrief: GardenBrief = {
  biomes: ["Fynbos"],
  bioregion: "Southwest Fynbos Bioregion",
  soil: "sandy",
  // Wind affected, so rows_available decides the profile and the deep /
  // shallow switch at L = 3.6 actually fires (FLOOR(L / 1.2) = 2, 3, 5).
  wind: "affected",
  viewingEdge: "north",
  sun: "full",
  water: "low",
  bedWidthM: 6,
  bedLengthM: 2.4,
  style: "mediterranean",
  colour: { mode: "none" },
  extras: [],
};

/** The NEW band for one layer: width from its canopy area, then centred
 * on the target and slid inward so it stays inside [0, 1]. */
function newBand(bandMin: number, areaM2: number, W: number, L: number, target: number) {
  const width = Math.min(BAND_MAX, Math.max(bandMin, areaM2 / (W * L * FILL_TARGET)));
  let lo = target - width / 2;
  let hi = target + width / 2;
  if (lo < 0) { hi -= lo; lo = 0; }
  if (hi > 1) { lo -= hi - 1; hi = 1; }
  return { lo: Math.max(0, lo), hi: Math.min(1, hi), width: hi - lo };
}

// -------------------------------------------------------------- metrics
type Placed = { plantId: string; xM: number; yM: number; radiusM: number };

/** 1. Share of ten equal depth slices holding at least one plant centre. */
function depthCoverage(placed: Placed[], L: number): number {
  const hit = new Set<number>();
  for (const p of placed) hit.add(Math.min(9, Math.floor((p.yM / L) * 10)));
  return hit.size / 10;
}

/** 2. Canopy area of a layer over the area its band covers. */
function bandOccupancy(areaM2: number, bandWidth: number, W: number, L: number): number {
  return bandWidth <= 0 ? 0 : areaM2 / (bandWidth * L * W);
}

/** 3. Radius of the largest circle fitting between the plants, on a 5 cm
 * grid: for each free point the distance to the nearest canopy edge. */
function largestEmptyRadius(placed: Placed[], W: number, L: number): number {
  const step = 0.05;
  let best = 0;
  for (let x = 0; x <= W + 1e-9; x += step) {
    for (let y = 0; y <= L + 1e-9; y += step) {
      let clearance = Math.min(x, W - x, y, L - y);
      if (clearance <= best) continue;
      for (const p of placed) {
        clearance = Math.min(clearance, Math.hypot(p.xM - x, p.yM - y) - p.radiusM);
        if (clearance <= best) break;
      }
      if (clearance > best) best = clearance;
    }
  }
  return Math.max(0, best);
}

/** 4. P1 and P2, recomputed here rather than trusting the placer. */
function violations(placed: Placed[], W: number, L: number) {
  const offenders: string[] = [];
  let p1 = 0;
  let p2 = 0;
  for (const p of placed) {
    if (p.xM - p.radiusM < -1e-6 || p.xM + p.radiusM > W + 1e-6 ||
        p.yM - p.radiusM < -1e-6 || p.yM + p.radiusM > L + 1e-6) {
      p1 += 1;
      offenders.push(`P1:${p.plantId}`);
    }
  }
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      if (Math.hypot(a.xM - b.xM, a.yM - b.yM) < minCentreDistance(a.radiusM, b.radiusM) - 1e-6) {
        p2 += 1;
        offenders.push(`P2:${a.plantId}/${b.plantId}`);
      }
    }
  }
  return { p1, p2, offenders };
}

// ------------------------------------------------------------- the runs
type Row = {
  style: string; bed_W: number; bed_L: number; variant: string; band_min: string;
  seeds: number; plants_placed: number; plants_requested: number;
  depth_coverage_mean: number; depth_coverage_min: number; depth_coverage_max: number; depth_coverage_sd: number;
  plants_placed_min: number; plants_placed_max: number; plants_placed_sd: number;
  occ_L1: number; occ_L4: number; occ_L5: number; occ_L6: number;
  largest_empty_radius_mean: number; largest_empty_radius_max: number;
  spacing_violations: number; species_dropped: string;
};

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

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** Population standard deviation across the seeds. */
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / xs.length);
};
const pad = (text: string, width: number) => text.padEnd(width);

function main(): void {
  const rows: Row[] = [];
  const traceLines: string[] = [];

  for (const style of STYLES) {
    for (const [W, L] of BEDS) {
      const brief: GardenBrief = { ...baseBrief, style, bedWidthM: W, bedLengthM: L };
      const site = engineSite(brief);
      const pool = poolFor(brief);
      const infos = new Map(pool.map((info) => [info.id, info]));

      // One selection per (style, bed), fixed before any band rule runs,
      // so every variant places exactly the same plants.
      const chosen = runEngine(pool, site, "bands-" + style + "-" + W + "x" + L);
      if (chosen.status !== "plan") {
        traceLines.push(style + " " + W + " x " + L + ": no feasible selection, skipped");
        continue;
      }
      const selection: Selection = chosen.selection;
      const requested = [...selection.values()].reduce((sum, n) => sum + n, 0);
      const profile = windProfile(site);

      const layerArea = new Map<LayerId, number>();
      for (const [id, n] of selection) {
        const info = infos.get(id) as SpeciesInfo;
        layerArea.set(info.layer, (layerArea.get(info.layer) ?? 0) + info.areaM2 * n);
      }
      const present = BANDED_LAYERS.filter((layer) => (layerArea.get(layer) ?? 0) > 0);
      traceLines.push(
        pad(style, 14) + pad(W + " x " + L + " m", 11) + "rows " + site.rowsAvailable +
        " | " + pad(profile, 9) + " | " + requested + " plants, " + selection.size +
        " species | banded layers present: " + (present.join(", ") || "none"),
      );

      const variants: { label: string; mins: Record<string, number> | null }[] = [
        { label: "OLD", mins: null },
        ...BAND_MINS.map((bandMin) => ({
          label: "min=" + bandMin.toFixed(2),
          mins: Object.fromEntries(BANDED_LAYERS.map((layer) => [layer, bandMin])),
        })),
        { label: "per-layer", mins: FIRST_RUN_MINS },
      ];

      for (const variant of variants) {
        const widths: Partial<Record<LayerId, number>> = {};
        const bandsOverride: Partial<Record<LayerId, { lo: number; hi: number }>> = {};
        for (const layer of BANDED_LAYERS) {
          const target = targetDepth(layer, profile);
          if (target === null) continue;
          if (variant.mins === null) {
            widths[layer] = 2 * OLD_TOL;
          } else {
            const band = newBand(variant.mins[layer] ?? 0, layerArea.get(layer) ?? 0, W, L, target);
            bandsOverride[layer] = { lo: band.lo, hi: band.hi };
            widths[layer] = band.width;
          }
        }

        const coverage: number[] = [];
        const empties: number[] = [];
        const occ: Record<string, number[]> = { L1: [], L4: [], L5: [], L6: [] };
        const placedPerSeed: number[] = [];
        let placedTotal = 0;
        let breaches = 0;
        const dropped = new Set<string>();

        for (let seed = 0; seed < SEEDS; seed += 1) {
          // Same seed across every variant: only the band rule differs.
          const rng = createRng("band-eval-" + style + "-" + W + "x" + L + "-" + seed);
          const runSite = variant.mins === null ? site : { ...site, bands: bandsOverride };
          const result = placeSelection(selection, infos, runSite, rng);
          const placed = result.layout.placements as Placed[];
          placedTotal += placed.length;
          placedPerSeed.push(placed.length);
          coverage.push(depthCoverage(placed, L));
          empties.push(largestEmptyRadius(placed, W, L));
          const v = violations(placed, W, L);
          breaches += v.p1 + v.p2;
          if (result.failedSpeciesId) dropped.add(result.failedSpeciesId);
          for (const [id, n] of selection) {
            if ((result.realised.get(id) ?? 0) < n) dropped.add(id + "(shrunk)");
          }
          for (const layer of BANDED_LAYERS) {
            const area = placed
              .filter((p) => infos.get(p.plantId)?.layer === layer)
              .reduce((sum, p) => sum + Math.PI * p.radiusM ** 2, 0);
            occ[layer].push(bandOccupancy(area, widths[layer] ?? 0, W, L));
          }
        }

        rows.push({
          style, bed_W: W, bed_L: L, variant: variant.label,
          band_min: variant.mins === null ? "-" : variant.label.replace("min=", ""),
          seeds: SEEDS,
          plants_placed: Number((placedTotal / SEEDS).toFixed(1)),
          plants_requested: requested,
          depth_coverage_mean: Number(mean(coverage).toFixed(3)),
          depth_coverage_min: Number(Math.min(...coverage).toFixed(3)),
          depth_coverage_max: Number(Math.max(...coverage).toFixed(3)),
          depth_coverage_sd: Number(sd(coverage).toFixed(3)),
          plants_placed_min: Math.min(...placedPerSeed),
          plants_placed_max: Math.max(...placedPerSeed),
          plants_placed_sd: Number(sd(placedPerSeed).toFixed(2)),
          occ_L1: Number(mean(occ.L1).toFixed(3)),
          occ_L4: Number(mean(occ.L4).toFixed(3)),
          occ_L5: Number(mean(occ.L5).toFixed(3)),
          occ_L6: Number(mean(occ.L6).toFixed(3)),
          largest_empty_radius_mean: Number(mean(empties).toFixed(3)),
          largest_empty_radius_max: Number(Math.max(...empties).toFixed(3)),
          spacing_violations: breaches,
          species_dropped: [...dropped].join("; ") || "none",
        });
      }
    }
  }

  // ------------------------------------------------------------- output
  const outPath = join(dirname(fileURLToPath(import.meta.url)), "band_eval.csv");
  const headers = Object.keys(rows[0]) as (keyof Row)[];
  const csvLines = [headers.join(",")];
  for (const row of rows) {
    csvLines.push(headers.map((h) => {
      const value = String(row[h]);
      return /[",]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    }).join(","));
  }
  writeFileSync(outPath, csvLines.join(String.fromCharCode(10)), "utf8");

  console.log("Stage 4 depth bands: band_min sweep against the current single band");
  console.log("");
  console.log("PARAMETERS USED");
  console.log("  OLD     depth_tol = " + OLD_TOL + " (half-width), band width " + 2 * OLD_TOL + "  [RULES.stage4.depthTol]");
  console.log("  SWEPT   band_min = " + BAND_MINS.join(", ") + ", applied to " + BANDED_LAYERS.join(", "));
  console.log("  FIXED   band_max " + BAND_MAX + " | fill_target " + FILL_TARGET);
  console.log("  layer depths v* = " + JSON.stringify(RULES.stage4.depth) + " | row_pitch " + RULES.stage4.rowPitchM + " m | P2 delta " + RULES.stage4.overlapDelta);
  console.log("  " + STYLES.length + " styles x " + BEDS.length + " beds x " + (BAND_MINS.length + 1) + " variants x " + SEEDS + " seeds = " + (STYLES.length * BEDS.length * (BAND_MINS.length + 1) * SEEDS) + " runs | wind " + baseBrief.wind);
  console.log("");
  console.log("WHERE EACH NUMBER COMES FROM");
  console.log("  band applied        app/lib/planning/stage4.ts  placeSelection -> placeOnce -> choose (PlacementSite.bands)");
  console.log("  NEW band formula    scripts/band_eval.ts        newBand()");
  console.log("  depth_coverage      scripts/band_eval.ts        depthCoverage()");
  console.log("  band_occupancy      scripts/band_eval.ts        bandOccupancy()");
  console.log("  largest_empty       scripts/band_eval.ts        largestEmptyRadius()  (5 cm grid)");
  console.log("  P1 / P2 violations  scripts/band_eval.ts        violations()  (minCentreDistance from stage4.ts)");
  console.log("");
  console.log("SELECTIONS");
  for (const line of traceLines) console.log("  " + line);

  console.log("");
  console.log("RESULTS");
  console.log("  " + pad("style", 14) + pad("bed", 10) + pad("variant", 10) + pad("placed/req", 11) +
    pad("cov", 6) + pad("covmin", 8) + pad("occL1", 7) + pad("occL4", 7) + pad("occL5", 7) +
    pad("occL6", 7) + pad("empty", 7) + pad("emax", 7) + pad("viol", 5));
  for (const row of rows) {
    console.log("  " +
      pad(row.style, 14) +
      pad(row.bed_W + "x" + row.bed_L, 10) +
      pad(row.variant, 10) +
      pad(row.plants_placed + "/" + row.plants_requested, 11) +
      pad(row.depth_coverage_mean.toFixed(2), 6) +
      pad(row.depth_coverage_min.toFixed(2), 8) +
      pad(row.occ_L1.toFixed(2), 7) +
      pad(row.occ_L4.toFixed(2), 7) +
      pad(row.occ_L5.toFixed(2), 7) +
      pad(row.occ_L6.toFixed(2), 7) +
      pad(row.largest_empty_radius_mean.toFixed(2), 7) +
      pad(row.largest_empty_radius_max.toFixed(2), 7) +
      pad(String(row.spacing_violations), 6) +
      pad(row.plants_placed_min + "-" + row.plants_placed_max + " (" + row.plants_placed_sd + ")", 22) +
      pad(row.depth_coverage_sd.toFixed(2), 7));
  }

  // ------------------------------------------------------------ verdict
  console.log("");
  console.log("WHICH band_min KEEPS OLD'S PLANT COUNT AND HOLDS occ_L1 AT OR BELOW 1.0");
  const keys = [...new Set(rows.map((r) => r.style + "|" + r.bed_W + "x" + r.bed_L))];
  for (const bandMin of BAND_MINS) {
    const label = bandMin.toFixed(2);
    let keepsCount = 0;
    let occOk = 0;
    let worstLoss = 0;
    let worstOcc = 0;
    for (const key of keys) {
      const old = rows.find((r) => r.style + "|" + r.bed_W + "x" + r.bed_L === key && r.variant === "OLD");
      const now = rows.find((r) => r.style + "|" + r.bed_W + "x" + r.bed_L === key && r.variant === "min=" + label);
      if (!old || !now) continue;
      const loss = old.plants_placed - now.plants_placed;
      if (loss <= 0.05) keepsCount += 1;
      worstLoss = Math.max(worstLoss, loss);
      if (now.occ_L1 <= 1.0) occOk += 1;
      worstOcc = Math.max(worstOcc, now.occ_L1);
    }
    const both = keepsCount === keys.length && occOk === keys.length ? "   <- BOTH MET" : "";
    console.log("  band_min " + label + ": keeps OLD's count in " + keepsCount + "/" + keys.length +
      " beds (worst loss " + worstLoss.toFixed(1) + " plants) | occ_L1 <= 1.0 in " + occOk + "/" +
      keys.length + " (worst " + worstOcc.toFixed(2) + ")" + both);
  }
  const oldWorstOcc = Math.max(...rows.filter((r) => r.variant === "OLD").map((r) => r.occ_L1));
  console.log("  for reference, OLD's worst occ_L1 is " + oldWorstOcc.toFixed(2));
  console.log("");
  console.log("Written to " + outPath);
}

main();
