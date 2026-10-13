/**
 * Per-plan measurements carried over from the coverage test (branch
 * coverage-test, scripts/coverage-test.ts): the neighbour-pair metric and
 * the binding-limit classification. Measurement only - nothing here feeds
 * the engine.
 */

import { plants } from "../../app/data/plants.ts";
import {
  bandFor,
  computeHeightTiers,
  computeSpreadBands,
  speciesInfo,
  type GardenPlan,
} from "../../app/lib/planning/index.ts";
import COMBOS from "./combos.json" with { type: "json" };

/**
 * The one combination rule the rulebook states for Stage 4: "Members of
 * the same combo are placed as neighbours within their layer"
 * (8_Species_Reference B23), recorded there as NOT IMPLEMENTED. This
 * measures how often it happens anyway. The combo library is read from
 * the workbook into combos.json for measurement; the engine never sees it.
 */
const COMBO_BY_PLANT = (() => {
  const byName = new Map(
    plants.map((plant) => [plant.scientificName.toLowerCase().trim(), plant.id]),
  );
  const membership = new Map<string, Set<string>>();
  for (const combo of COMBOS.combos) {
    for (const name of combo.species) {
      const id = byName.get(name.toLowerCase().trim());
      if (!id) continue;
      const set = membership.get(id) ?? new Set<string>();
      set.add(combo.id);
      membership.set(id, set);
    }
  }
  return membership;
})();

/** Two plants count as neighbours when their canopy edges are within half
 * a metre of each other (or touching). */
const NEIGHBOUR_GAP_M = 0.5;

export function neighbourPairs(layout: {
  placements: { plantId: string; xM: number; yM: number; radiusM: number }[];
}): { pairs: number; sameCombo: number; bothInACombo: number } {
  let pairs = 0;
  let sameCombo = 0;
  let bothInACombo = 0;
  const list = layout.placements;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a.plantId === b.plantId) continue;
      const gap = Math.hypot(a.xM - b.xM, a.yM - b.yM) - a.radiusM - b.radiusM;
      if (gap > NEIGHBOUR_GAP_M) continue;
      pairs += 1;
      const ca = COMBO_BY_PLANT.get(a.plantId);
      const cb = COMBO_BY_PLANT.get(b.plantId);
      if (!ca || !cb) continue;
      bothInACombo += 1;
      for (const id of ca) {
        if (cb.has(id)) {
          sameCombo += 1;
          break;
        }
      }
    }
  }
  return { pairs, sameCombo, bothInACombo };
}

export type Limit = "count" | "placement" | "pool" | "-";
export type PoolReason = "exhausted" | "stopped early" | "-";

const tiers = computeHeightTiers(plants);
const spreads = computeSpreadBands(plants);
const byId = new Map(plants.map((plant) => [plant.id, plant]));

/**
 * Why a plan did not reach its target cover.
 *
 *   count      even at the largest group size H3 allows for each species
 *              it has chosen, the canopy could not add up to the target;
 *   placement  it selected enough canopy, but Stage 4 could not get it
 *              into the bed;
 *   pool       it is using fewer species than H2 would allow.
 *
 * Tested in that order, first match wins; the raw flags are returned too
 * so overlaps stay visible. `poolReason` separates a pool that ran out of
 * candidates from a search that stopped before using them.
 */
export function bindingLimit(
  plan: GardenPlan,
  target: number,
): {
  limit: Limit;
  count: boolean;
  placement: boolean;
  pool: boolean;
  sMax: number;
  poolReason: PoolReason;
} {
  const layout = plan.layout;
  const groups = plan.quantities?.quantities ?? [];
  if (!layout || groups.length === 0) {
    return { limit: "-", count: false, placement: false, pool: false, sMax: 0, poolReason: "-" };
  }
  const bedArea = layout.bedWidthM * layout.bedLengthM;
  const needed = target * bedArea;
  let maxArea = 0;
  let selectedArea = 0;
  for (const group of groups) {
    const plant = byId.get(group.id);
    if (!plant) continue;
    const info = speciesInfo(plant, 0, tiers, spreads, bedArea);
    if (!info) continue;
    maxArea += Math.max(...info.allowedN) * info.areaM2;
    selectedArea += group.quantity * info.areaM2;
  }
  const { sMax } = bandFor(bedArea);
  const count = maxArea < needed - 1e-9;
  const placement = selectedArea >= needed - 1e-9;
  const pool = groups.length < sMax;
  const limit: Limit = count ? "count" : placement ? "placement" : pool ? "pool" : "-";
  const poolReason: PoolReason = !pool
    ? "-"
    : plan.counts.candidate < sMax
      ? "exhausted"
      : "stopped early";
  return { limit, count, placement, pool, sMax, poolReason };
}
