import { RULES } from "./rules.ts";

export type LayoutSpecies = {
  id: string;
  quantity: number;
  diameterM: number;
};

export type CanopyPlacement = {
  instanceId: string;
  plantId: string;
  sequence: number;
  xM: number;
  yM: number;
  radiusM: number;
};

export type UnplacedCanopy = {
  instanceId: string;
  plantId: string;
  sequence: number;
  diameterM: number;
  reason: string;
};

/** Ground cover laid as a mat (SEARCH.matModel): an area and a planting
 * density, not a set of circles. */
export type GroundCoverMat = {
  /** Each mat species: its area (sun patch + shade patch), its planting
   * density and the plants that takes. */
  species: {
    plantId: string;
    areaM2: number;
    sunAreaM2: number;
    shadeAreaM2: number;
    densityPerM2: number;
    count: number;
  }[];
  /** The sun mat: the open ground it covers. */
  areaM2: number;
  /** The shade patch under L1 canopies (already under canopy, so it adds
   * plants but not cover). */
  shadeAreaM2: number;
  /** Carpeters the search itself chose, and those the mat rules left out
   * of the plan. */
  chosenBySearch: string[];
  removedFromPlan: string[];
  /** The mat's shape: cells of a grid x grid raster over the bed, and for
   * each cell the index into species of the carpeter that covers it. */
  grid: number;
  cells: number[];
  owners: number[];
  /** The style's open_min, kept as bare ground. */
  openMin: number;
};

export type RectangularLayout = {
  /** Present only when the plan's ground cover is laid as a mat. */
  mat?: GroundCoverMat;
  status: "complete" | "partial";
  bedWidthM: number;
  bedLengthM: number;
  placements: CanopyPlacement[];
  unplaced: UnplacedCanopy[];
  canopyAreaM2: number;
  bedAreaM2: number;
  realisedOpenSpaceRatio: number;
  diagnostics: string[];
};

type CanopyInstance = {
  instanceId: string;
  plantId: string;
  sequence: number;
  diameterM: number;
};

type LayoutRow = {
  heightM: number;
  widthM: number;
  instances: CanopyInstance[];
};

const EPSILON = 1e-9;

function expandSpecies(species: readonly LayoutSpecies[]): CanopyInstance[] {
  const ids = new Set<string>();
  const instances: CanopyInstance[] = [];

  species.forEach((item) => {
    if (!item.id.trim() || ids.has(item.id)) {
      throw new Error("Layout species need unique identifiers.");
    }
    ids.add(item.id);
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      throw new Error(`Species "${item.id}" has an invalid quantity.`);
    }
    if (!Number.isFinite(item.diameterM) || item.diameterM <= 0) {
      throw new Error(`Species "${item.id}" has an invalid canopy diameter.`);
    }

    for (let sequence = 1; sequence <= item.quantity; sequence += 1) {
      instances.push({
        instanceId: `${item.id}-${sequence}`,
        plantId: item.id,
        sequence,
        diameterM: item.diameterM,
      });
    }
  });

  return instances.sort(
    (left, right) =>
      right.diameterM - left.diameterM ||
      left.plantId.localeCompare(right.plantId) ||
      left.sequence - right.sequence,
  );
}

/**
 * Deterministic shelf packing for circular mature-canopy proxies. It is
 * intentionally conservative: each circle occupies a square cell equal to its
 * diameter, which guarantees boundary and overlap safety without claiming an
 * optimal packing.
 */
export function placeCanopiesInRectangle(
  species: readonly LayoutSpecies[],
  bedWidthM: number,
  bedLengthM: number,
): RectangularLayout {
  if (!Number.isFinite(bedWidthM) || bedWidthM <= 0) {
    throw new Error("Bed width must be a positive, finite number.");
  }
  if (!Number.isFinite(bedLengthM) || bedLengthM <= 0) {
    throw new Error("Bed length must be a positive, finite number.");
  }

  const rows: LayoutRow[] = [];
  const unplaced: UnplacedCanopy[] = [];
  const instances = expandSpecies(species);
  let usedLengthM = 0;

  instances.forEach((instance) => {
    if (
      instance.diameterM > bedWidthM + EPSILON ||
      instance.diameterM > bedLengthM + EPSILON
    ) {
      unplaced.push({
        ...instance,
        reason: "Its estimated spread is wider than at least one side of the bed.",
      });
      return;
    }

    const row = rows.find(
      (candidate) =>
        candidate.heightM + EPSILON >= instance.diameterM &&
        candidate.widthM + instance.diameterM <= bedWidthM + EPSILON,
    );

    if (row) {
      row.instances.push(instance);
      row.widthM += instance.diameterM;
      return;
    }

    if (usedLengthM + instance.diameterM <= bedLengthM + EPSILON) {
      rows.push({
        heightM: instance.diameterM,
        widthM: instance.diameterM,
        instances: [instance],
      });
      usedLengthM += instance.diameterM;
      return;
    }

    unplaced.push({
      ...instance,
      reason: "There was no room left for it in the layout.",
    });
  });

  const placements: CanopyPlacement[] = [];
  let rowTopM = 0;
  rows.forEach((row) => {
    let xM = (bedWidthM - row.widthM) / 2;
    row.instances.forEach((instance) => {
      placements.push({
        instanceId: instance.instanceId,
        plantId: instance.plantId,
        sequence: instance.sequence,
        xM: xM + instance.diameterM / 2,
        yM: rowTopM + row.heightM / 2,
        radiusM: instance.diameterM / 2,
      });
      xM += instance.diameterM;
    });
    rowTopM += row.heightM;
  });

  const canopyAreaM2 = placements.reduce(
    (sum, placement) => sum + Math.PI * placement.radiusM ** 2,
    0,
  );
  const bedAreaM2 = bedWidthM * bedLengthM;
  const diagnostics = [
    "The layout follows a simple row pattern. It is one workable option, not the only one.",
    "The circles use recorded plant spread as a guide until the spacing is checked by a plant expert.",
  ];
  if (unplaced.length > 0) {
    diagnostics.push(
      `${unplaced.length} plant${unplaced.length === 1 ? "" : "s"} could not be placed.`,
    );
  }

  return {
    status: unplaced.length === 0 ? "complete" : "partial",
    bedWidthM,
    bedLengthM,
    placements,
    unplaced,
    canopyAreaM2,
    bedAreaM2,
    realisedOpenSpaceRatio: Math.max(0, 1 - canopyAreaM2 / bedAreaM2),
    diagnostics,
  };
}

/** P2's minimum centre distance, the single definition the whole engine
 * uses. Rulebook 6_Stage3_4_Rules C15:D15, revised 2026-10-05:
 *
 *   d_ij >= r_i + r_j - delta * MIN(r_i, r_j)
 *
 * The allowance is a share of the SMALLER plant, not of the combined
 * radii. Under the previous form, (1 - delta)(r_i + r_j), a big plant
 * bought its small neighbour a large absolute overlap - the buck-weed
 * beside the Searsia could lose about 0.55 m of its own spread. The same
 * pair now gives up about 0.1 m. Equivalently: overlap / MIN(r_i, r_j)
 * <= delta.
 *
 * `delta` is passed rather than read here so that the audit can check a
 * layout against whatever tolerance built it, and so a study can vary it. */
export function minCentreDistanceWith(
  ri: number,
  rj: number,
  delta: number,
): number {
  return ri + rj - delta * Math.min(ri, rj);
}

/** Checks P1 (inside the bed) and P2 (overlap), using the definition
 * above so the audit can never drift from the placement rule. */
export function auditRectangularLayout(
  layout: RectangularLayout,
  // Read at call time for the same reason as minCentreDistance: an
  // audit must use whatever delta the placement used.
  overlapTolerance: number = RULES.stage4.overlapDelta,
): string[] {
  const errors: string[] = [];

  layout.placements.forEach((placement) => {
    if (
      placement.xM - placement.radiusM < -EPSILON ||
      placement.xM + placement.radiusM > layout.bedWidthM + EPSILON ||
      placement.yM - placement.radiusM < -EPSILON ||
      placement.yM + placement.radiusM > layout.bedLengthM + EPSILON
    ) {
      errors.push(`${placement.instanceId} crosses the bed boundary.`);
    }
  });

  for (let leftIndex = 0; leftIndex < layout.placements.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < layout.placements.length;
      rightIndex += 1
    ) {
      const left = layout.placements[leftIndex];
      const right = layout.placements[rightIndex];
      const distance = Math.hypot(left.xM - right.xM, left.yM - right.yM);
      if (
        distance + EPSILON <
        minCentreDistanceWith(left.radiusM, right.radiusM, overlapTolerance)
      ) {
        errors.push(`${left.instanceId} overlaps ${right.instanceId}.`);
      }
    }
  }

  return errors;
}
