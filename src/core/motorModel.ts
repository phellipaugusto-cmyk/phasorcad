import type { CircuitElement } from "./CircuitElement";

/*
 * Motor monofásico de indução como carga, a partir dos dados de
 * placa. É um modelo de impedância constante:
 *
 *   P_el = P_mec / η          potência ativa absorvida (nominal)
 *   S    = P_el / FP          potência aparente
 *   Q    = P_el · tan(φ)      potência reativa (carga indutiva)
 *   Z    = Vn² / S*  =  R + jX   (série),  R = Vn²·P/S²,  X = Vn²·Q/S²
 *   L    = X / (2π·f_nominal)
 *
 * Em outra frequência a reatância vira ωL (R fica fixo); em outra
 * tensão a potência escala com (V/Vn)².
 */

export interface MotorParameters {
  /* Rendimento, de 0 a 1. */
  efficiency: number;
  /* Fator de potência (indutivo), de 0 a 1. */
  powerFactor: number;
  /* Tensão nominal, em V (eficaz). */
  ratedVoltage: number;
}

export const MOTOR_DEFAULTS: MotorParameters = {
  efficiency: 0.85,
  powerFactor: 0.85,
  ratedVoltage: 220,
};

/* Frequência em que a reatância equivalente é calculada. */
export const MOTOR_NOMINAL_FREQUENCY = 60;

/* Potência mecânica padrão de um motor novo: 1 kW. */
export const MOTOR_DEFAULT_POWER_KW = 1;

export const KW_PER_CV = 0.7355;

export function getMotorParameters(
  element: Pick<CircuitElement, "motor">
): MotorParameters {
  const motor = element.motor;

  return {
    efficiency:
      motor && motor.efficiency > 0 && motor.efficiency <= 1
        ? motor.efficiency
        : MOTOR_DEFAULTS.efficiency,
    powerFactor:
      motor && motor.powerFactor > 0 && motor.powerFactor <= 1
        ? motor.powerFactor
        : MOTOR_DEFAULTS.powerFactor,
    ratedVoltage:
      motor && motor.ratedVoltage > 0
        ? motor.ratedVoltage
        : MOTOR_DEFAULTS.ratedVoltage,
  };
}

export interface MotorEquivalent {
  /* Potências nominais. */
  activePower: number;
  reactivePower: number;
  apparentPower: number;
  /* Corrente nominal (A, eficaz). */
  ratedCurrent: number;
  /* Circuito série equivalente. */
  resistance: number;
  reactance: number;
  inductance: number;
}

/* value = potência mecânica no eixo, em kW. */
export function getMotorEquivalent(
  element: Pick<CircuitElement, "value" | "motor">
): MotorEquivalent | null {
  if (!(element.value > 0)) {
    return null;
  }

  const { efficiency, powerFactor, ratedVoltage } =
    getMotorParameters(element);

  const activePower = (element.value * 1000) / efficiency;
  const apparentPower = activePower / powerFactor;
  const reactivePower = Math.sqrt(
    Math.max(apparentPower ** 2 - activePower ** 2, 0)
  );

  const resistance =
    (ratedVoltage ** 2 * activePower) / apparentPower ** 2;

  const reactance =
    (ratedVoltage ** 2 * reactivePower) / apparentPower ** 2;

  return {
    activePower,
    reactivePower,
    apparentPower,
    ratedCurrent: apparentPower / ratedVoltage,
    resistance,
    reactance,
    inductance: reactance / (2 * Math.PI * MOTOR_NOMINAL_FREQUENCY),
  };
}

/* Admitância Y = 1/(R + jωL) na frequência dada. */
export function getMotorAdmittance(
  element: Pick<CircuitElement, "value" | "motor">,
  frequency: number
): { real: number; imaginary: number } | null {
  const equivalent = getMotorEquivalent(element);

  if (!equivalent || !(frequency > 0)) {
    return null;
  }

  const omega = 2 * Math.PI * frequency;
  const x = omega * equivalent.inductance;
  const r = equivalent.resistance;
  const denominator = r * r + x * x;

  if (denominator <= 0) {
    return null;
  }

  return { real: r / denominator, imaginary: -x / denominator };
}
