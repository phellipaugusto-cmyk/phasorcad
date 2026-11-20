import type { CircuitElement } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import {
  createThreePhaseLoad,
  createThreePhaseSource,
  getGroupTerminals,
} from "../core/threePhase";

/*
 * Exemplos trifásicos equilibrados (sistema 220/127 V, 60 Hz):
 * gerador e carga em Y ou Δ, Z = 8 + j6 Ω por fase (|Z| = 10 Ω,
 * FP 0,8 indutivo). Contas de mão para conferir:
 *
 *   Y-Y: V_F = 127 V, I_L = I_F = 12,7 A,  P = 3 871 W
 *   Y-Δ: V_F = 220 V, I_F = 22 A, I_L = 38,1 A, P = 11 616 W
 *   Δ-Y e Δ-Δ: iguais a Y-Y e Y-Δ (a carga só "vê" as linhas)
 *
 * Desequilibrados (mesmo gerador Y 220/127 V):
 *   Z_A = 10 Ω, Z_B = 6 + j8 Ω, Z_C = 5 − j5 Ω
 *   Y-Y com neutro: cada fase com 127 V; I_N ≠ 0
 *   Y-Y sem neutro: o neutro da carga se desloca (Millman)
 *   Y-Δ: as mesmas Z como Z_AB, Z_BC, Z_CA
 *
 * Gerador desequilibrado (carga equilibrada 8 + j6 Ω em Y com
 * neutro): V_AN = 127 ∠0°, V_BN = 115 ∠−125°, V_CN = 135 ∠118°.
 */

export type ThreePhasePresetKind =
  | "YY"
  | "YD"
  | "DY"
  | "DD"
  | "YYn-u"
  | "YY-u"
  | "YD-u"
  | "YYn-us"
  | "ap-8.18"
  | "ap-8.1"
  | "ap-8.2"
  | "ap-8.34";

export const THREE_PHASE_PRESETS: { kind: ThreePhasePresetKind; title: string }[] = [
  { kind: "YY", title: "Trifásico Y-Y (com neutro)" },
  { kind: "YD", title: "Trifásico Y-Δ" },
  { kind: "DY", title: "Trifásico Δ-Y" },
  { kind: "DD", title: "Trifásico Δ-Δ" },
  { kind: "YYn-u", title: "Desequilibrado Y-Y com neutro" },
  { kind: "YY-u", title: "Desequilibrado Y-Y sem neutro" },
  { kind: "YD-u", title: "Desequilibrado Y-Δ" },
  { kind: "YYn-us", title: "Gerador desequilibrado Y-Y com neutro" },
  { kind: "ap-8.18", title: "Apostila Fig. 8.18 — Y-Y com neutro, 120 V, 3 + j4 Ω" },
  { kind: "ap-8.1", title: "Apostila Ex. 8.1 — Y a 4 fios desequilibrada" },
  { kind: "ap-8.2", title: "Apostila Ex. 8.2 — rompimento do neutro" },
  { kind: "ap-8.34", title: "Apostila Fig. 8.34 — indicador de sequência" },
];

/*
 * Exemplos da apostila (Circuitos Elétricos II, cap. 8), com as
 * respostas dela para conferir:
 *   Fig. 8.18: E_AN = 120 V ∠0°, Z = 3 + j4 Ω → I = 24 A ∠−53,13°
 *   Ex. 8.1:   220/127 V, Z1 = 12,7 Ω, Z2 = 8 + j6 Ω, Z3 = 25,4 Ω
 *              → I_N = 4,23 A ∠−171,04°
 *   Ex. 8.2:   o mesmo sem neutro → V_an = 145,7 V ∠3,50°,
 *              V_bn = 110,7 V ∠−114,04°, V_cn = 127,1 V ∠110,77°
 *   Fig. 8.34: E_AB = 200 V ∠0°, Z1 = 16 µF, Z2 = Z3 = 200 Ω
 *              (lâmpadas) → I_bn ≈ 0,91 A, I_cn ≈ 0,26 A (ABC)
 */
interface PresetSpec {
  source: "Y" | "D";
  lineVoltage: number;
  load: "Y" | "D";
  impedance: { resistance: number; reactance: number };
  impedances?: Record<"A" | "B" | "C", { resistance: number; reactance: number }>;
  phasors?: Record<"A" | "B" | "C", { value: number; phase: number }>;
  neutral: boolean;
}

const EX_8_1_IMPEDANCES = {
  A: { resistance: 12.7, reactance: 0 },
  B: { resistance: 8, reactance: 6 },
  C: { resistance: 25.4, reactance: 0 },
};

const SPECS: Partial<Record<ThreePhasePresetKind, PresetSpec>> = {
  "ap-8.18": { source: "Y", lineVoltage: 120 * Math.sqrt(3), load: "Y", impedance: { resistance: 3, reactance: 4 }, neutral: true },
  "ap-8.1": { source: "Y", lineVoltage: 220, load: "Y", impedance: EX_8_1_IMPEDANCES.A, impedances: EX_8_1_IMPEDANCES, neutral: true },
  "ap-8.2": { source: "Y", lineVoltage: 220, load: "Y", impedance: EX_8_1_IMPEDANCES.A, impedances: EX_8_1_IMPEDANCES, neutral: false },
  "ap-8.34": {
    source: "D",
    lineVoltage: 200,
    load: "Y",
    impedance: { resistance: 200, reactance: 0 },
    impedances: {
      /* 16 µF em 60 Hz: X = −1/(2π·60·16 µF) */
      A: { resistance: 0, reactance: -1 / (2 * Math.PI * 60 * 16e-6) },
      B: { resistance: 200, reactance: 0 },
      C: { resistance: 200, reactance: 0 },
    },
    neutral: false,
  },
};

/* Gerador desequilibrado do exemplo (V_AN, V_BN, V_CN). */
export const THREE_PHASE_UNBALANCED_SOURCE = {
  A: { value: 127, phase: 0 },
  B: { value: 115, phase: -125 },
  C: { value: 135, phase: 118 },
};

export const THREE_PHASE_UNBALANCED_IMPEDANCES = {
  A: { resistance: 10, reactance: 0 },
  B: { resistance: 6, reactance: 8 },
  C: { resistance: 5, reactance: -5 },
};

export const THREE_PHASE_PRESET_LINE_VOLTAGE = 220;
export const THREE_PHASE_PRESET_IMPEDANCE = { resistance: 8, reactance: 6 };

export function createThreePhasePreset(kind: ThreePhasePresetKind): {
  elements: CircuitElement[];
  connections: CircuitConnection[];
  frequency: number;
} {
  const spec = SPECS[kind];
  const sourceConnection = spec ? spec.source : kind[0] === "Y" ? "Y" : "D";
  const loadConnection = spec ? spec.load : kind[1] === "Y" ? "Y" : "D";
  const unbalanced = kind.endsWith("-u");
  const unbalancedSource = kind.endsWith("-us");
  const withNeutral = spec
    ? spec.neutral
    : kind === "YY" || kind === "YYn-u" || kind === "YYn-us";

  const source = createThreePhaseSource({
    groupId: "G",
    connection: sourceConnection,
    lineVoltage: spec ? spec.lineVoltage : THREE_PHASE_PRESET_LINE_VOLTAGE,
    ...(unbalancedSource ? { phasors: THREE_PHASE_UNBALANCED_SOURCE } : {}),
    label: "Gerador",
    x: 40,
    y: 60,
  });
  const load = createThreePhaseLoad({
    groupId: "C",
    connection: loadConnection,
    impedance: spec ? spec.impedance : THREE_PHASE_PRESET_IMPEDANCE,
    ...(spec?.impedances
      ? { impedances: spec.impedances }
      : unbalanced
        ? { impedances: THREE_PHASE_UNBALANCED_IMPEDANCES }
        : {}),
    label: "Carga",
    x: 520,
    y: 60,
  });

  const from = getGroupTerminals(source.elements);
  const to = getGroupTerminals(load.elements);

  const roles = withNeutral ? (["A", "B", "C", "N"] as const) : (["A", "B", "C"] as const);
  const lines: CircuitConnection[] = roles.flatMap(
    (role) =>
      from[role] && to[role]
        ? [
            {
              id: `linha-${role}`,
              fromTerminalId: from[role] as string,
              toTerminalId: to[role] as string,
            },
          ]
        : []
  );

  return {
    elements: [...source.elements, ...load.elements],
    connections: [...source.connections, ...load.connections, ...lines],
    frequency: 60,
  };
}
