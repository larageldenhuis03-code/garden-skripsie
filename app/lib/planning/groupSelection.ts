export type GroupCandidate = {
  id: string;
  suitability: number;
  canopyArea: number;
  category: string;
};

export type CategoryAreaRule = {
  category: string;
  minimumRatio?: number;
  maximumRatio?: number;
};

export type GroupSelectionModel = {
  bedArea: number;
  openSpaceRatio: number;
  categoryRules: readonly CategoryAreaRule[];
  minimumSpecies?: number;
  maximumSpecies?: number;
};

export type SelectionViolation = {
  constraint:
    | "total-area"
    | "category-minimum"
    | "category-maximum"
    | "species-minimum"
    | "species-maximum"
    | "unknown-candidate"
    | "duplicate-candidate";
  message: string;
  category?: string;
};

export type SelectionCheck = {
  feasible: boolean;
  totalCanopyArea: number;
  usableCanopyArea: number;
  unusedCanopyArea: number;
  categoryAreas: Record<string, number>;
  violations: SelectionViolation[];
};

export type GroupSelectionResult =
  | {
      status: "solution";
      modelKind: "binary-species-subset";
      selectedIds: string[];
      objectiveValue: number;
      check: SelectionCheck;
      diagnostics: string[];
    }
  | {
      status: "no-feasible-greedy-solution";
      modelKind: "binary-species-subset";
      selectedIds: string[];
      objectiveValue: number;
      check: SelectionCheck;
      diagnostics: string[];
    };

const EPSILON = 1e-9;

function assertRatio(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
}

function validateModel(
  candidates: readonly GroupCandidate[],
  model: GroupSelectionModel,
): void {
  if (!Number.isFinite(model.bedArea) || model.bedArea <= 0) {
    throw new Error("Bed area must be a positive, finite number.");
  }

  assertRatio(model.openSpaceRatio, "Open-space ratio");
  if (model.openSpaceRatio === 1) {
    throw new Error("Open-space ratio must leave some usable planting area.");
  }
  if (
    model.minimumSpecies !== undefined &&
    (!Number.isInteger(model.minimumSpecies) || model.minimumSpecies < 1)
  ) {
    throw new Error("Minimum species must be a positive integer.");
  }
  if (
    model.maximumSpecies !== undefined &&
    (!Number.isInteger(model.maximumSpecies) || model.maximumSpecies < 1)
  ) {
    throw new Error("Maximum species must be a positive integer.");
  }
  if (
    model.minimumSpecies !== undefined &&
    model.maximumSpecies !== undefined &&
    model.minimumSpecies > model.maximumSpecies
  ) {
    throw new Error("Minimum species cannot exceed maximum species.");
  }

  const candidateIds = new Set<string>();
  candidates.forEach((candidate) => {
    if (!candidate.id.trim()) {
      throw new Error("Every candidate must have an identifier.");
    }
    if (candidateIds.has(candidate.id)) {
      throw new Error(`Duplicate candidate identifier "${candidate.id}".`);
    }
    candidateIds.add(candidate.id);

    if (!Number.isFinite(candidate.suitability)) {
      throw new Error(`Candidate "${candidate.id}" has invalid suitability.`);
    }
    if (!Number.isFinite(candidate.canopyArea) || candidate.canopyArea <= 0) {
      throw new Error(`Candidate "${candidate.id}" has invalid canopy area.`);
    }
    if (!candidate.category.trim()) {
      throw new Error(`Candidate "${candidate.id}" has no category.`);
    }
  });

  const ruleCategories = new Set<string>();
  let combinedMinimumRatio = 0;
  model.categoryRules.forEach((rule) => {
    if (!rule.category.trim()) {
      throw new Error("Every category rule must have a category.");
    }
    if (ruleCategories.has(rule.category)) {
      throw new Error(`Duplicate category rule "${rule.category}".`);
    }
    ruleCategories.add(rule.category);

    const minimumRatio = rule.minimumRatio ?? 0;
    const maximumRatio = rule.maximumRatio ?? 1;
    assertRatio(minimumRatio, `Minimum ratio for "${rule.category}"`);
    assertRatio(maximumRatio, `Maximum ratio for "${rule.category}"`);
    if (minimumRatio > maximumRatio) {
      throw new Error(
        `Minimum ratio exceeds maximum ratio for "${rule.category}".`,
      );
    }
    combinedMinimumRatio += minimumRatio;
  });

  if (combinedMinimumRatio > 1 - model.openSpaceRatio + EPSILON) {
    throw new Error(
      "Combined category minimums exceed the usable planting-area ratio.",
    );
  }
}

function toAreaMap(candidates: readonly GroupCandidate[]): Record<string, number> {
  const areas: Record<string, number> = {};
  candidates.forEach((candidate) => {
    areas[candidate.category] =
      (areas[candidate.category] ?? 0) + candidate.canopyArea;
  });
  return areas;
}

/**
 * Checks the paper's current binary species-selection inequalities exactly.
 * It does not infer plant quantities or physical coordinates.
 */
export function checkGroupSelection(
  candidates: readonly GroupCandidate[],
  selectedIds: readonly string[],
  model: GroupSelectionModel,
): SelectionCheck {
  validateModel(candidates, model);

  const violations: SelectionViolation[] = [];
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const seen = new Set<string>();
  const selected: GroupCandidate[] = [];

  selectedIds.forEach((id) => {
    if (seen.has(id)) {
      violations.push({
        constraint: "duplicate-candidate",
        message: `Candidate "${id}" is selected more than once in a binary model.`,
      });
      return;
    }
    seen.add(id);

    const candidate = candidatesById.get(id);
    if (!candidate) {
      violations.push({
        constraint: "unknown-candidate",
        message: `Selected candidate "${id}" is not in the candidate pool.`,
      });
      return;
    }
    selected.push(candidate);
  });

  const totalCanopyArea = selected.reduce(
    (sum, candidate) => sum + candidate.canopyArea,
    0,
  );
  const usableCanopyArea = model.bedArea * (1 - model.openSpaceRatio);
  const categoryAreas = toAreaMap(selected);

  if (
    model.minimumSpecies !== undefined &&
    selected.length < model.minimumSpecies
  ) {
    violations.push({
      constraint: "species-minimum",
      message: `The selection contains ${selected.length} species; at least ${model.minimumSpecies} are required.`,
    });
  }
  if (
    model.maximumSpecies !== undefined &&
    selected.length > model.maximumSpecies
  ) {
    violations.push({
      constraint: "species-maximum",
      message: `The selection contains ${selected.length} species; at most ${model.maximumSpecies} are allowed.`,
    });
  }

  if (totalCanopyArea > usableCanopyArea + EPSILON) {
    violations.push({
      constraint: "total-area",
      message: `Selected canopy area ${totalCanopyArea} exceeds the usable allowance ${usableCanopyArea}.`,
    });
  }

  model.categoryRules.forEach((rule) => {
    const categoryArea = categoryAreas[rule.category] ?? 0;
    const minimumArea = (rule.minimumRatio ?? 0) * model.bedArea;
    const maximumArea = (rule.maximumRatio ?? 1) * model.bedArea;

    if (categoryArea + EPSILON < minimumArea) {
      violations.push({
        constraint: "category-minimum",
        category: rule.category,
        message: `"${rule.category}" canopy area ${categoryArea} is below its minimum ${minimumArea}.`,
      });
    }

    if (categoryArea > maximumArea + EPSILON) {
      violations.push({
        constraint: "category-maximum",
        category: rule.category,
        message: `"${rule.category}" canopy area ${categoryArea} exceeds its maximum ${maximumArea}.`,
      });
    }
  });

  return {
    feasible: violations.length === 0,
    totalCanopyArea,
    usableCanopyArea,
    unusedCanopyArea: Math.max(0, usableCanopyArea - totalCanopyArea),
    categoryAreas,
    violations,
  };
}

function compareCandidates(
  left: GroupCandidate,
  right: GroupCandidate,
): number {
  return (
    right.suitability - left.suitability ||
    right.canopyArea - left.canopyArea ||
    left.id.localeCompare(right.id)
  );
}

function canAddCandidate(
  candidate: GroupCandidate,
  selected: readonly GroupCandidate[],
  model: GroupSelectionModel,
): boolean {
  const nextIds = [...selected.map(({ id }) => id), candidate.id];
  const check = checkGroupSelectionWithoutMinimums(
    [...selected, candidate],
    model,
  );
  return (
    new Set(nextIds).size === nextIds.length &&
    check.violations.length === 0
  );
}

function checkGroupSelectionWithoutMinimums(
  selected: readonly GroupCandidate[],
  model: GroupSelectionModel,
): Pick<SelectionCheck, "violations"> {
  const violations: SelectionViolation[] = [];
  const totalCanopyArea = selected.reduce(
    (sum, candidate) => sum + candidate.canopyArea,
    0,
  );
  const categoryAreas = toAreaMap(selected);
  const usableCanopyArea = model.bedArea * (1 - model.openSpaceRatio);

  if (
    model.maximumSpecies !== undefined &&
    selected.length > model.maximumSpecies
  ) {
    violations.push({
      constraint: "species-maximum",
      message: "Adding this candidate would exceed the species limit.",
    });
  }

  if (totalCanopyArea > usableCanopyArea + EPSILON) {
    violations.push({
      constraint: "total-area",
      message: "Adding this candidate would exceed the total canopy allowance.",
    });
  }

  model.categoryRules.forEach((rule) => {
    const maximumArea = (rule.maximumRatio ?? 1) * model.bedArea;
    if ((categoryAreas[rule.category] ?? 0) > maximumArea + EPSILON) {
      violations.push({
        constraint: "category-maximum",
        category: rule.category,
        message: `Adding this candidate would exceed the "${rule.category}" maximum.`,
      });
    }
  });

  return { violations };
}

/**
 * Deterministic Phase-1 constructor for the literature review's binary model.
 * A failure means this greedy procedure did not find a feasible subset; it is
 * not a proof that no feasible subset exists.
 */
export function selectGroupGreedy(
  candidates: readonly GroupCandidate[],
  model: GroupSelectionModel,
): GroupSelectionResult {
  validateModel(candidates, model);

  const selected: GroupCandidate[] = [];
  const selectedIds = new Set<string>();
  const diagnostics: string[] = [];
  const sorted = [...candidates].sort(compareCandidates);

  const requiredRules = model.categoryRules
    .filter((rule) => (rule.minimumRatio ?? 0) > 0)
    .sort(
      (left, right) =>
        (right.minimumRatio ?? 0) - (left.minimumRatio ?? 0) ||
        left.category.localeCompare(right.category),
    );

  for (const rule of requiredRules) {
    const minimumArea = (rule.minimumRatio ?? 0) * model.bedArea;
    const categoryCandidates = sorted.filter(
      (candidate) =>
        candidate.category === rule.category && !selectedIds.has(candidate.id),
    );

    while (
      (toAreaMap(selected)[rule.category] ?? 0) + EPSILON <
      minimumArea
    ) {
      const currentArea = toAreaMap(selected)[rule.category] ?? 0;
      const addable = categoryCandidates.filter(
        (candidate) =>
          !selectedIds.has(candidate.id) &&
          canAddCandidate(candidate, selected, model),
      );

      if (addable.length === 0) {
        diagnostics.push(
          `We could not add enough plants from the “${rule.category}” group.`,
        );
        const check = checkGroupSelection(
          candidates,
          selected.map(({ id }) => id),
          model,
        );
        return {
          status: "no-feasible-greedy-solution",
          modelKind: "binary-species-subset",
          selectedIds: selected.map(({ id }) => id),
          objectiveValue: selected.reduce(
            (sum, candidate) => sum + candidate.suitability,
            0,
          ),
          check,
          diagnostics,
        };
      }

      addable.sort((left, right) => {
        const leftExcess = Math.max(
          0,
          currentArea + left.canopyArea - minimumArea,
        );
        const rightExcess = Math.max(
          0,
          currentArea + right.canopyArea - minimumArea,
        );
        const leftReachesMinimum =
          currentArea + left.canopyArea + EPSILON >= minimumArea;
        const rightReachesMinimum =
          currentArea + right.canopyArea + EPSILON >= minimumArea;

        if (leftReachesMinimum && rightReachesMinimum) {
          return leftExcess - rightExcess || compareCandidates(left, right);
        }
        if (leftReachesMinimum !== rightReachesMinimum) {
          return leftReachesMinimum ? -1 : 1;
        }
        return compareCandidates(left, right);
      });

      const chosen = addable[0];
      selected.push(chosen);
      selectedIds.add(chosen.id);
    }
  }

  sorted.forEach((candidate) => {
    if (
      candidate.suitability > 0 &&
      !selectedIds.has(candidate.id) &&
      canAddCandidate(candidate, selected, model)
    ) {
      selected.push(candidate);
      selectedIds.add(candidate.id);
    }
  });

  const selectedIdList = selected.map(({ id }) => id);
  const check = checkGroupSelection(candidates, selectedIdList, model);

  if (!check.feasible) {
    diagnostics.push(
      "We could not find a plant mix that met all the current rules.",
    );
  }

  diagnostics.push(
    "This step chooses the plant mix. Quantities and positions are worked out next.",
  );

  return {
    status: check.feasible ? "solution" : "no-feasible-greedy-solution",
    modelKind: "binary-species-subset",
    selectedIds: selectedIdList,
    // The paper's displayed objective is malformed. Its prose says to maximise
    // total Goal Programming suitability, so the defensible objective is
    // Σ(v_i x_i): suitability summed over the selected binary species.
    objectiveValue: selected.reduce(
      (sum, candidate) => sum + candidate.suitability,
      0,
    ),
    check,
    diagnostics,
  };
}
