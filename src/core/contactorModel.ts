import type { CircuitElement } from "./CircuitElement";

/*
 * Bobina de contator como carga, a partir dos dados de catálogo:
 *
 *   S = potência de retenção (VA) na tensão nominal Vn
 *   Z = Vn² / S  ∠ acos(FP)    (indutiva)
 *
 * A bobina fica "energizada" quando a tensão sobre ela chega a
 * CONTACTOR_PICKUP_FRACTION da nominal (contatores CA costumam
 * operar a partir de 80–85 % de Vn; 70 % aqui é um meio-termo
 * folgado). Energizada, ela fecha os contatos NA e abre os NF que
 * têm `controlledBy` apontando para ela.
 */

export interface ContactorParameters {
  ratedVoltage: number;
  powerFactor: number;
}

export const CONTACTOR_DEFAULTS: ContactorParameters = {
  ratedVoltage: 127,
  powerFactor: 0.35,
};

/* Potência de retenção típica de um contator pequeno (VA). */
export const CONTACTOR_DEFAULT_HOLDING_VA = 8;

export const CONTACTOR_PICKUP_FRACTION = 0.7;

export function getContactorParameters(
  element: Pick<CircuitElement, "contactor">
): ContactorParameters {
  const raw = element.contactor;

  return {
    ratedVoltage:
      raw && Number.isFinite(raw.ratedVoltage) && raw.ratedVoltage > 0
        ? raw.ratedVoltage
        : CONTACTOR_DEFAULTS.ratedVoltage,
    powerFactor:
      raw &&
      Number.isFinite(raw.powerFactor) &&
      raw.powerFactor > 0 &&
      raw.powerFactor <= 1
        ? raw.powerFactor
        : CONTACTOR_DEFAULTS.powerFactor,
  };
}

/* Admitância da bobina, Y = 1/Z; R e L fixos (L calculado em 60 Hz). */
export function getContactorAdmittance(
  element: Pick<CircuitElement, "value" | "contactor">,
  frequency: number
): { real: number; imaginary: number } | null {
  if (!(element.value > 0) || !(frequency > 0)) {
    return null;
  }

  const { ratedVoltage, powerFactor } = getContactorParameters(element);
  const impedance = ratedVoltage ** 2 / element.value;
  const r = impedance * powerFactor;
  const x60 = impedance * Math.sin(Math.acos(powerFactor));
  const x = (x60 * frequency) / 60;
  const denominator = r * r + x * x;

  return { real: r / denominator, imaginary: -x / denominator };
}

export function isCoilEnergized(
  element: Pick<CircuitElement, "contactor">,
  coilVoltage: number
): boolean {
  return (
    coilVoltage >=
    CONTACTOR_PICKUP_FRACTION * getContactorParameters(element).ratedVoltage
  );
}
