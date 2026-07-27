export type SoftGoal = {
  id: string;
  actual: number;
  target: number;
  underPenalty: number;
  overPenalty: number;
  /**
   * Lower numbers are more important. Priority 1 is evaluated before
   * priority 2, so lower-priority gains cannot erase higher-priority losses.
   */
  priority: number;
};

export type GoalDeviation = SoftGoal & {
  underDeviation: number;
  overDeviation: number;
  weightedPenalty: number;
};

export type PriorityObjective = {
  priority: number;
  weightedPenalty: number;
};

export type GoalProgramEvaluation = {
  deviations: GoalDeviation[];
  objectiveByPriority: PriorityObjective[];
  totalWeightedPenalty: number;
};

function assertFinite(value: number, field: string, goalId: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Goal "${goalId}" has a non-finite ${field}.`);
  }
}

export function evaluateGoalProgram(
  goals: readonly SoftGoal[],
): GoalProgramEvaluation {
  const deviations = goals.map<GoalDeviation>((goal) => {
    assertFinite(goal.actual, "actual value", goal.id);
    assertFinite(goal.target, "target value", goal.id);
    assertFinite(goal.underPenalty, "under-achievement penalty", goal.id);
    assertFinite(goal.overPenalty, "over-achievement penalty", goal.id);

    if (goal.underPenalty < 0 || goal.overPenalty < 0) {
      throw new Error(`Goal "${goal.id}" has a negative penalty weight.`);
    }

    if (!Number.isInteger(goal.priority) || goal.priority < 1) {
      throw new Error(
        `Goal "${goal.id}" must have a positive integer priority.`,
      );
    }

    const underDeviation = Math.max(0, goal.target - goal.actual);
    const overDeviation = Math.max(0, goal.actual - goal.target);
    const weightedPenalty =
      goal.underPenalty * underDeviation +
      goal.overPenalty * overDeviation;

    return {
      ...goal,
      underDeviation,
      overDeviation,
      weightedPenalty,
    };
  });

  const penaltiesByPriority = new Map<number, number>();
  deviations.forEach((goal) => {
    penaltiesByPriority.set(
      goal.priority,
      (penaltiesByPriority.get(goal.priority) ?? 0) + goal.weightedPenalty,
    );
  });

  const objectiveByPriority = [...penaltiesByPriority.entries()]
    .sort(([left], [right]) => left - right)
    .map(([priority, weightedPenalty]) => ({ priority, weightedPenalty }));

  return {
    deviations,
    objectiveByPriority,
    totalWeightedPenalty: deviations.reduce(
      (sum, goal) => sum + goal.weightedPenalty,
      0,
    ),
  };
}

/**
 * Lexicographic comparison for pre-emptive priorities.
 * Returns a negative number when left is preferred, a positive number when
 * right is preferred, and zero when they are equivalent within tolerance.
 */
export function compareGoalPrograms(
  left: GoalProgramEvaluation,
  right: GoalProgramEvaluation,
  tolerance = 1e-9,
): number {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("Comparison tolerance must be finite and non-negative.");
  }

  const priorities = new Set<number>();
  left.objectiveByPriority.forEach(({ priority }) => priorities.add(priority));
  right.objectiveByPriority.forEach(({ priority }) => priorities.add(priority));

  for (const priority of [...priorities].sort((a, b) => a - b)) {
    const leftPenalty =
      left.objectiveByPriority.find((entry) => entry.priority === priority)
        ?.weightedPenalty ?? 0;
    const rightPenalty =
      right.objectiveByPriority.find((entry) => entry.priority === priority)
        ?.weightedPenalty ?? 0;
    const difference = leftPenalty - rightPenalty;

    if (Math.abs(difference) > tolerance) {
      return difference;
    }
  }

  return 0;
}
