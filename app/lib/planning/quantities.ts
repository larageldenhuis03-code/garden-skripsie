export type QuantityCandidate = {
  id: string;
  suitability: number;
  canopyAreaM2: number;
};

export type QuantityAllocationModel = {
  bedAreaM2: number;
  openSpaceRatio: number;
  maximumTotalPlants?: number;
};

export type PlantQuantity = {
  id: string;
  quantity: number;
  canopyAreaEachM2: number;
  allocatedCanopyAreaM2: number;
  /** Laid as a ground-cover mat (SEARCH.matModel): the mat's area for
   * this plant, and the planting density its quantity came from. */
  mat?: { areaM2: number; shadeAreaM2: number; densityPerM2: number };
};

export type QuantityAllocation = {
  quantities: PlantQuantity[];
  usedCanopyAreaM2: number;
  usableCanopyAreaM2: number;
  unusedCanopyAreaM2: number;
  totalPlants: number;
  diagnostics: string[];
};

const EPSILON = 1e-9;

function validate(
  candidates: readonly QuantityCandidate[],
  model: QuantityAllocationModel,
): void {
  if (!Number.isFinite(model.bedAreaM2) || model.bedAreaM2 <= 0) {
    throw new Error("Bed area must be a positive, finite number.");
  }
  if (
    !Number.isFinite(model.openSpaceRatio) ||
    model.openSpaceRatio < 0 ||
    model.openSpaceRatio >= 1
  ) {
    throw new Error("Open-space ratio must be at least 0 and below 1.");
  }
  if (
    model.maximumTotalPlants !== undefined &&
    (!Number.isInteger(model.maximumTotalPlants) ||
      model.maximumTotalPlants < 1)
  ) {
    throw new Error("Maximum total plants must be a positive integer.");
  }

  const ids = new Set<string>();
  candidates.forEach((candidate) => {
    if (!candidate.id.trim() || ids.has(candidate.id)) {
      throw new Error("Quantity candidates need unique identifiers.");
    }
    ids.add(candidate.id);
    if (!Number.isFinite(candidate.suitability) || candidate.suitability < 0) {
      throw new Error(`Candidate "${candidate.id}" has invalid suitability.`);
    }
    if (
      !Number.isFinite(candidate.canopyAreaM2) ||
      candidate.canopyAreaM2 <= 0
    ) {
      throw new Error(`Candidate "${candidate.id}" has invalid canopy area.`);
    }
  });
}

/**
 * Converts the binary species subset into integer q_i values. Every selected
 * species receives one plant first. Remaining capacity is assigned
 * deterministically, with a diminishing return that prevents one small
 * species from consuming the entire bed.
 */
export function allocatePlantQuantities(
  candidates: readonly QuantityCandidate[],
  model: QuantityAllocationModel,
): QuantityAllocation {
  validate(candidates, model);

  const usableCanopyAreaM2 = model.bedAreaM2 * (1 - model.openSpaceRatio);
  const diagnostics: string[] = [];
  const counts = new Map<string, number>();
  let usedCanopyAreaM2 = 0;
  let totalPlants = 0;

  const ranked = [...candidates].sort(
    (left, right) =>
      right.suitability - left.suitability ||
      left.canopyAreaM2 - right.canopyAreaM2 ||
      left.id.localeCompare(right.id),
  );

  ranked.forEach((candidate) => {
    const maximumReached =
      model.maximumTotalPlants !== undefined &&
      totalPlants >= model.maximumTotalPlants;
    if (
      !maximumReached &&
      usedCanopyAreaM2 + candidate.canopyAreaM2 <=
        usableCanopyAreaM2 + EPSILON
    ) {
      counts.set(candidate.id, 1);
      usedCanopyAreaM2 += candidate.canopyAreaM2;
      totalPlants += 1;
    } else {
      diagnostics.push(
        `${candidate.id} could not be added because there was not enough room.`,
      );
    }
  });

  while (
    model.maximumTotalPlants === undefined ||
    totalPlants < model.maximumTotalPlants
  ) {
    const addable = ranked
      .filter(
        (candidate) =>
          counts.has(candidate.id) &&
          usedCanopyAreaM2 + candidate.canopyAreaM2 <=
            usableCanopyAreaM2 + EPSILON,
      )
      .sort((left, right) => {
        const leftCount = counts.get(left.id) ?? 0;
        const rightCount = counts.get(right.id) ?? 0;
        const leftValue = left.suitability / (leftCount + 1);
        const rightValue = right.suitability / (rightCount + 1);
        return (
          rightValue - leftValue ||
          right.suitability - left.suitability ||
          right.canopyAreaM2 - left.canopyAreaM2 ||
          left.id.localeCompare(right.id)
        );
      });

    if (addable.length === 0) break;
    const chosen = addable[0];
    counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1);
    usedCanopyAreaM2 += chosen.canopyAreaM2;
    totalPlants += 1;
  }

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const quantities = [...counts.entries()]
    .map<PlantQuantity>(([id, quantity]) => {
      const candidate = byId.get(id);
      if (!candidate) {
        throw new Error(`Quantity candidate "${id}" disappeared.`);
      }
      return {
        id,
        quantity,
        canopyAreaEachM2: candidate.canopyAreaM2,
        allocatedCanopyAreaM2: candidate.canopyAreaM2 * quantity,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  diagnostics.push(
    "Quantities use recorded plant spread as a guide, not checked nursery spacing.",
  );

  return {
    quantities,
    usedCanopyAreaM2,
    usableCanopyAreaM2,
    unusedCanopyAreaM2: Math.max(
      0,
      usableCanopyAreaM2 - usedCanopyAreaM2,
    ),
    totalPlants,
    diagnostics,
  };
}
