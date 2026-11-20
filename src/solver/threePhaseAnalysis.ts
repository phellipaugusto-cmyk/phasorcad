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
  neutralCurrentPhasor: Phasor | null;
  /* Carga equilibrada (mesma Z nas três fases)? Geradores: true. */
  balanced: boolean;
  /* Potência complexa de cada fase (membro). */
  phasePowers: Record<ThreePhaseRole, Phasor>;
  /*
   * Carga Y: tensão do neutro da carga em relação ao neutro do
   * (primeiro) gerador em Y — o "deslocamento do neutro". Sem fio
   * de neutro e com carga desequilibrada, deixa de ser zero.
   */
  neutralShift: Phasor | null;
  /*
   * Componentes simétricas das correntes de linha (Fortescue,
   * referência na fase A): zero, positiva e negativa, e o fator de
   * desequilíbrio |I₂|/|I₁| (em %).
   */
  sequenceCurrents: { zero: Phasor; positive: Phasor; negative: Phasor };
  unbalanceFactor: number;
  /*
   * Componentes simétricas das tensões de fase (Y: V_AN…; Δ: V_AB…)
   * e o desequilíbrio de tensão |V₂|/|V₁| (em %).
   */
  sequenceVoltages: { zero: Phasor; positive: Phasor; negative: Phasor };
  voltageUnbalance: number;
  /*
   * Só cargas: Z de cada fase (na frequência atual) e o equivalente
   * na outra ligação (Kennelly; equilibrada: Z_Y = Z_Δ/3).
   *   Y: A = Z_A…   Δ: A = Z_AB, B = Z_BC, C = Z_CA
   */
  impedances: Record<ThreePhaseRole, ImpedanceParameters> | null;
  equivalentImpedances: Record<ThreePhaseRole, ImpedanceParameters> | null;
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

const toPhasor = (z: ImpedanceParameters): Phasor => ({
  real: z.resistance,
  imaginary: z.reactance,
});
const toImpedance = (p: Phasor): ImpedanceParameters => ({
  resistance: p.real,
  reactance: p.imaginary,
});

/*
 * Kennelly (Δ → Y): Z_A = Z_AB·Z_CA/ΣZ, Z_B = Z_AB·Z_BC/ΣZ,
 * Z_C = Z_BC·Z_CA/ΣZ. Equilibrada: Z_Y = Z_Δ/3.
 */
export function deltaToStar(
  delta: Record<ThreePhaseRole, ImpedanceParameters>
): Record<ThreePhaseRole, ImpedanceParameters> {
  const ab = toPhasor(delta.A);
  const bc = toPhasor(delta.B);
  const ca = toPhasor(delta.C);
  const sum = add(add(ab, bc), ca);

  return {
    A: toImpedance(div(mul(ab, ca), sum)),
    B: toImpedance(div(mul(ab, bc), sum)),
    C: toImpedance(div(mul(bc, ca), sum)),
  };
}

/*
 * Kennelly (Y → Δ): P = Z_A·Z_B + Z_B·Z_C + Z_C·Z_A;
 * Z_AB = P/Z_C, Z_BC = P/Z_A, Z_CA = P/Z_B. Equilibrada: 3·Z_Y.
 */
export function starToDelta(
  star: Record<ThreePhaseRole, ImpedanceParameters>
): Record<ThreePhaseRole, ImpedanceParameters> {
  const a = toPhasor(star.A);
  const b = toPhasor(star.B);
  const c = toPhasor(star.C);
  const p = add(add(mul(a, b), mul(b, c)), mul(c, a));

  return {
    A: toImpedance(div(p, c)),
    B: toImpedance(div(p, a)),
    C: toImpedance(div(p, b)),
  };
}

/* a = 1 ∠120° */
const A_OP: Phasor = { real: -0.5, imaginary: Math.sqrt(3) / 2 };
const A2_OP: Phasor = { real: -0.5, imaginary: -Math.sqrt(3) / 2 };
const scale = (p: Phasor, k: number): Phasor => ({ real: p.real * k, imaginary: p.imaginary * k });

export function symmetricalComponents(a: Phasor, b: Phasor, c: Phasor) {
  return {
    zero: scale(add(add(a, b), c), 1 / 3),
    positive: scale(add(add(a, mul(A_OP, b)), mul(A2_OP, c)), 1 / 3),
    negative: scale(add(add(a, mul(A2_OP, b)), mul(A_OP, c)), 1 / 3),
  };
}

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

  /* Neutro do primeiro gerador em Y (referência do deslocamento). */
  const sourceNeutral = (() => {
    for (const groupId of getGroupIds(elements)) {
      const members = getGroupMembers(elements, groupId);
      const first = members[0];

      if (first?.group?.kind !== "source" || first.group.connection !== "Y") {
        continue;
      }

      const result = resultById.get(first.id);
      return result ? nodeVoltage.get(result.fromNodeId) ?? ZERO : null;
    }
    return null;
  })();

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
    const phasePowers = {} as Record<ThreePhaseRole, Phasor>;
    let total: Phasor = ZERO;

    members.forEach((member) => {
      const role = member.group!.role;
      const result = resultById.get(member.id)!;
      let current: Phasor;

      if (member.type === "impedance") {
        const y = getImpedanceAdmittance(member, frequency) ?? ZERO;
        current = mul(phaseVoltages[role], y);
        phasePowers[role] = mul(phaseVoltages[role], conj(current));
        total = add(total, phasePowers[role]);
      } else {
        /* Fonte: S entregue = −S do extrator (negativo = entrega). */
        const delivered: Phasor = {
          real: -result.complexPower.real,
          imaginary: -result.complexPower.imaginary,
        };
        current = conj(div(delivered, phaseVoltages[role]));
        phasePowers[role] = delivered;
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
    const neutralPhasor =
      group.connection === "Y"
        ? ROLES.reduce((sum, r) => add(sum, phaseCurrents[r]), ZERO)
        : null;
    const sequenceCurrents = symmetricalComponents(
      lineCurrents.A,
      lineCurrents.B,
      lineCurrents.C
    );
    const positive = magnitude(sequenceCurrents.positive);
    const sequenceVoltages = symmetricalComponents(
      phaseVoltages.A,
      phaseVoltages.B,
      phaseVoltages.C
    );
    const positiveV = magnitude(sequenceVoltages.positive);
    const impedances = isLoad
      ? (Object.fromEntries(
          members.map((m) => [m.group!.role, getImpedanceAt(m, frequency)])
        ) as Record<ThreePhaseRole, ImpedanceParameters>)
      : null;

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
        neutralCurrent: neutralPhasor ? magnitude(neutralPhasor) : null,
        neutralCurrentPhasor: neutralPhasor,
        /*
         * Carga: pela configuração. Gerador: pelas correntes que ele
         * fornece (I₂ e I₀ desprezíveis diante de I₁).
         */
        balanced: isLoad
          ? group.balanced !== false
          : group.balanced !== false &&
            (positive < 1e-12 ||
              (magnitude(sequenceCurrents.negative) < 1e-3 * positive &&
                magnitude(sequenceCurrents.zero) < 1e-3 * positive)),
        phasePowers,
        neutralShift:
          isLoad && group.connection === "Y" && sourceNeutral
            ? sub(v("N"), sourceNeutral)
            : null,
        sequenceCurrents,
        sequenceVoltages,
        voltageUnbalance:
          positiveV > 1e-12
            ? (magnitude(sequenceVoltages.negative) / positiveV) * 100
            : 0,
        unbalanceFactor:
          positive > 1e-12
            ? (magnitude(sequenceCurrents.negative) / positive) * 100
            : 0,
        impedances,
        equivalentImpedances: impedances
          ? group.connection === "Y"
            ? starToDelta(impedances)
            : deltaToStar(impedances)
          : null,
      },
    ];
  });
}
