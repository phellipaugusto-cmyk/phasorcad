import type {
  CircuitTerminal,
} from "./CircuitTerminal";

export type CircuitElementType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "motor"
  | "source"
  | "currentSource";

/*
 * Fonte de tensão ("source") ou de corrente ("currentSource").
 * O circuito aceita uma única fonte de qualquer um dos tipos.
 */
export function isSourceType(
  type: CircuitElementType
): type is "source" | "currentSource" {
  return (
    type === "source" ||
    type === "currentSource"
  );
}

export interface CircuitElement {
  id: string;

  type: CircuitElementType;

  label: string;

  value: number;

  /*
   * Ângulo de fase da fonte, em graus. Só vale para fontes;
   * ausente significa 0° (a referência de fase do circuito).
   */
  phase?: number;

  /*
   * Dados de placa do motor (só para type "motor"). `value` é a
   * potência mecânica no eixo, em kW. Campos ausentes usam
   * MOTOR_DEFAULTS.
   */
  motor?: {
    efficiency: number;
    powerFactor: number;
    ratedVoltage: number;
  };

  x: number;

  y: number;

  terminals: [
    CircuitTerminal,
    CircuitTerminal
  ];
}

/*
 * Valor complexo (eficaz) da fonte: módulo ∠ fase.
 * 220 V ∠0° → 220 + j0; 1 A ∠90° → 0 + j1.
 */
export function getSourcePhasor(
  element: CircuitElement
): { real: number; imaginary: number } {
  const angle =
    ((element.phase ?? 0) * Math.PI) / 180;

  /* Evita ruído como 6e-15 em ângulos como 90°. */
  const clean = (value: number) =>
    Math.abs(value) < 1e-12 ? 0 : value;

  return {
    real: clean(element.value * Math.cos(angle)),
    imaginary: clean(element.value * Math.sin(angle)),
  };
}
