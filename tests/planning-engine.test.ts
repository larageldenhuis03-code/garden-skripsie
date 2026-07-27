import assert from "node:assert/strict";
import test from "node:test";

import {
  auditAhpMatrix,
  checkGroupSelection,
  compareGoalPrograms,
  evaluateGoalProgram,
  evaluateHardConstraints,
  selectGroupGreedy,
  type HardConstraint,
} from "../app/lib/planning/index.ts";

test("AHP derives expected weights from a consistent reciprocal matrix", () => {
  const result = auditAhpMatrix([
    [1, 2, 4],
    [1 / 2, 1, 2],
    [1 / 4, 1 / 2, 1],
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.accepted, true);
  assert.ok(result.consistencyRatio !== null);
  assert.ok(Math.abs(result.consistencyRatio) < 1e-12);
  assert.deepEqual(
    result.weights.map((weight) => Number(weight.toFixed(6))),
    [0.571429, 0.285714, 0.142857],
  );
  assert.ok(
    Math.abs(result.weights.reduce((sum, weight) => sum + weight, 0) - 1) <
      1e-12,
  );
});

test("AHP rejects inconsistent judgements and malformed reciprocity", () => {
  const inconsistent = auditAhpMatrix([
    [1, 9, 1],
    [1 / 9, 1, 9],
    [1, 1 / 9, 1],
  ]);
  assert.equal(inconsistent.valid, true);
  assert.equal(inconsistent.accepted, false);
  assert.ok((inconsistent.consistencyRatio ?? 0) > 0.1);

  const malformed = auditAhpMatrix([
    [1, 3],
    [1 / 2, 1],
  ]);
  assert.equal(malformed.valid, false);
  assert.equal(malformed.accepted, false);
  assert.match(malformed.errors.join(" "), /not reciprocal/);
});

test("hard constraints keep failures and unknown evidence out of feasibility", () => {
  type Candidate = { spreadCm: number | null; soil: string | null };
  type Context = { maximumSpreadCm: number; requiredSoil: string };

  const constraints: HardConstraint<Candidate, Context>[] = [
    {
      id: "spread",
      description: "Mature spread fits the available width.",
      evaluate: (candidate, context) =>
        candidate.spreadCm === null
          ? { status: "unknown", reason: "Mature spread is missing." }
          : candidate.spreadCm <= context.maximumSpreadCm
            ? { status: "pass", reason: "Mature spread fits." }
            : { status: "fail", reason: "Mature spread is too wide." },
    },
    {
      id: "soil",
      description: "Reviewed soil compatibility.",
      evaluate: (candidate, context) =>
        candidate.soil === null
          ? { status: "unknown", reason: "Soil compatibility is not reviewed." }
          : candidate.soil === context.requiredSoil
            ? { status: "pass", reason: "Soil compatibility is reviewed." }
            : { status: "fail", reason: "Soil type is incompatible." },
    },
  ];

  const review = evaluateHardConstraints(
    { spreadCm: null, soil: "sand" },
    { maximumSpreadCm: 100, requiredSoil: "sand" },
    constraints,
    "review",
  );
  assert.equal(review.status, "review");
  assert.equal(review.feasible, false);
  assert.equal(review.trace[0].status, "unknown");

  const rejected = evaluateHardConstraints(
    { spreadCm: null, soil: "sand" },
    { maximumSpreadCm: 100, requiredSoil: "sand" },
    constraints,
    "reject",
  );
  assert.equal(rejected.status, "infeasible");
});

test("Goal Programming exposes directional deviations and honours priorities", () => {
  const candidateA = evaluateGoalProgram([
    {
      id: "water",
      actual: 2,
      target: 4,
      underPenalty: 3,
      overPenalty: 0,
      priority: 1,
    },
    {
      id: "flowering",
      actual: 5,
      target: 3,
      underPenalty: 1,
      overPenalty: 2,
      priority: 2,
    },
  ]);

  assert.deepEqual(
    candidateA.deviations.map(
      ({ id, underDeviation, overDeviation, weightedPenalty }) => ({
        id,
        underDeviation,
        overDeviation,
        weightedPenalty,
      }),
    ),
    [
      {
        id: "water",
        underDeviation: 2,
        overDeviation: 0,
        weightedPenalty: 6,
      },
      {
        id: "flowering",
        underDeviation: 0,
        overDeviation: 2,
        weightedPenalty: 4,
      },
    ],
  );

  const candidateB = evaluateGoalProgram([
    {
      id: "water",
      actual: 3,
      target: 4,
      underPenalty: 3,
      overPenalty: 0,
      priority: 1,
    },
    {
      id: "flowering",
      actual: -100,
      target: 3,
      underPenalty: 1,
      overPenalty: 0,
      priority: 2,
    },
  ]);

  assert.ok(candidateB.totalWeightedPenalty > candidateA.totalWeightedPenalty);
  assert.ok(compareGoalPrograms(candidateB, candidateA) < 0);
});

test("binary group selection checks area constraints and builds a feasible subset", () => {
  const candidates = [
    { id: "flower-a", suitability: 8, canopyArea: 2, category: "flowers" },
    { id: "flower-b", suitability: 1, canopyArea: 3, category: "flowers" },
    { id: "frame-a", suitability: 9, canopyArea: 4, category: "structure" },
    { id: "frame-b", suitability: 2, canopyArea: 1, category: "structure" },
  ];
  const model = {
    bedArea: 10,
    openSpaceRatio: 0.2,
    categoryRules: [
      { category: "flowers", minimumRatio: 0.2, maximumRatio: 0.4 },
      { category: "structure", maximumRatio: 0.5 },
    ],
  };

  const invalidSelection = checkGroupSelection(
    candidates,
    ["flower-a", "flower-b", "frame-a"],
    model,
  );
  assert.equal(invalidSelection.feasible, false);
  assert.ok(
    invalidSelection.violations.some(
      ({ constraint }) => constraint === "total-area",
    ),
  );

  const result = selectGroupGreedy(candidates, model);
  assert.equal(result.status, "solution");
  assert.equal(result.modelKind, "binary-species-subset");
  assert.equal(result.check.feasible, true);
  assert.ok(result.selectedIds.includes("flower-a"));
  assert.match(result.diagnostics.join(" "), /does not calculate quantities/);
});

test("greedy failure is not presented as a mathematical infeasibility proof", () => {
  const result = selectGroupGreedy(
    [{ id: "frame-a", suitability: 4, canopyArea: 2, category: "structure" }],
    {
      bedArea: 10,
      openSpaceRatio: 0.2,
      categoryRules: [{ category: "flowers", minimumRatio: 0.2 }],
    },
  );

  assert.equal(result.status, "no-feasible-greedy-solution");
  assert.equal(result.check.feasible, false);
  assert.match(result.diagnostics.join(" "), /greedy constructor/i);
});

test("group model rejects contradictory category minimums", () => {
  assert.throws(
    () =>
      selectGroupGreedy(
        [
          { id: "a", suitability: 4, canopyArea: 1, category: "flowers" },
          { id: "b", suitability: 3, canopyArea: 1, category: "structure" },
        ],
        {
          bedArea: 10,
          openSpaceRatio: 0.3,
          categoryRules: [
            { category: "flowers", minimumRatio: 0.4 },
            { category: "structure", minimumRatio: 0.4 },
          ],
        },
      ),
    /minimums exceed the usable planting-area ratio/,
  );
});
