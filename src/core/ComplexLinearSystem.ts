import type {
  ComplexValue,
} from "./NodalAnalysis";

export interface ComplexLinearSystemSolution {
  success: boolean;

  values: ComplexValue[];

  residuals: ComplexValue[];

  maximumResidualMagnitude: number;

  errorMessage: string | null;
}
