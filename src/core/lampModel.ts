import type { CircuitElement } from "./CircuitElement";

/*
 * Lâmpada incandescente como resistor puro, a partir dos dados
 * de placa (potência e tensão nominais):
 *
 *   R = Vn² / Pn          (ex.: 60 W / 127 V → R ≈ 268,8 Ω)
 *
 * Em outra tensão a potência vira V²/R. O filamento real tem
 * resistência que cresce com a temperatura; aqui R é fixo (o
 * valor "a quente", na condição nominal).
 */

export const LAMP_DEFAULT_POWER_W = 60;
export const LAMP_DEFAULT_VOLTAGE = 127;

export function getLampRatedVoltage(
  element: Pick<CircuitElement, "lamp">
): number {
  const volts = element.lamp?.ratedVoltage;

  return volts !== undefined && Number.isFinite(volts) && volts > 0
    ? volts
    : LAMP_DEFAULT_VOLTAGE;
}

/* Resistência equivalente (Ω); null se a potência não for positiva. */
export function getLampResistance(
  element: Pick<CircuitElement, "value" | "lamp">
): number | null {
  if (!(element.value > 0)) {
    return null;
  }

  return getLampRatedVoltage(element) ** 2 / element.value;
}

export function getLampAdmittance(
  element: Pick<CircuitElement, "value" | "lamp">
): { real: number; imaginary: number } | null {
  const resistance = getLampResistance(element);

  return resistance ? { real: 1 / resistance, imaginary: 0 } : null;
}
