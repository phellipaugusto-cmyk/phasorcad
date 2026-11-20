import type {
  CircuitTerminal,
} from "./CircuitTerminal";

export type CircuitElementType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "motor"
  | "lamp"
  | "switch"
  | "contactor"
  | "impedance"
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

export type ThreePhaseRole = "A" | "B" | "C";

/*
 * Membro de um bloco trifásico equilibrado (gerador ou carga em
 * Y ou Δ). Os três membros de um bloco compartilham `id`.
 *
 *   Gerador Y: fonte de cada fase, terminal esq. = neutro,
 *              dir. = linha (role).
 *   Gerador Δ: role A = V_AB (dir. = A, esq. = B), B = V_BC,
 *              C = V_CA.
 *   Carga Y:   impedância de cada fase, esq. = linha, dir. = neutro.
 *   Carga Δ:   role A = Z_AB (esq. = A, dir. = B), B = Z_BC,
 *              C = Z_CA.
 */
export interface ThreePhaseGroup {
  id: string;
  kind: "source" | "load";
  connection: "Y" | "D";
  role: ThreePhaseRole;
  /* Só para geradores. Ausente = ABC (sequência positiva). */
  sequence?: "ABC" | "ACB";
  /*
   * Só para cargas: false = desequilibrada (cada fase com a sua Z).
   * Ausente = equilibrada.
   */
  balanced?: boolean;
}

export interface MeasuredReadings {
  voltage?: number;
  current?: number;
  power?: number;
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
    /*
     * Carga no eixo como fração da nominal (0 = a vazio,
     * 1 = nominal, 1,5 = 50 % de sobrecarga). Ausente = 1.
     */
    loadFactor?: number;
  };

  /*
   * Lâmpada incandescente (só para type "lamp"): `value` é a
   * potência nominal em W, dada na tensão nominal abaixo.
   */
  lamp?: {
    ratedVoltage: number;
  };

  /*
   * Interruptor / contato de contator (só para type "switch"):
   * true = fechado (conduz). Ausente = fechado.
   */
  closed?: boolean;

  /*
   * Contato comandado (só para type "switch"): id da bobina do
   * contator que o aciona. Com isso o estado vem da bobina e
   * `closed` é calculado automaticamente.
   */
  controlledBy?: string;

  /*
   * Contato NF. Comandado: fecha com a bobina desenergizada.
   * Botoeira: fechado em repouso, abre ao pressionar. Ausente = NA.
   */
  normallyClosed?: boolean;

  /*
   * Botoeira (só para type "switch" manual): volta sozinha ao
   * repouso. `pressed` é transitório (não vai para o arquivo).
   */
  momentary?: boolean;
  pressed?: boolean;

  /*
   * Bobina de contator (só para type "contactor"): `value` é a
   * potência aparente de retenção, em VA, na tensão nominal.
   */
  contactor?: {
    ratedVoltage: number;
    powerFactor: number;
  };

  /*
   * Memória da bobina (só para type "contactor"): estado em que
   * ela ficou na última análise. É o que permite o contato de selo
   * manter o contator ligado depois que a botoeira é solta.
   */
  energized?: boolean;

  /*
   * Leituras feitas na bancada (opcional), para comparar com o
   * valor simulado: tensão (V), corrente (A) e potência ativa (W),
   * todas eficazes.
   */
  measured?: MeasuredReadings;

  /*
   * Impedância genérica Z = R + jX (só para type "impedance"),
   * com X dado em 60 Hz: X > 0 (indutiva) cresce com f, X < 0
   * (capacitiva) cai com 1/f. `value` guarda |Z| em 60 Hz.
   */
  impedance?: {
    resistance: number;
    reactance: number;
  };

  /*
   * Resistência interna de uma fonte de tensão (Ω). Necessária
   * para um gerador em Δ (três fontes ideais em malha não têm
   * solução única). Ausente = fonte ideal.
   */
  internalResistance?: number;

  /* Bloco trifásico a que este componente pertence. */
  group?: ThreePhaseGroup;

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
