export const SAATY_RANDOM_INDEX: Readonly<Record<number, number>> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.51,
};

export type AhpAuditOptions = {
  consistencyThreshold?: number;
  reciprocityTolerance?: number;
  randomIndex?: number;
};

export type AhpAudit = {
  matrixSize: number;
  valid: boolean;
  accepted: boolean;
  errors: string[];
  weights: number[];
  normalizedMatrix: number[][];
  lambdaMax: number | null;
  consistencyIndex: number | null;
  consistencyRatio: number | null;
  consistencyThreshold: number;
  randomIndex: number | null;
};

const DEFAULT_THRESHOLD = 0.1;
const DEFAULT_RECIPROCITY_TOLERANCE = 1e-6;

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Audits an AHP pairwise-comparison matrix using the method specified in the
 * literature review: column normalisation followed by row averaging.
 */
export function auditAhpMatrix(
  matrix: readonly (readonly number[])[],
  options: AhpAuditOptions = {},
): AhpAudit {
  const matrixSize = matrix.length;
  const consistencyThreshold =
    options.consistencyThreshold ?? DEFAULT_THRESHOLD;
  const reciprocityTolerance =
    options.reciprocityTolerance ?? DEFAULT_RECIPROCITY_TOLERANCE;
  const errors: string[] = [];

  if (!Number.isFinite(consistencyThreshold) || consistencyThreshold <= 0) {
    errors.push("The consistency threshold must be a finite, positive number.");
  }

  if (!Number.isFinite(reciprocityTolerance) || reciprocityTolerance < 0) {
    errors.push("The reciprocity tolerance must be a finite, non-negative number.");
  }

  if (matrixSize === 0) {
    errors.push("The comparison matrix must contain at least one criterion.");
  }

  matrix.forEach((row, rowIndex) => {
    if (row.length !== matrixSize) {
      errors.push(
        `Row ${rowIndex + 1} has ${row.length} values; expected ${matrixSize}.`,
      );
    }
  });

  const square = matrixSize > 0 && matrix.every((row) => row.length === matrixSize);

  if (square) {
    for (let rowIndex = 0; rowIndex < matrixSize; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < matrixSize; columnIndex += 1) {
        const value = matrix[rowIndex][columnIndex];

        if (!isPositiveFinite(value)) {
          errors.push(
            `Matrix value [${rowIndex + 1}, ${columnIndex + 1}] must be positive and finite.`,
          );
          continue;
        }

        if (
          rowIndex === columnIndex &&
          Math.abs(value - 1) > reciprocityTolerance
        ) {
          errors.push(
            `Diagonal value [${rowIndex + 1}, ${columnIndex + 1}] must equal 1.`,
          );
        }

        if (columnIndex > rowIndex) {
          const reciprocal = matrix[columnIndex][rowIndex];
          if (
            isPositiveFinite(reciprocal) &&
            Math.abs(value * reciprocal - 1) > reciprocityTolerance
          ) {
            errors.push(
              `Values [${rowIndex + 1}, ${columnIndex + 1}] and [${columnIndex + 1}, ${rowIndex + 1}] are not reciprocal.`,
            );
          }
        }
      }
    }
  }

  const numericallyUsable =
    square &&
    matrixSize > 0 &&
    matrix.every((row) => row.every((value) => isPositiveFinite(value)));

  if (!numericallyUsable) {
    return {
      matrixSize,
      valid: false,
      accepted: false,
      errors,
      weights: [],
      normalizedMatrix: [],
      lambdaMax: null,
      consistencyIndex: null,
      consistencyRatio: null,
      consistencyThreshold,
      randomIndex: null,
    };
  }

  const columnTotals = Array.from({ length: matrixSize }, (_, columnIndex) =>
    matrix.reduce((sum, row) => sum + row[columnIndex], 0),
  );

  const normalizedMatrix = matrix.map((row) =>
    row.map((value, columnIndex) => value / columnTotals[columnIndex]),
  );

  const weights = normalizedMatrix.map(
    (row) => row.reduce((sum, value) => sum + value, 0) / matrixSize,
  );

  const weightedSums = matrix.map((row) =>
    row.reduce(
      (sum, value, columnIndex) => sum + value * weights[columnIndex],
      0,
    ),
  );

  const lambdaMax =
    weightedSums.reduce(
      (sum, value, rowIndex) => sum + value / weights[rowIndex],
      0,
    ) / matrixSize;

  const consistencyIndex =
    matrixSize <= 2
      ? 0
      : Math.max(0, (lambdaMax - matrixSize) / (matrixSize - 1));
  const configuredRandomIndex =
    options.randomIndex ?? SAATY_RANDOM_INDEX[matrixSize];
  const randomIndex =
    configuredRandomIndex === undefined ? null : configuredRandomIndex;

  if (
    randomIndex !== null &&
    (!Number.isFinite(randomIndex) || randomIndex < 0)
  ) {
    errors.push("The random index must be a finite, non-negative number.");
  }

  if (randomIndex === null) {
    errors.push(
      `No random index is configured for a ${matrixSize} × ${matrixSize} matrix.`,
    );
  }

  const usableRandomIndex =
    randomIndex !== null && Number.isFinite(randomIndex) && randomIndex >= 0;
  const consistencyRatio = !usableRandomIndex
    ? null
    : randomIndex === 0
      ? 0
      : consistencyIndex / randomIndex;
  const valid = errors.length === 0;

  return {
    matrixSize,
    valid,
    accepted:
      valid &&
      consistencyRatio !== null &&
      consistencyRatio < consistencyThreshold,
    errors,
    weights,
    normalizedMatrix,
    lambdaMax,
    consistencyIndex,
    consistencyRatio,
    consistencyThreshold,
    randomIndex,
  };
}
