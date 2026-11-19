import type {
  ComplexLinearSystemSolution,
} from "../core/ComplexLinearSystem";

import type {
  ComplexValue,
} from "../core/NodalAnalysis";

const PIVOT_TOLERANCE =
  1e-12;

function createComplex(
  real = 0,
  imaginary = 0
): ComplexValue {
  return {
    real,
    imaginary,
  };
}

function cloneComplex(
  value: ComplexValue
): ComplexValue {
  return {
    real:
      value.real,

    imaginary:
      value.imaginary,
  };
}

function add(
  first: ComplexValue,
  second: ComplexValue
): ComplexValue {
  return createComplex(
    first.real +
      second.real,

    first.imaginary +
      second.imaginary
  );
}

function subtract(
  first: ComplexValue,
  second: ComplexValue
): ComplexValue {
  return createComplex(
    first.real -
      second.real,

    first.imaginary -
      second.imaginary
  );
}

function multiply(
  first: ComplexValue,
  second: ComplexValue
): ComplexValue {
  return createComplex(
    first.real *
      second.real -
      first.imaginary *
        second.imaginary,

    first.real *
      second.imaginary +
      first.imaginary *
        second.real
  );
}

function divide(
  numerator: ComplexValue,
  denominator: ComplexValue
): ComplexValue {
  const denominatorMagnitudeSquared =
    denominator.real *
      denominator.real +
    denominator.imaginary *
      denominator.imaginary;

  if (
    denominatorMagnitudeSquared <
    PIVOT_TOLERANCE *
      PIVOT_TOLERANCE
  ) {
    throw new Error(
      "Divisão por pivô complexo próximo de zero."
    );
  }

  return createComplex(
    (
      numerator.real *
        denominator.real +
      numerator.imaginary *
        denominator.imaginary
    ) /
      denominatorMagnitudeSquared,

    (
      numerator.imaginary *
        denominator.real -
      numerator.real *
        denominator.imaginary
    ) /
      denominatorMagnitudeSquared
  );
}

function magnitude(
  value: ComplexValue
): number {
  return Math.hypot(
    value.real,
    value.imaginary
  );
}

function validateDimensions(
  matrix: ComplexValue[][],
  rightHandSide: ComplexValue[]
): string | null {
  const size =
    matrix.length;

  if (size === 0) {
    return null;
  }

  if (
    rightHandSide.length !==
    size
  ) {
    return "O vetor independente não possui a mesma dimensão da matriz.";
  }

  const invalidRow =
    matrix.find(
      (row) =>
        row.length !==
        size
    );

  if (invalidRow) {
    return "A matriz do sistema não é quadrada.";
  }

  return null;
}

function calculateResiduals(
  originalMatrix: ComplexValue[][],
  originalRightHandSide: ComplexValue[],
  solution: ComplexValue[]
): {
  residuals: ComplexValue[];

  maximumResidualMagnitude: number;
} {
  const residuals =
    originalMatrix.map(
      (row, rowIndex) => {
        const calculated =
          row.reduce(
            (
              accumulator,
              coefficient,
              columnIndex
            ) =>
              add(
                accumulator,
                multiply(
                  coefficient,
                  solution[
                    columnIndex
                  ]
                )
              ),
            createComplex()
          );

        return subtract(
          calculated,
          originalRightHandSide[
            rowIndex
          ]
        );
      }
    );

  const maximumResidualMagnitude =
    residuals.reduce(
      (
        currentMaximum,
        residual
      ) =>
        Math.max(
          currentMaximum,
          magnitude(
            residual
          )
        ),
      0
    );

  return {
    residuals,
    maximumResidualMagnitude,
  };
}

export class ComplexLinearSolver {
  static solve(
    matrix: ComplexValue[][],
    rightHandSide: ComplexValue[]
  ): ComplexLinearSystemSolution {
    const dimensionError =
      validateDimensions(
        matrix,
        rightHandSide
      );

    if (dimensionError) {
      return {
        success:
          false,

        values:
          [],

        residuals:
          [],

        maximumResidualMagnitude:
          Number.POSITIVE_INFINITY,

        errorMessage:
          dimensionError,
      };
    }

    const size =
      matrix.length;

    if (size === 0) {
      return {
        success:
          true,

        values:
          [],

        residuals:
          [],

        maximumResidualMagnitude:
          0,

        errorMessage:
          null,
      };
    }

    const originalMatrix =
      matrix.map(
        (row) =>
          row.map(
            cloneComplex
          )
      );

    const originalRightHandSide =
      rightHandSide.map(
        cloneComplex
      );

    const workingMatrix =
      originalMatrix.map(
        (row) =>
          row.map(
            cloneComplex
          )
      );

    const workingRightHandSide =
      originalRightHandSide.map(
        cloneComplex
      );

    try {
      for (
        let pivotColumn = 0;
        pivotColumn < size;
        pivotColumn += 1
      ) {
        let pivotRow =
          pivotColumn;

        let pivotMagnitude =
          magnitude(
            workingMatrix[
              pivotColumn
            ][pivotColumn]
          );

        for (
          let candidateRow =
            pivotColumn + 1;
          candidateRow < size;
          candidateRow += 1
        ) {
          const candidateMagnitude =
            magnitude(
              workingMatrix[
                candidateRow
              ][pivotColumn]
            );

          if (
            candidateMagnitude >
            pivotMagnitude
          ) {
            pivotMagnitude =
              candidateMagnitude;

            pivotRow =
              candidateRow;
          }
        }

        if (
          pivotMagnitude <
          PIVOT_TOLERANCE
        ) {
          return {
            success:
              false,

            values:
              [],

            residuals:
              [],

            maximumResidualMagnitude:
              Number.POSITIVE_INFINITY,

            errorMessage:
              `Sistema singular ou mal condicionado na coluna ${pivotColumn}.`,
          };
        }

        if (
          pivotRow !==
          pivotColumn
        ) {
          const temporaryRow =
            workingMatrix[
              pivotColumn
            ];

          workingMatrix[
            pivotColumn
          ] =
            workingMatrix[
              pivotRow
            ];

          workingMatrix[
            pivotRow
          ] =
            temporaryRow;

          const temporaryValue =
            workingRightHandSide[
              pivotColumn
            ];

          workingRightHandSide[
            pivotColumn
          ] =
            workingRightHandSide[
              pivotRow
            ];

          workingRightHandSide[
            pivotRow
          ] =
            temporaryValue;
        }

        const pivot =
          workingMatrix[
            pivotColumn
          ][pivotColumn];

        for (
          let targetRow =
            pivotColumn + 1;
          targetRow < size;
          targetRow += 1
        ) {
          const factor =
            divide(
              workingMatrix[
                targetRow
              ][pivotColumn],
              pivot
            );

          workingMatrix[
            targetRow
          ][pivotColumn] =
            createComplex();

          for (
            let targetColumn =
              pivotColumn + 1;
            targetColumn < size;
            targetColumn += 1
          ) {
            workingMatrix[
              targetRow
            ][targetColumn] =
              subtract(
                workingMatrix[
                  targetRow
                ][targetColumn],
                multiply(
                  factor,
                  workingMatrix[
                    pivotColumn
                  ][targetColumn]
                )
              );
          }

          workingRightHandSide[
            targetRow
          ] =
            subtract(
              workingRightHandSide[
                targetRow
              ],
              multiply(
                factor,
                workingRightHandSide[
                  pivotColumn
                ]
              )
            );
        }
      }

      const solution =
        Array.from(
          {
            length:
              size,
          },
          () =>
            createComplex()
        );

      for (
        let rowIndex =
          size - 1;
        rowIndex >= 0;
        rowIndex -= 1
      ) {
        let accumulated =
          createComplex();

        for (
          let columnIndex =
            rowIndex + 1;
          columnIndex < size;
          columnIndex += 1
        ) {
          accumulated =
            add(
              accumulated,
              multiply(
                workingMatrix[
                  rowIndex
                ][columnIndex],
                solution[
                  columnIndex
                ]
              )
            );
        }

        const numerator =
          subtract(
            workingRightHandSide[
              rowIndex
            ],
            accumulated
          );

        solution[rowIndex] =
          divide(
            numerator,
            workingMatrix[
              rowIndex
            ][rowIndex]
          );
      }

      const {
        residuals,
        maximumResidualMagnitude,
      } = calculateResiduals(
        originalMatrix,
        originalRightHandSide,
        solution
      );

      return {
        success:
          true,

        values:
          solution,

        residuals,
        maximumResidualMagnitude,

        errorMessage:
          null,
      };
    } catch (error) {
      return {
        success:
          false,

        values:
          [],

        residuals:
          [],

        maximumResidualMagnitude:
          Number.POSITIVE_INFINITY,

        errorMessage:
          error instanceof Error
            ? error.message
            : "Falha desconhecida ao resolver o sistema complexo.",
      };
    }
  }
}
