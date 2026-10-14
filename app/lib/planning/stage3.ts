import { shuffle, type SpeciesInfo } from "./engineData.ts";
import { RULES } from "./rules.ts";
import { T0_WORSE_FRACTION } from "./engineConfig.ts";
import {
  canFormWindbreak,
  SelectionState,
  stateFrom,
  type EngineSite,
  type Selection,
} from "./stage2.ts";

/**
 * Stage 3 - search for the species mix with the highest Z
 * (6_Stage3_4_Rules rows 6-10):
 *
 *   1. Greedy start: repeatedly add the (species, n_i) that raises Z the
 *      most while the constraints hold.
 *   2. Local improvement: add, remove, resize, or swap one species (a swap
 *      only between species whose heights are within height_swap_tolerance,
 *      R-HEIG-003); accept a move only if Z improves.
 *   3. Simulated annealing from T0 with cooling rate alpha for a fixed
 *      number of iterations, keeping the best selection seen; local
 *      improvement is then re-run on that best.
 *
 * The run is reproducible from its seed. Every search state satisfies H1,
 * the H2 ceiling, H3 (sizes are drawn only from each species' allowed
 * list), H4 and H5; the H2 floor and the P3 windbreak species are
 * completion conditions the greedy start works towards and no later move
 * may break.
 */

export type SearchTrace = {
  greedyZ: number;
  improvedZ: number;
  annealedZ: number;
  finalZ: number;
  t0: number;
  t0Source: "rulebook" | "derived";
  iterations: number;
  acceptedWorse: number;
};

export type SearchResult =
  | { status: "found"; selection: Selection; z: number; trace: SearchTrace }
  | { status: "infeasible"; reason: string };

type Move = { apply: () => void; undo: () => void };

function makeSet(state: SelectionState, info: SpeciesInfo, n: number): Move {
  const had = state.has(info.id);
  const before = had ? (state.counts.get(info.id) as number) : 0;
  return {
    apply: () => state.set(info, n),
    undo: () => (had ? state.set(info, before) : state.remove(info.id)),
  };
}

function makeRemove(state: SelectionState, id: string): Move {
  const info = state.info(id);
  const before = state.counts.get(id) as number;
  return { apply: () => state.remove(id), undo: () => state.set(info, before) };
}

function makeSwap(state: SelectionState, outId: string, incoming: SpeciesInfo, n: number): Move {
  const outInfo = state.info(outId);
  const outN = state.counts.get(outId) as number;
  return {
    apply: () => {
      state.remove(outId);
      state.set(incoming, n);
    },
    undo: () => {
      state.remove(incoming.id);
      state.set(outInfo, outN);
    },
  };
}

/** Tries a move; keeps it applied and returns the new Z if it is valid,
 * otherwise undoes it and returns null. */
function tryMove(state: SelectionState, move: Move, requireComplete: boolean): number | null {
  move.apply();
  if (state.withinLimits() && (!requireComplete || state.complete())) {
    return state.z();
  }
  move.undo();
  return null;
}

/** The same n if allowed for the incoming species, else its nearest
 * allowed size. */
function nearestAllowed(info: SpeciesInfo, n: number): number {
  return info.allowedN.reduce((best, size) =>
    Math.abs(size - n) < Math.abs(best - n) ? size : best,
  );
}

function withinHeightTolerance(left: SpeciesInfo, right: SpeciesInfo): boolean {
  const tolerance = RULES.stage3.heightSwapTolerance;
  return Math.abs(left.heightCm - right.heightCm) <= tolerance * left.heightCm;
}

/** True if the selection can still be completed (H2 floor, P3 windbreak
 * species) by adding the smallest groups that fit, smallest first. Used as
 * a look-ahead so the greedy start never takes a step that makes the
 * floor unreachable. Leaves the state unchanged. */
function completable(state: SelectionState, bySmallest: readonly SpeciesInfo[]): boolean {
  if (state.complete()) return true;
  const added: string[] = [];
  const needsWindbreak = () => state.site.windbreakRequired && state.windbreakSpecies === 0;
  for (const pass of [true, false]) {
    for (const info of bySmallest) {
      if (state.complete()) break;
      if (state.has(info.id)) continue;
      if (pass && !(needsWindbreak() && canFormWindbreak(info))) continue;
      state.set(info, Math.min(...info.allowedN));
      if (state.withinLimits()) added.push(info.id);
      else state.remove(info.id);
    }
  }
  const ok = state.complete();
  for (const id of added) state.remove(id);
  return ok;
}

function greedyStart(state: SelectionState, pool: readonly SpeciesInfo[]): void {
  const bySmallest = [...pool].sort(
    (left, right) =>
      left.areaM2 * Math.min(...left.allowedN) - right.areaM2 * Math.min(...right.allowedN),
  );
  const leavesRoom = () => completable(state, bySmallest);
  while (state.speciesCount < state.site.sMax) {
    const current = state.complete() ? state.z() : -Infinity;
    // Until the H2 floor is reached each species enters at its smallest
    // allowed group: H5's cap tightens as species are added (k / S), so an
    // early large group could otherwise make the floor unreachable. Groups
    // grow afterwards through the resize move.
    const building = state.speciesCount < state.site.sMin;
    const ranked: { info: SpeciesInfo; n: number; rank: number; z: number }[] = [];
    for (const info of pool) {
      if (state.has(info.id)) continue;
      for (const n of building ? [Math.min(...info.allowedN)] : info.allowedN) {
        const move = makeSet(state, info, n);
        const z = tryMove(state, move, false);
        if (z === null) continue;
        // While incomplete, additions that complete the selection rank first.
        const rank = z + (state.complete() ? 1 : 0);
        move.undo();
        ranked.push({ info, n, rank, z });
      }
    }
    ranked.sort((left, right) => right.rank - left.rank);
    // Take the best addition that keeps the selection completable (the
    // look-ahead only runs down the ranking until one passes).
    let chosen: (typeof ranked)[number] | null = null;
    for (const candidate of ranked) {
      state.set(candidate.info, candidate.n);
      const ok = leavesRoom();
      state.remove(candidate.info.id);
      if (ok) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) return;
    // Once complete, stop when no feasible addition improves Z.
    if (state.complete() && chosen.z <= current + 1e-12) return;
    state.set(chosen.info, chosen.n);
  }
}

/** First-improvement local search over add / remove / resize / swap, in a
 * seeded order, until a full pass finds nothing better. */
function localImprovement(
  state: SelectionState,
  pool: readonly SpeciesInfo[],
  rng: () => number,
): void {
  const MAX_PASSES = 40;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let current = state.z();
    let improved = false;
    const selected = shuffle([...state.counts.keys()], rng);

    const consider = (move: Move) => {
      const z = tryMove(state, move, true);
      if (z === null) return;
      if (z > current + 1e-12) {
        current = z;
        improved = true;
      } else {
        move.undo();
      }
    };

    for (const id of selected) {
      if (!state.has(id)) continue;
      consider(makeRemove(state, id));
      if (!state.has(id)) continue;
      const info = state.info(id);
      for (const n of info.allowedN) {
        if (!state.has(id) || n === state.counts.get(id)) continue;
        consider(makeSet(state, info, n));
      }
    }
    for (const info of shuffle(pool, rng)) {
      if (state.has(info.id)) continue;
      for (const n of info.allowedN) {
        if (state.has(info.id)) break;
        consider(makeSet(state, info, n));
      }
      for (const outId of [...state.counts.keys()]) {
        if (state.has(info.id) || !state.has(outId)) break;
        const outInfo = state.info(outId);
        if (!withinHeightTolerance(outInfo, info)) continue;
        const n = nearestAllowed(info, state.counts.get(outId) as number);
        consider(makeSwap(state, outId, info, n));
      }
    }
    if (!improved) return;
  }
}

function randomMove(
  state: SelectionState,
  pool: readonly SpeciesInfo[],
  rng: () => number,
): Move | null {
  const selected = [...state.counts.keys()];
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const kind = Math.floor(rng() * 4);
  if (kind === 0 || selected.length === 0) {
    const info = pick(pool);
    if (state.has(info.id)) return null;
    return makeSet(state, info, pick(info.allowedN));
  }
  const id = pick(selected);
  if (kind === 1) return makeRemove(state, id);
  const info = state.info(id);
  if (kind === 2) {
    const n = pick(info.allowedN);
    return n === state.counts.get(id) ? null : makeSet(state, info, n);
  }
  const candidates = pool.filter(
    (other) => !state.has(other.id) && withinHeightTolerance(info, other),
  );
  if (candidates.length === 0) return null;
  const incoming = pick(candidates);
  return makeSwap(state, id, incoming, nearestAllowed(incoming, state.counts.get(id) as number));
}

export function searchSelection(
  pool: readonly SpeciesInfo[],
  site: EngineSite,
  rng: () => number,
): SearchResult {
  if (pool.length === 0) {
    return { status: "infeasible", reason: "No plants are available to choose from." };
  }
  const infos = new Map(pool.map((info) => [info.id, info]));
  // Seeded order: ties between equally good plants are broken by the seed,
  // which is what makes Regenerate produce a different garden.
  const ordered = shuffle(pool, rng);

  const state = new SelectionState(site);
  greedyStart(state, ordered);
  if (!state.complete()) {
    const reasons = [];
    if (state.speciesCount < site.sMin) {
      reasons.push(
        `only ${state.speciesCount} species fit together, and this bed size needs at least ${site.sMin}`,
      );
    }
    if (site.windbreakRequired && state.windbreakSpecies === 0) {
      reasons.push("no hedge or tall species fits to form the windward row");
    }
    return { status: "infeasible", reason: `No feasible mix: ${reasons.join("; ")}.` };
  }
  const greedyZ = state.z();

  localImprovement(state, ordered, rng);
  const improvedZ = state.z();

  // Simulated annealing. T0 "to tune" in the rulebook: set so that a move
  // making Z about 5% worse is accepted roughly half the time at the start,
  // i.e. exp(-0.05 Z / T0) = 0.5.
  const { alpha, iterations } = RULES.stage3;
  const t0Source = RULES.stage3.t0 === null ? "derived" : "rulebook";
  const t0 = RULES.stage3.t0 ?? Math.max(1e-6, (T0_WORSE_FRACTION * improvedZ) / Math.LN2);
  let temperature = t0;
  let currentZ = improvedZ;
  let best: Selection = state.snapshot();
  let bestZ = improvedZ;
  let acceptedWorse = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const move = randomMove(state, ordered, rng);
    if (move) {
      const z = tryMove(state, move, true);
      if (z !== null) {
        const delta = z - currentZ;
        if (delta >= 0 || rng() < Math.exp(delta / temperature)) {
          if (delta < 0) acceptedWorse += 1;
          currentZ = z;
          if (z > bestZ + 1e-12) {
            bestZ = z;
            best = state.snapshot();
          }
        } else {
          move.undo();
        }
      }
    }
    temperature *= alpha;
  }
  const annealedZ = bestZ;

  const finalState = stateFrom(best, infos, site);
  localImprovement(finalState, ordered, rng);
  const finalZ = finalState.z();

  return {
    status: "found",
    selection: finalState.snapshot(),
    z: finalZ,
    trace: {
      greedyZ,
      improvedZ,
      annealedZ,
      finalZ,
      t0,
      t0Source,
      iterations,
      acceptedWorse,
    },
  };
}
