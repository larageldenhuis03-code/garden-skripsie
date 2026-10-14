/**
 * D33 - the final relaxation pass (owner prompt, 14 Oct 2026; engineConfig
 * RELAX). Runs on a finished Stage 4 layout, before output, and only moves
 * plants: the selection, the group sizes and so Z never change.
 *
 * Each iteration every movable plant is pushed by the sum of
 *   - repulsion from each neighbour whose edge-to-edge gap is below the
 *     target gap g, in proportion to the shortfall (g - gap), shared
 *     between the two plants; a neighbour of the same species pushes at
 *     sameGroupFactor, so drifts stay together;
 *   - repulsion from each bed edge closer than g.
 * g = free area / total plant perimeter for the bed: the gap every plant
 * would have if the open ground were shared out evenly round the edges.
 *
 * Clamps, checked on every move (a move that breaks one is halved, then
 * dropped):
 *   - depth: |d - d_target| <= depth_tol; a plant that started outside
 *     its tolerance may not move further from its target;
 *   - no overlap: a gap may not fall below 0, or below where it already
 *     was if Stage 4 left the pair overlapping within P2;
 *   - inside the bed (P1), P2, P5;
 *   - fixed: the feature plant and the windbreak row;
 *   - climbers move with their host;
 *   - the caller's hard rules (tree-front, P4, band rules).
 *
 * Stops after maxIterations or when no plant moves more than minMoveM.
 * The result is kept only if the largest empty patch shrinks and every
 * check holds on the finished layout; otherwise the original layout stands.
 * Deterministic: no random numbers, so the plan seeds are unchanged.
 */
import { RELAX } from "./engineConfig.ts";

export type RelaxPlant = {
  x: number;
  y: number;
  r: number;
  /** Species: same-species neighbours repel at sameGroupFactor. */
  plantId: string;
  /** Feature plant or windbreak row: never moves. */
  fixed: boolean;
  /** A climber's host (index into the same list): it moves with it. */
  hostIndex: number | null;
  /** Target depth as a fraction of the viewing span, or null for none. */
  target: number | null;
  tree: boolean;
  shade: boolean;
  /** For v2 (swaps) and v3 (the short-plant depth clamp). */
  heightCm: number;
};

export type RelaxEnv = {
  widthM: number;
  depthM: number;
  /** Depth from the viewer in metres, as Stage 4 compares it with the
   * target (d_eff when the curve is on). */
  depthOf: (x: number, y: number) => number;
  /** The viewing span the targets are fractions of. */
  span: number;
  /** depth_tol, as a fraction of the span. */
  depthTol: number;
  /** P2: the closest two centres may be. */
  minCentreDistance: (ri: number, rj: number) => number;
  /** The caller's own hard rules for plant i at (x, y). */
  hardOk: (index: number, x: number, y: number) => boolean;
};

export type RelaxResult = {
  accepted: boolean;
  positions: { x: number; y: number }[];
  patchBefore: number;
  patchAfter: number;
  iterations: number;
  /** Median distance moved by the movable plants, in cm. */
  medianMoveCm: number;
  /** Plants that moved more than 1 mm, and their median move in cm. */
  movedCount: number;
  medianMovedCm: number;
  /** v2: size swaps kept. */
  swaps?: number;
  targetGapM: number;
  reason: string;
};

const EPS = 1e-6;

/** Largest edge-connected bare area on a GRID x GRID sample, as a share of
 * the bed - the same measure as scripts/batch-test/metrics.ts (tested). */
export function largestEmptyPatchOf(
  circles: readonly { x: number; y: number; r: number }[],
  widthM: number,
  lengthM: number,
  grid = RELAX.grid,
): number {
  const planted = new Array<boolean>(grid * grid).fill(false);
  for (let row = 0; row < grid; row += 1) {
    const y = ((row + 0.5) / grid) * lengthM;
    for (let col = 0; col < grid; col += 1) {
      const x = ((col + 0.5) / grid) * widthM;
      planted[row * grid + col] = circles.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r);
    }
  }
  const seen = new Array<boolean>(planted.length).fill(false);
  let best = 0;
  for (let start = 0; start < planted.length; start += 1) {
    if (planted[start] || seen[start]) continue;
    let size = 0;
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const cell = stack.pop() as number;
      size += 1;
      const row = Math.floor(cell / grid);
      const col = cell % grid;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= grid || nc >= grid) continue;
        const next = nr * grid + nc;
        if (!planted[next] && !seen[next]) {
          seen[next] = true;
          stack.push(next);
        }
      }
    }
    best = Math.max(best, size);
  }
  return best / planted.length;
}

export function relaxLayout(plants: readonly RelaxPlant[], env: RelaxEnv): RelaxResult {
  const W = env.widthM;
  const L = env.depthM;
  const n = plants.length;
  const start = plants.map((p) => ({ x: p.x, y: p.y }));
  const pos = plants.map((p) => ({ x: p.x, y: p.y }));
  const area = plants.reduce((s, p) => s + Math.PI * p.r * p.r, 0);
  const perimeter = plants.reduce((s, p) => s + 2 * Math.PI * p.r, 0);
  const g = perimeter > 0 ? Math.max(0, W * L - area) / perimeter : 0;
  const patchBefore = largestEmptyPatchOf(plants, W, L);
  const keep = (reason: string, iterations = 0): RelaxResult => ({
    accepted: false, positions: start, patchBefore, patchAfter: patchBefore,
    iterations, medianMoveCm: 0, movedCount: 0, medianMovedCm: 0, targetGapM: g, reason,
  });
  if (n < 2 || g <= 0) return keep(g <= 0 ? "no free ground to share" : "fewer than two plants");

  const gap = (i: number, j: number, a = pos[i], b = pos[j]) =>
    Math.hypot(a.x - b.x, a.y - b.y) - plants[i].r - plants[j].r;
  // The closest each pair may come: never below 0, or below where Stage 4
  // left it if that pair already overlapped within P2.
  const floor = (i: number, j: number) => Math.min(0, gap(i, j, start[i], start[j]));
  const climbersOf = new Map<number, number[]>();
  plants.forEach((p, i) => {
    if (p.hostIndex !== null) climbersOf.set(p.hostIndex, [...(climbersOf.get(p.hostIndex) ?? []), i]);
  });
  const movable = plants.map((p) => !p.fixed && p.hostIndex === null);
  // v3: short plants may stray further from their target depth.
  const tolOf = (p: RelaxPlant) =>
    RELAX.shortClamp && p.heightCm < RELAX.shortHeightCm ? RELAX.shortDepthTol : env.depthTol;
  const allowedDev = plants.map((p, i) =>
    p.target === null ? Infinity : Math.max(tolOf(p) * env.span, Math.abs(env.depthOf(start[i].x, start[i].y) - p.target * env.span)),
  );
  // v6: each plant's group-mates and the furthest it may stand from the
  // nearest of them.
  const mates = plants.map((p, i) => plants.map((_, j) => j).filter((j) => j !== i && plants[j].plantId === p.plantId));
  const nearestMateGap = (k: number, at: (j: number) => { x: number; y: number }) =>
    Math.min(...mates[k].map((j) => Math.hypot(at(k).x - at(j).x, at(k).y - at(j).y) - plants[k].r - plants[j].r));
  const mateLimit = plants.map((_, k) =>
    mates[k].length ? Math.max(RELAX.cohesionMaxGapM, nearestMateGap(k, (j) => start[j])) : Infinity,
  );
  /** v6: with plant i at (x, y), every member of its group still stands
   * within its limit of its nearest group-mate. */
  const cohesive = (i: number, x: number, y: number): boolean => {
    if (!RELAX.cohesion || mates[i].length === 0) return true;
    const at = (j: number) => (j === i ? { x, y } : pos[j]);
    return [i, ...mates[i]].every((k) => nearestMateGap(k, at) <= mateLimit[k] + EPS);
  };
  /** Edge guard: the nearest point that keeps the whole circle inside. */
  const intoBed = (k: number, x: number, y: number) => ({
    x: Math.min(Math.max(x, plants[k].r), W - plants[k].r),
    y: Math.min(Math.max(y, plants[k].r), L - plants[k].r),
  });

  /** Every clamp and hard rule for plant i at (x, y), against the others
   * where they stand now (`moving` are the plants travelling with it). */
  const valid = (i: number, x: number, y: number, moving: ReadonlySet<number>): boolean => {
    const p = plants[i];
    if (x < p.r - EPS || x > W - p.r + EPS || y < p.r - EPS || y > L - p.r + EPS) return false; // P1
    if (p.target !== null && Math.abs(env.depthOf(x, y) - p.target * env.span) > allowedDev[i] + EPS) return false;
    if (!env.hardOk(i, x, y)) return false;
    if (!cohesive(i, x, y)) return false;
    for (let j = 0; j < n; j += 1) {
      if (j === i || moving.has(j)) continue;
      const q = plants[j];
      const d = Math.hypot(x - pos[j].x, y - pos[j].y);
      if (d < env.minCentreDistance(p.r, q.r) - EPS) return false; // P2
      if (d - p.r - q.r < floor(i, j) - EPS) return false; // no new overlap
      // P5: no canopy over a plant that does not take shade, either way round.
      if ((q.tree && !p.shade) || (p.tree && !q.shade)) {
        if (q.plantId !== p.plantId && d < p.r + q.r - EPS) return false;
      }
    }
    return true;
  };

  /** v2: swap two plants of similar height when the larger-spread one
   * stands in the fuller 1 m cell; keep a swap only if the 1 m-cell cover
   * variance drops. Returns the number of swaps kept. */
  function sizeSwaps(): number {
    const variance = () => cellCoverVariance(plants.map((p, k) => ({ x: pos[k].x, y: pos[k].y, r: p.r })), W, L);
    const coverOfCellAt = (() => {
      const cells = cellCovers(plants.map((p, k) => ({ x: pos[k].x, y: pos[k].y, r: p.r })), W, L);
      const cols = Math.ceil(W - 1e-9);
      return (x: number, y: number) => cells[Math.min(Math.ceil(L - 1e-9) - 1, Math.floor(y)) * cols + Math.min(cols - 1, Math.floor(x))];
    })();
    const free = (k: number) => movable[k] && !climbersOf.has(k);
    const pairs: { i: number; j: number; diff: number }[] = [];
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j || !free(i) || !free(j) || plants[i].plantId === plants[j].plantId) continue;
        if (plants[i].r <= plants[j].r) continue; // i is the larger spread
        if (Math.abs(plants[i].heightCm - plants[j].heightCm) > RELAX.swapHeightCm) continue;
        const diff = coverOfCellAt(pos[i].x, pos[i].y) - coverOfCellAt(pos[j].x, pos[j].y);
        if (diff > 1e-9) pairs.push({ i, j, diff }); // the larger one is in the fuller cell
      }
    }
    pairs.sort((a, b) => b.diff - a.diff || a.i - b.i || a.j - b.j);
    let current = variance();
    let kept = 0;
    const both = new Set<number>();
    for (const { i, j } of pairs.slice(0, RELAX.maxSwapTries)) {
      const a = { ...pos[i] };
      const b = { ...pos[j] };
      both.clear();
      both.add(i);
      both.add(j);
      pos[i] = { ...b };
      pos[j] = { ...a };
      // Each against everyone else, and the pair against each other.
      const ok = valid(i, pos[i].x, pos[i].y, new Set([i])) && valid(j, pos[j].x, pos[j].y, new Set([j]));
      const next = ok ? variance() : Infinity;
      if (ok && next < current - 1e-12) {
        current = next;
        kept += 1;
      } else {
        pos[i] = a;
        pos[j] = b;
      }
    }
    return kept;
  }

  // v1: the sample points the power cells are measured on.
  const step = Math.max(0.02, Math.sqrt((W * L) / RELAX.lloydSamples));
  const samples: { x: number; y: number }[] = [];
  for (let y = step / 2; y < L; y += step) for (let x = step / 2; x < W; x += step) samples.push({ x, y });

  let iterations = 0;
  for (; iterations < RELAX.maxIterations; iterations += 1) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    if (RELAX.method === "lloyd") {
      // Power diagram: each sample belongs to the plant with the least
      // |s - c|^2 - r^2; each movable plant steps towards its cell's centroid.
      const sx = new Array<number>(n).fill(0);
      const sy = new Array<number>(n).fill(0);
      const count = new Array<number>(n).fill(0);
      for (const s of samples) {
        let best = 0;
        let bestPower = Infinity;
        for (let k = 0; k < n; k += 1) {
          const power = (s.x - pos[k].x) ** 2 + (s.y - pos[k].y) ** 2 - plants[k].r ** 2;
          if (power < bestPower) {
            bestPower = power;
            best = k;
          }
        }
        sx[best] += s.x;
        sy[best] += s.y;
        count[best] += 1;
      }
      for (let i = 0; i < n; i += 1) {
        if (!movable[i] || count[i] === 0) continue;
        disp[i].x = sx[i] / count[i] - pos[i].x;
        disp[i].y = sy[i] / count[i] - pos[i].y;
        const length = Math.hypot(disp[i].x, disp[i].y);
        const cap = RELAX.maxStepFraction * plants[i].r;
        if (length > cap) {
          disp[i].x *= cap / length;
          disp[i].y *= cap / length;
        }
      }
    }
    for (let i = 0; i < n; i += 1) {
      if (RELAX.method === "lloyd" || !movable[i]) continue;
      const p = plants[i];
      for (let j = 0; j < n; j += 1) {
        if (j === i) continue;
        const shortfall = g - gap(i, j);
        if (shortfall <= 0) continue;
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d = Math.hypot(dx, dy);
        if (d < EPS) {
          // Coincident centres: a fixed direction by index, never random.
          const angle = ((i * 7 + j * 13) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        }
        const weight = plants[j].plantId === p.plantId ? RELAX.sameGroupFactor : 1;
        const share = movable[j] ? 0.5 : 1; // a fixed neighbour does not give way
        disp[i].x += (weight * share * shortfall * dx) / d;
        disp[i].y += (weight * share * shortfall * dy) / d;
      }
      const wall = (distance: number) => Math.max(0, g - (distance - p.r));
      disp[i].x += wall(pos[i].x) - wall(W - pos[i].x);
      disp[i].y += wall(pos[i].y) - wall(L - pos[i].y);
      const length = Math.hypot(disp[i].x, disp[i].y);
      const cap = RELAX.maxStepFraction * p.r;
      if (length > cap) {
        disp[i].x *= cap / length;
        disp[i].y *= cap / length;
      }
    }
    let maxMove = 0;
    for (let i = 0; i < n; i += 1) {
      if (!movable[i] || (disp[i].x === 0 && disp[i].y === 0)) continue;
      const group = [i, ...(climbersOf.get(i) ?? [])];
      const moving = new Set(group);
      for (const scale of [1, 0.5, 0.25]) {
        let dx = disp[i].x * scale;
        let dy = disp[i].y * scale;
        if (RELAX.edgeGuard) {
          // Project back inside: the part of the move along the wall stays.
          const inside = intoBed(i, pos[i].x + dx, pos[i].y + dy);
          dx = inside.x - pos[i].x;
          dy = inside.y - pos[i].y;
          if (dx === 0 && dy === 0) continue;
        }
        if (group.every((k) => valid(k, pos[k].x + dx, pos[k].y + dy, moving))) {
          for (const k of group) {
            pos[k].x += dx;
            pos[k].y += dy;
          }
          maxMove = Math.max(maxMove, Math.hypot(dx, dy));
          break;
        }
      }
    }
    if (maxMove < RELAX.minMoveM) {
      iterations += 1;
      break;
    }
  }

  // The finished layout must hold every check, from scratch.
  const all = new Set<number>();
  for (let i = 0; i < n; i += 1) {
    all.clear();
    all.add(i);
    if (!valid(i, pos[i].x, pos[i].y, all)) return keep(`a check fails on the relaxed layout (plant ${i})`, iterations);
  }
  const moved = plants.map((_, i) => i).filter((i) => movable[i]).map((i) => Math.hypot(pos[i].x - start[i].x, pos[i].y - start[i].y) * 100).sort((a, b) => a - b);
  const medianOf = (v: number[]) => (v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 0);
  const patchOfMoves = largestEmptyPatchOf(plants.map((p, i) => ({ ...p, x: pos[i].x, y: pos[i].y })), W, L);
  const movesKept = patchOfMoves < patchBefore - 1e-9;
  // The moves stand only if they shrank the largest gap; otherwise the
  // plants go back. v2's swaps are then judged on their own test.
  if (!movesKept) for (let i = 0; i < n; i += 1) pos[i] = { ...start[i] };
  const swapped = RELAX.swaps ? sizeSwaps() : 0;
  const movedOnly = movesKept ? moved.filter((cm) => cm > 0.1) : [];
  const stats = {
    medianMoveCm: movesKept ? medianOf(moved) : 0,
    movedCount: movedOnly.length,
    medianMovedCm: medianOf(movedOnly),
  };
  const patchAfter = largestEmptyPatchOf(plants.map((p, i) => ({ ...p, x: pos[i].x, y: pos[i].y })), W, L);
  if (!movesKept && swapped === 0) {
    return { ...keep(`largest empty patch did not shrink (${patchBefore.toFixed(3)} -> ${patchOfMoves.toFixed(3)})`, iterations), patchAfter: patchOfMoves, ...stats, medianMoveCm: medianOf(moved), swaps: 0 };
  }
  return {
    accepted: true, positions: pos, patchBefore, patchAfter, iterations, ...stats, targetGapM: g, swaps: swapped,
    reason: movesKept
      ? `largest empty patch shrank and every check holds${RELAX.swaps ? `; ${swapped} swap(s) kept` : ""}`
      : `moves rejected (gap ${patchBefore.toFixed(3)} -> ${patchOfMoves.toFixed(3)}); ${swapped} swap(s) kept`,
  };
}

/** Planted share of each 1 m cell (the last row and column may be part
 * cells), sampled at 10 points per metre. Row-major, ceil(W) columns. */
export function cellCovers(circles: readonly { x: number; y: number; r: number }[], widthM: number, lengthM: number): number[] {
  const cols = Math.ceil(widthM - 1e-9);
  const rows = Math.ceil(lengthM - 1e-9);
  const planted = new Array<number>(cols * rows).fill(0);
  const total = new Array<number>(cols * rows).fill(0);
  const step = 0.1;
  for (let y = step / 2; y < lengthM; y += step) {
    for (let x = step / 2; x < widthM; x += step) {
      const k = Math.min(rows - 1, Math.floor(y)) * cols + Math.min(cols - 1, Math.floor(x));
      total[k] += 1;
      if (circles.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r)) planted[k] += 1;
    }
  }
  return planted.map((p, k) => (total[k] ? p / total[k] : 0));
}

/** Variance of the 1 m-cell cover. */
export function cellCoverVariance(circles: readonly { x: number; y: number; r: number }[], widthM: number, lengthM: number): number {
  const covers = cellCovers(circles, widthM, lengthM);
  const mean = covers.reduce((s, c) => s + c, 0) / covers.length;
  return covers.reduce((s, c) => s + (c - mean) ** 2, 0) / covers.length;
}

/** v4: the empty areas of the bed, largest first, on a GRID x GRID sample
 * (4-neighbour components), each with its cells' centre points. */
export function emptyGaps(
  circles: readonly { x: number; y: number; r: number }[],
  widthM: number,
  lengthM: number,
  grid = 40,
): { x: number; y: number }[][] {
  const planted = new Array<boolean>(grid * grid).fill(false);
  const centre = (cell: number) => ({ x: (((cell % grid) + 0.5) / grid) * widthM, y: ((Math.floor(cell / grid) + 0.5) / grid) * lengthM });
  for (let cell = 0; cell < grid * grid; cell += 1) {
    const { x, y } = centre(cell);
    planted[cell] = circles.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r);
  }
  const seen = new Array<boolean>(planted.length).fill(false);
  const gaps: { x: number; y: number }[][] = [];
  for (let start = 0; start < planted.length; start += 1) {
    if (planted[start] || seen[start]) continue;
    const cells: number[] = [];
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const cell = stack.pop() as number;
      cells.push(cell);
      const row = Math.floor(cell / grid);
      const col = cell % grid;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= grid || nc >= grid) continue;
        const next = nr * grid + nc;
        if (!planted[next] && !seen[next]) {
          seen[next] = true;
          stack.push(next);
        }
      }
    }
    gaps.push(cells.sort((a, b) => a - b).map(centre));
  }
  return gaps.sort((a, b) => b.length - a.length);
}
