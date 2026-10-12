/**
 * How evenly a layout fills its bed.
 *
 * Cover alone cannot tell clustering from spread: the same canopy area
 * can sit in one dense clump with a bare half-bed beside it, or be spread
 * evenly. These three figures separate the two, and all of them are read
 * off the placed circles after the fact. Nothing here feeds the engine.
 *
 * A 20 x 20 grid is laid over the bed and a cell counts as planted when
 * its centre falls inside some canopy circle. That is a sample, not an
 * exact area: on a 1 m bed each cell is 5 cm across, and a canopy smaller
 * than a cell can be missed entirely. It is the same sample for every
 * version, which is what a comparison needs.
 */

export const GRID = 20;

export type Circle = { xM: number; yM: number; radiusM: number };

/** Which cells have a canopy over their centre. Row-major, GRID x GRID. */
export function plantedCells(
  circles: readonly Circle[],
  widthM: number,
  lengthM: number,
): boolean[] {
  const cells = new Array<boolean>(GRID * GRID).fill(false);
  if (widthM <= 0 || lengthM <= 0) return cells;
  for (let row = 0; row < GRID; row += 1) {
    const y = ((row + 0.5) / GRID) * lengthM;
    for (let col = 0; col < GRID; col += 1) {
      const x = ((col + 0.5) / GRID) * widthM;
      for (const c of circles) {
        const dx = x - c.xM;
        const dy = y - c.yM;
        if (dx * dx + dy * dy <= c.radiusM * c.radiusM) {
          cells[row * GRID + col] = true;
          break;
        }
      }
    }
  }
  return cells;
}

/** Share of the bed whose centre sample is bare. */
export function emptyCellShare(cells: readonly boolean[]): number {
  let empty = 0;
  for (const planted of cells) if (!planted) empty += 1;
  return empty / cells.length;
}

/**
 * The biggest single bare area, as a share of the bed. Edge-connected
 * (4-neighbour), because a diagonal touch is not a hole you could plant
 * into. This is the figure that catches "75% cover with a bald quarter".
 */
export function largestEmptyPatch(cells: readonly boolean[]): number {
  const seen = new Array<boolean>(cells.length).fill(false);
  let best = 0;
  const stack: number[] = [];
  for (let start = 0; start < cells.length; start += 1) {
    if (cells[start] || seen[start]) continue;
    let size = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = true;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      size += 1;
      const row = Math.floor(index / GRID);
      const col = index % GRID;
      const neighbours = [
        row > 0 ? index - GRID : -1,
        row < GRID - 1 ? index + GRID : -1,
        col > 0 ? index - 1 : -1,
        col < GRID - 1 ? index + 1 : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && !cells[n] && !seen[n]) {
          seen[n] = true;
          stack.push(n);
        }
      }
    }
    if (size > best) best = size;
  }
  return best / cells.length;
}

/**
 * How unevenly the planting is shared between the four quadrants, as the
 * coefficient of variation (population SD / mean) of their cover. 0 means
 * all four are equally full; the higher it is, the more the bed is
 * planted on one side. Returns 0 for an empty bed, where there is no
 * imbalance to describe.
 */
export function quadrantCV(cells: readonly boolean[]): number {
  const half = GRID / 2;
  const covers = [0, 0, 0, 0];
  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      if (!cells[row * GRID + col]) continue;
      const quadrant = (row < half ? 0 : 2) + (col < half ? 0 : 1);
      covers[quadrant] += 1;
    }
  }
  const perQuadrant = (GRID * GRID) / 4;
  const shares = covers.map((n) => n / perQuadrant);
  const mean = shares.reduce((a, b) => a + b, 0) / 4;
  if (mean <= 0) return 0;
  const variance = shares.reduce((sum, s) => sum + (s - mean) ** 2, 0) / 4;
  return Math.sqrt(variance) / mean;
}

/** All three at once, from a layout's placements. */
export function spreadMetrics(
  circles: readonly Circle[],
  widthM: number,
  lengthM: number,
): { emptyCellShare: number; largestEmptyPatch: number; quadrantCV: number } {
  const cells = plantedCells(circles, widthM, lengthM);
  return {
    emptyCellShare: emptyCellShare(cells),
    largestEmptyPatch: largestEmptyPatch(cells),
    quadrantCV: quadrantCV(cells),
  };
}
