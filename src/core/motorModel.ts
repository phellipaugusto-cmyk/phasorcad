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
 *
 * Carga no eixo (loadFactor = x, fração da potência nominal):
 * o motor continua sendo uma impedância, mas calculada no ponto
 * de operação x, com as curvas típicas de um motor de indução:
 *
 *   Perdas nominais   L  = P_el,n − P_mec,n
 *   Perdas fixas      Lf = 50 % de L  (ferro + atrito/ventilação)
 *   Perdas no cobre   Lc = 50 % de L  (crescem com x²)
 *   P_el(x) = Lf + x·P_mec,n + x²·Lc
 *   Q(x)    = Q_n · (0,6 + 0,4·x²)   (magnetização ≈ constante)
 *
 * Assim, a vazio (x = 0) o motor absorve só as perdas fixas e a
 * maior parte do reativo: corrente alta para a potência e FP
 * baixo. Em x = 1 o resultado é exatamente o de placa.
 */

export interface MotorParameters {
  /* Rendimento, de 0 a 1. */
  efficiency: number;
  /* Fator de potência (indutivo), de 0 a 1. */
  powerFactor: number;
  /* Tensão nominal, em V (eficaz). */
  ratedVoltage: number;
  /* Carga no eixo / carga nominal (0 a MOTOR_MAX_LOAD_FACTOR). */
  loadFactor: number;
}

export const MOTOR_DEFAULTS: MotorParameters = {
  efficiency: 0.85,
  powerFactor: 0.85,
  ratedVoltage: 220,
  loadFactor: 1,
};

export const MOTOR_MAX_LOAD_FACTOR = 1.5;

/* Parte das perdas nominais que não depende da carga. */
export const MOTOR_FIXED_LOSS_FRACTION = 0.5;

/* Reativo a vazio como fração do reativo nominal. */
export const MOTOR_NO_LOAD_REACTIVE_FRACTION = 0.6;

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
    loadFactor:
      motor &&
      typeof motor.loadFactor === "number" &&
      Number.isFinite(motor.loadFactor)
        ? Math.min(MOTOR_MAX_LOAD_FACTOR, Math.max(0, motor.loadFactor))
        : MOTOR_DEFAULTS.loadFactor,
  };
}

export interface MotorEquivalent {
  /* Potências no ponto de operação (na tensão nominal). */
  activePower: number;
  reactivePower: number;
  apparentPower: number;
  /* Corrente no ponto de operação, na tensão nominal (A, eficaz). */
  ratedCurrent: number;
  /* Ponto de operação. */
  loadFactor: number;
  shaftPower: number;
  efficiency: number;
  powerFactor: number;
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

  const { efficiency, powerFactor, ratedVoltage, loadFactor } =
    getMotorParameters(element);

  const x = loadFactor;
  const ratedShaftPower = element.value * 1000;
  const ratedActivePower = ratedShaftPower / efficiency;
  const ratedReactivePower =
    ratedActivePower * Math.tan(Math.acos(powerFactor));

  const losses = ratedActivePower - ratedShaftPower;
  const fixedLosses = MOTOR_FIXED_LOSS_FRACTION * losses;
  const copperLosses = losses - fixedLosses;

  const shaftPower = x * ratedShaftPower;
  const activePower = fixedLosses + shaftPower + x * x * copperLosses;
  const reactivePower =
    ratedReactivePower *
    (MOTOR_NO_LOAD_REACTIVE_FRACTION +
      (1 - MOTOR_NO_LOAD_REACTIVE_FRACTION) * x * x);
  const apparentPower = Math.hypot(activePower, reactivePower);

  if (!(apparentPower > 0)) {
    return null;
  }

  const resistance =
    (ratedVoltage ** 2 * activePower) / apparentPower ** 2;

  const reactance =
    (ratedVoltage ** 2 * reactivePower) / apparentPower ** 2;

  return {
    activePower,
    reactivePower,
    apparentPower,
    ratedCurrent: apparentPower / ratedVoltage,
    loadFactor: x,
    shaftPower,
    efficiency: shaftPower / activePower,
    powerFactor: activePower / apparentPower,
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
