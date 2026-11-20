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
 */

export type ThreePhasePresetKind =
  | "YY"
  | "YD"
  | "DY"
  | "DD"
  | "YYn-u"
  | "YY-u"
  | "YD-u";

export const THREE_PHASE_PRESETS: { kind: ThreePhasePresetKind; title: string }[] = [
  { kind: "YY", title: "Trifásico Y-Y (com neutro)" },
  { kind: "YD", title: "Trifásico Y-Δ" },
  { kind: "DY", title: "Trifásico Δ-Y" },
  { kind: "DD", title: "Trifásico Δ-Δ" },
  { kind: "YYn-u", title: "Desequilibrado Y-Y com neutro" },
  { kind: "YY-u", title: "Desequilibrado Y-Y sem neutro" },
  { kind: "YD-u", title: "Desequilibrado Y-Δ" },
];

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
  const sourceConnection = kind[0] === "Y" ? "Y" : "D";
  const loadConnection = kind[1] === "Y" ? "Y" : "D";
  const unbalanced = kind.endsWith("-u");
  const withNeutral = kind === "YY" || kind === "YYn-u";

  const source = createThreePhaseSource({
    groupId: "G",
    connection: sourceConnection,
    lineVoltage: THREE_PHASE_PRESET_LINE_VOLTAGE,
    label: "Gerador",
    x: 40,
    y: 60,
  });
  const load = createThreePhaseLoad({
    groupId: "C",
    connection: loadConnection,
    impedance: THREE_PHASE_PRESET_IMPEDANCE,
    ...(unbalanced ? { impedances: THREE_PHASE_UNBALANCED_IMPEDANCES } : {}),
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
