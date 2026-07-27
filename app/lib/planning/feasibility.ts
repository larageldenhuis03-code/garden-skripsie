export type ConstraintStatus = "pass" | "fail" | "unknown";
export type UnknownConstraintPolicy = "reject" | "review";

export type ConstraintEvidence = {
  source?: string;
  observedValue?: unknown;
  requiredValue?: unknown;
  confidence?: "high" | "medium" | "low" | "unknown";
};

export type ConstraintEvaluation = {
  status: ConstraintStatus;
  reason: string;
  evidence?: ConstraintEvidence;
};

export type HardConstraint<TCandidate, TContext> = {
  id: string;
  description: string;
  evaluate: (
    candidate: Readonly<TCandidate>,
    context: Readonly<TContext>,
  ) => ConstraintEvaluation;
};

export type FeasibilityTrace = ConstraintEvaluation & {
  constraintId: string;
  description: string;
};

export type FeasibilityResult =
  | {
      status: "feasible";
      feasible: true;
      trace: FeasibilityTrace[];
    }
  | {
      status: "infeasible" | "review";
      feasible: false;
      trace: FeasibilityTrace[];
    };

/**
 * Runs every hard constraint and preserves its explanation. Unknown evidence
 * can never become a silent pass.
 */
export function evaluateHardConstraints<TCandidate, TContext>(
  candidate: Readonly<TCandidate>,
  context: Readonly<TContext>,
  constraints: readonly HardConstraint<TCandidate, TContext>[],
  unknownPolicy: UnknownConstraintPolicy = "reject",
): FeasibilityResult {
  const trace = constraints.map<FeasibilityTrace>((constraint) => {
    const evaluation = constraint.evaluate(candidate, context);

    if (!evaluation.reason.trim()) {
      throw new Error(
        `Hard constraint "${constraint.id}" returned no explanation.`,
      );
    }

    return {
      constraintId: constraint.id,
      description: constraint.description,
      ...evaluation,
    };
  });

  const hasFailure = trace.some((entry) => entry.status === "fail");
  const hasUnknown = trace.some((entry) => entry.status === "unknown");

  if (hasFailure || (hasUnknown && unknownPolicy === "reject")) {
    return { status: "infeasible", feasible: false, trace };
  }

  if (hasUnknown) {
    return { status: "review", feasible: false, trace };
  }

  return { status: "feasible", feasible: true, trace };
}
