import type { CircuitElement, ThreePhaseRole } from "../core/CircuitElement";
import type { MnaElectricalResults } from "../core/MnaElectricalResults";
import {
  ROLES,
  getGroupIds,
  getGroupMembers,
  getTerminalRole,
  type ThreePhaseTerminalRole,
} from "../core/threePhase";
import {
  getImpedanceAdmittance,
  getImpedanceAt,
  type ImpedanceParameters,
} from "../core/impedanceModel";

/*
 * Grandezas trifásicas de cada bloco (gerador ou carga), calculadas
 * a partir das tensões de nó do MNA:
 *
 *   tensões de fase e de linha, correntes de fase e de linha,
 *   relações V_L/V_F e I_L/I_F (módulo e ângulo), P, Q, S, FP
 *   totais, conferência P = √3·V_L·I_L·FP e, nas cargas, a Z por
 *   fase e o equivalente na outra ligação (Z_Y = Z_Δ / 3).
 */

export interface Phasor {
  real: number;
  imaginary: number;
}

export interface ThreePhaseGroupAnalysis {
  groupId: string;
  name: string;
  kind: "source" | "load";
  connection: "Y" | "D";
  sequence: "ABC" | "ACB";
  /* Tensões de fase (Y: V_AN…; Δ: V_AB…) e de linha (V_AB, V_BC, V_CA). */
  phaseVoltages: Record<ThreePhaseRole, Phasor>;
  lineVoltages: Record<ThreePhaseRole, Phasor>;
  /* Correntes de fase (nos membros) e de linha (gerador → carga). */
  phaseCurrents: Record<ThreePhaseRole, Phasor>;
  lineCurrents: Record<ThreePhaseRole, Phasor>;
  /* Médias (equilibrado: as três são iguais). */
  phaseVoltage: number;
  lineVoltage: number;
  phaseCurrent: number;
  lineCurrent: number;
  /* V_AB / V_AN e I_A / I_AB: módulo e ângulo (°). */
  voltageRatio: { magnitude: number; angle: number } | null;
  currentRatio: { magnitude: number; angle: number } | null;
  /* Totais (gerador: entregue; carga: absorvida). */
  activePower: number;
  reactivePower: number;
  apparentPower: number;
  powerFactor: number;
  /* √3 · V_L · I_L · FP (deve bater com activePower). */
  formulaPower: number;
  /* Carga Y: corrente que vai para o neutro (≈ 0 se equilibrada). */
  neutralCurrent: number | null;
  /* Só cargas: Z por fase (na frequência atual) e o equivalente. */
  impedance: ImpedanceParameters | null;
  equivalentImpedance: ImpedanceParameters | null;
}

const ZERO: Phasor = { real: 0, imaginary: 0 };
const add = (a: Phasor, b: Phasor): Phasor => ({
  real: a.real + b.real,
  imaginary: a.imaginary + b.imaginary,
});
const sub = (a: Phasor, b: Phasor): Phasor => ({
  real: a.real - b.real,
  imaginary: a.imaginary - b.imaginary,
});
const mul = (a: Phasor, b: Phasor): Phasor => ({
  real: a.real * b.real - a.imaginary * b.imaginary,
  imaginary: a.real * b.imaginary + a.imaginary * b.real,
});
const conj = (a: Phasor): Phasor => ({ real: a.real, imaginary: -a.imaginary });
const div = (a: Phasor, b: Phasor): Phasor => {
  const d = b.real ** 2 + b.imaginary ** 2;
  return d > 0
    ? {
        real: (a.real * b.real + a.imaginary * b.imaginary) / d,
        imaginary: (a.imaginary * b.real - a.real * b.imaginary) / d,
      }
    : ZERO;
};
export const magnitude = (a: Phasor) => Math.hypot(a.real, a.imaginary);
export const angleDegrees = (a: Phasor) =>
  (Math.atan2(a.imaginary, a.real) * 180) / Math.PI;

const NEXT: Record<ThreePhaseRole, ThreePhaseRole> = { A: "B", B: "C", C: "A" };
const PREVIOUS: Record<ThreePhaseRole, ThreePhaseRole> = { A: "C", B: "A", C: "B" };

function ratio(a: Phasor, b: Phasor) {
  if (magnitude(b) < 1e-12 || magnitude(a) < 1e-12) {
    return null;
  }

  const r = div(a, b);
  let angle = angleDegrees(r);
  if (Math.abs(angle) < 1e-9) angle = 0;

  return { magnitude: magnitude(r), angle };
}

const average = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

export function analyzeThreePhase(
  elements: CircuitElement[],
  results: MnaElectricalResults,
  frequency: number
): ThreePhaseGroupAnalysis[] {
  if (!results.available) {
    return [];
  }

  const nodeVoltage = new Map(
    results.nodeVoltages.map((n) => [n.nodeId, n.voltage as Phasor])
  );
  const resultById = new Map(results.elementResults.map((r) => [r.elementId, r]));

  return getGroupIds(elements).flatMap((groupId): ThreePhaseGroupAnalysis[] => {
    const members = getGroupMembers(elements, groupId);

    if (members.length !== 3 || members.some((m) => !resultById.get(m.id))) {
      return [];
    }

    const group = members[0].group!;

    /* Tensão de cada nó do bloco (A, B, C, N). */
    const nodeOf: Partial<Record<ThreePhaseTerminalRole, Phasor>> = {};
    members.forEach((member) => {
      const result = resultById.get(member.id)!;
      const left = nodeVoltage.get(result.fromNodeId) ?? ZERO;
      const right = nodeVoltage.get(result.toNodeId) ?? ZERO;
      nodeOf[getTerminalRole(member.group!, "left")] = left;
      nodeOf[getTerminalRole(member.group!, "right")] = right;
    });

    const v = (role: ThreePhaseTerminalRole) => nodeOf[role] ?? ZERO;

    const lineVoltages = {} as Record<ThreePhaseRole, Phasor>;
    ROLES.forEach((role) => {
      lineVoltages[role] = sub(v(role), v(NEXT[role]));
    });

    const phaseVoltages = {} as Record<ThreePhaseRole, Phasor>;
    ROLES.forEach((role) => {
      phaseVoltages[role] =
        group.connection === "Y" ? sub(v(role), v("N")) : lineVoltages[role];
    });

    /*
     * Corrente de cada membro no sentido "de fase":
     *  carga: entrando pela linha (Y) / de A para B no ramo AB (Δ);
     *  gerador: saindo pela linha (Y) / saindo por A no ramo AB (Δ).
     */
    const phaseCurrents = {} as Record<ThreePhaseRole, Phasor>;
    let total: Phasor = ZERO;

    members.forEach((member) => {
      const role = member.group!.role;
      const result = resultById.get(member.id)!;
      let current: Phasor;

      if (member.type === "impedance") {
        const y = getImpedanceAdmittance(member, frequency) ?? ZERO;
        current = mul(phaseVoltages[role], y);
        total = add(total, mul(phaseVoltages[role], conj(current)));
      } else {
        /* Fonte: S entregue = −S do extrator (negativo = entrega). */
        const delivered: Phasor = {
          real: -result.complexPower.real,
          imaginary: -result.complexPower.imaginary,
        };
        current = conj(div(delivered, phaseVoltages[role]));
        total = add(total, delivered);
      }

      phaseCurrents[role] = current;
    });

    const lineCurrents = {} as Record<ThreePhaseRole, Phasor>;
    ROLES.forEach((role) => {
      lineCurrents[role] =
        group.connection === "Y"
          ? phaseCurrents[role]
          : sub(phaseCurrents[role], phaseCurrents[PREVIOUS[role]]);
    });

    const phaseVoltage = average(ROLES.map((r) => magnitude(phaseVoltages[r])));
    const lineVoltage = average(ROLES.map((r) => magnitude(lineVoltages[r])));
    const phaseCurrent = average(ROLES.map((r) => magnitude(phaseCurrents[r])));
    const lineCurrent = average(ROLES.map((r) => magnitude(lineCurrents[r])));

    const activePower = total.real;
    const reactivePower = total.imaginary;
    const apparentPower = magnitude(total);
    const powerFactor = apparentPower > 0 ? activePower / apparentPower : 1;

    const isLoad = group.kind === "load";
    const z = isLoad ? getImpedanceAt(members[0], frequency) : null;

    return [
      {
        groupId,
        name: members[0].label.replace(/\s+\S+$/, ""),
        kind: group.kind,
        connection: group.connection,
        sequence: group.sequence ?? "ABC",
        phaseVoltages,
        lineVoltages,
        phaseCurrents,
        lineCurrents,
        phaseVoltage,
        lineVoltage,
        phaseCurrent,
        lineCurrent,
        voltageRatio: ratio(lineVoltages.A, phaseVoltages.A),
        currentRatio: ratio(lineCurrents.A, phaseCurrents.A),
        activePower,
        reactivePower,
        apparentPower,
        powerFactor,
        formulaPower: Math.sqrt(3) * lineVoltage * lineCurrent * powerFactor,
        neutralCurrent:
          group.connection === "Y"
            ? magnitude(
                ROLES.reduce((sum, r) => add(sum, phaseCurrents[r]), ZERO)
              )
            : null,
        impedance: z,
        equivalentImpedance: z
          ? group.connection === "Y"
            ? { resistance: z.resistance * 3, reactance: z.reactance * 3 }
            : { resistance: z.resistance / 3, reactance: z.reactance / 3 }
          : null,
      },
    ];
  });
}
