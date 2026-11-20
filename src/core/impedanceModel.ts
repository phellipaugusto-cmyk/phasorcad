import type { CircuitElement } from "./CircuitElement";

/*
 * Impedância genérica Z = R + jX, com a reatância dada na
 * frequência de referência (60 Hz):
 *
 *   X > 0 (indutiva):   X(f) = X60 · f / 60   (X = ωL)
 *   X < 0 (capacitiva): X(f) = X60 · 60 / f   (X = −1/ωC)
 */

export const IMPEDANCE_REFERENCE_FREQUENCY = 60;

export interface ImpedanceParameters {
  resistance: number;
  reactance: number;
}

export const IMPEDANCE_DEFAULTS: ImpedanceParameters = {
  resistance: 10,
  reactance: 5,
};

export function getImpedanceParameters(
  element: Pick<CircuitElement, "impedance">
): ImpedanceParameters {
  const raw = element.impedance;

  return {
    resistance:
      raw && Number.isFinite(raw.resistance) && raw.resistance >= 0
        ? raw.resistance
        : IMPEDANCE_DEFAULTS.resistance,
    reactance:
      raw && Number.isFinite(raw.reactance)
        ? raw.reactance
        : IMPEDANCE_DEFAULTS.reactance,
  };
}

export function getImpedanceAt(
  element: Pick<CircuitElement, "impedance">,
  frequency: number
): ImpedanceParameters {
  const { resistance, reactance } = getImpedanceParameters(element);
  const ratio = frequency / IMPEDANCE_REFERENCE_FREQUENCY;

  return {
    resistance,
    reactance:
      reactance >= 0
        ? reactance * ratio
        : ratio > 0
          ? reactance / ratio
          : -Infinity,
  };
}

export function getImpedanceMagnitude(params: ImpedanceParameters): number {
  return Math.hypot(params.resistance, params.reactance);
}

export function getImpedanceAdmittance(
  element: Pick<CircuitElement, "impedance">,
  frequency: number
): { real: number; imaginary: number } | null {
  if (!(frequency > 0)) {
    return null;
  }

  const { resistance, reactance } = getImpedanceAt(element, frequency);
  const denominator = resistance ** 2 + reactance ** 2;

  if (!(denominator > 0) || !Number.isFinite(denominator)) {
    return null;
  }

  return {
    real: resistance / denominator,
    imaginary: -reactance / denominator,
  };
}

/* "10 + j5 Ω" / "10 − j5 Ω" (vírgula decimal opcional). */
export function formatImpedance(
  params: ImpedanceParameters,
  decimalComma = false
): string {
  const n = (value: number) => {
    const text = String(Number(value.toPrecision(4)));
    return decimalComma ? text.replace(".", ",") : text;
  };
  const sign = params.reactance < 0 ? "−" : "+";

  return `${n(params.resistance)} ${sign} j${n(Math.abs(params.reactance))} Ω`;
}
