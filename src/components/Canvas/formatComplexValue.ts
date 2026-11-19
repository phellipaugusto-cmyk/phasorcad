import type {
  ComplexValue,
} from "../../core/NodalAnalysis";

export function formatComplexValue(
  value: ComplexValue,
  digits = 6
): string {
  const real =
    Math.abs(value.real) <
    1e-12
      ? 0
      : value.real;

  const imaginary =
    Math.abs(value.imaginary) <
    1e-12
      ? 0
      : value.imaginary;

  const sign =
    imaginary >= 0
      ? "+"
      : "-";

  return (
    `${real.toFixed(digits)} ` +
    `${sign} j${Math.abs(
      imaginary
    ).toFixed(digits)}`
  );
}
