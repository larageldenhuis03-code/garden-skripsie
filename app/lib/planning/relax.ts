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
  const allowedDev = plants.map((p, i) =>
    p.target === null ? Infinity : Math.max(env.depthTol * env.span, Math.abs(env.depthOf(start[i].x, start[i].y) - p.target * env.span)),
  );

  /** Every clamp and hard rule for plant i at (x, y), against the others
   * where they stand now (`moving` are the plants travelling with it). */
  const valid = (i: number, x: number, y: number, moving: ReadonlySet<number>): boolean => {
    const p = plants[i];
    if (x < p.r - EPS || x > W - p.r + EPS || y < p.r - EPS || y > L - p.r + EPS) return false; // P1
    if (p.target !== null && Math.abs(env.depthOf(x, y) - p.target * env.span) > allowedDev[i] + EPS) return false;
    if (!env.hardOk(i, x, y)) return false;
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

  let iterations = 0;
  for (; iterations < RELAX.maxIterations; iterations += 1) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i += 1) {
      if (!movable[i]) continue;
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
        const dx = disp[i].x * scale;
        const dy = disp[i].y * scale;
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
  const medianMoveCm = medianOf(moved);
  const movedOnly = moved.filter((cm) => cm > 0.1);
  const movedCount = movedOnly.length;
  const medianMovedCm = medianOf(movedOnly);
  const patchAfter = largestEmptyPatchOf(plants.map((p, i) => ({ ...p, x: pos[i].x, y: pos[i].y })), W, L);
  if (!(patchAfter < patchBefore - 1e-9)) {
    return { ...keep(`largest empty patch did not shrink (${patchBefore.toFixed(3)} -> ${patchAfter.toFixed(3)})`, iterations), patchAfter, medianMoveCm, movedCount, medianMovedCm };
  }
  return {
    accepted: true, positions: pos, patchBefore, patchAfter, iterations, medianMoveCm, movedCount, medianMovedCm, targetGapM: g,
    reason: "largest empty patch shrank and every check holds",
  };
}
