import type {
  CircuitElement,
  ThreePhaseGroup,
  ThreePhaseRole,
} from "./CircuitElement";
import type { CircuitConnection } from "./CircuitConnection";
import { createCircuitTerminals } from "./CircuitTerminal";
import {
  getImpedanceMagnitude,
  getImpedanceParameters,
  type ImpedanceParameters,
} from "./impedanceModel";

/*
 * Blocos trifásicos EQUILIBRADOS montados com componentes de dois
 * terminais (fontes e impedâncias), já ligados entre si em Y ou Δ.
 *
 * Convenções da apostila (sequência ABC):
 *   Gerador Y: E_AN ∠0° (referência), E_BN ∠−120°, E_CN ∠+120°
 *              (logo E_AB = √3·E_AN ∠30°)
 *   Gerador Δ: E_AB ∠0° (referência), E_BC ∠−120°, E_CA ∠+120°
 * Sequência ACB troca B e C.
 *
 * Gerador: `value` dos membros = tensão de FASE (Y) ou de LINHA (Δ).
 * Carga: os três membros têm a mesma Z = R + jX por fase.
 */

export const ROLES: ThreePhaseRole[] = ["A", "B", "C"];

export type ThreePhaseTerminalRole = ThreePhaseRole | "N";

/* Resistência interna dos geradores em Δ (desprezível, evita malha ideal). */
export const DELTA_SOURCE_INTERNAL_RESISTANCE = 1e-6;

/* Espaço vertical entre os três membros de um bloco. */
export const GROUP_ROW_SPACING = 120;

const Y_ANGLES: Record<"ABC" | "ACB", Record<ThreePhaseRole, number>> = {
  ABC: { A: 0, B: -120, C: 120 },
  ACB: { A: 0, B: 120, C: -120 },
};

const D_ANGLES: Record<"ABC" | "ACB", Record<ThreePhaseRole, number>> = {
  ABC: { A: 0, B: -120, C: 120 },
  ACB: { A: 0, B: 120, C: -120 },
};

export function getSourceRoleAngle(group: ThreePhaseGroup): number {
  const sequence = group.sequence ?? "ABC";

  return (group.connection === "Y" ? Y_ANGLES : D_ANGLES)[sequence][
    group.role
  ];
}

/* Nome do membro: "Fase A", "V_AB", "Z_A", "Z_AB". */
export function getMemberName(group: ThreePhaseGroup): string {
  const pair: Record<ThreePhaseRole, string> = { A: "AB", B: "BC", C: "CA" };
  const suffix = group.connection === "Y" ? group.role : pair[group.role];

  return group.kind === "source"
    ? group.connection === "Y"
      ? `V${suffix}N`
      : `V${suffix}`
    : `Z${suffix}`;
}

/* Nome exibido (apostila): EAN / EAB no gerador, Z1 / Z2 / Z3 na carga. */
export function getMemberDisplayName(group: ThreePhaseGroup): string {
  const pair: Record<ThreePhaseRole, string> = { A: "AB", B: "BC", C: "CA" };
  const index: Record<ThreePhaseRole, string> = { A: "1", B: "2", C: "3" };

  if (group.kind === "load") {
    return `Z${index[group.role]}`;
  }

  return group.connection === "Y" ? `E${group.role}N` : `E${pair[group.role]}`;
}

/*
 * Que nó do bloco (linha A/B/C ou neutro N) cada terminal de um
 * membro representa.
 */
export function getTerminalRole(
  group: ThreePhaseGroup,
  side: "left" | "right"
): ThreePhaseTerminalRole {
  const next: Record<ThreePhaseRole, ThreePhaseRole> = { A: "B", B: "C", C: "A" };

  if (group.connection === "Y") {
    const lineSide = group.kind === "source" ? "right" : "left";
    return side === lineSide ? group.role : "N";
  }

  /* Δ: gerador AB tem dir. = A, esq. = B; carga AB tem esq. = A, dir. = B. */
  const firstSide = group.kind === "source" ? "right" : "left";
  return side === firstSide ? group.role : next[group.role];
}

/* Terminal "de ligação" de cada nó do bloco (para fios externos). */
export function getGroupTerminals(
  members: CircuitElement[]
): Partial<Record<ThreePhaseTerminalRole, string>> {
  const result: Partial<Record<ThreePhaseTerminalRole, string>> = {};

  ROLES.forEach((role) => {
    const member = members.find((m) => m.group?.role === role);

    if (!member?.group) {
      return;
    }

    (["left", "right"] as const).forEach((side) => {
      const terminalRole = getTerminalRole(member.group as ThreePhaseGroup, side);
      const terminal = member.terminals.find((t) => t.side === side);

      /* Linha: o terminal do membro "dono" daquela linha. */
      if (terminalRole === role && terminal) {
        result[role] = terminal.id;
      }

      if (terminalRole === "N" && terminal && !result.N) {
        result.N = terminal.id;
      }
    });
  });

  return result;
}

/* Fios internos do bloco (estrela ou triângulo). */
export function createGroupWires(members: CircuitElement[]): CircuitConnection[] {
  const byRole = new Map<string, string[]>();

  members.forEach((member) => {
    if (!member.group) {
      return;
    }

    member.terminals.forEach((terminal) => {
      const role = getTerminalRole(member.group as ThreePhaseGroup, terminal.side);
      const list = byRole.get(role) ?? [];
      list.push(terminal.id);
      byRole.set(role, list);
    });
  });

  const wires: CircuitConnection[] = [];
  const groupId = members[0]?.group?.id ?? "grupo";

  byRole.forEach((terminalIds, role) => {
    for (let i = 1; i < terminalIds.length; i++) {
      wires.push({
        id: `${groupId}-${role}-${i}`,
        fromTerminalId: terminalIds[0],
        toTerminalId: terminalIds[i],
      });
    }
  });

  return wires;
}

/* Tensão de um membro: módulo (V eficaz) e ângulo (°). */
export interface SourcePhasor {
  value: number;
  phase: number;
}

const toRect = (p: SourcePhasor) => ({
  re: p.value * Math.cos((p.phase * Math.PI) / 180),
  im: p.value * Math.sin((p.phase * Math.PI) / 180),
});
const toPolar = (z: { re: number; im: number }): SourcePhasor => {
  const value = Math.hypot(z.re, z.im);
  const phase = value > 1e-12 ? (Math.atan2(z.im, z.re) * 180) / Math.PI : 0;
  return { value: Number(value.toPrecision(10)), phase: Number(phase.toFixed(6)) };
};
const subRect = (a: { re: number; im: number }, b: { re: number; im: number }) => ({
  re: a.re - b.re,
  im: a.im - b.im,
});

/*
 * Tensões de linha (V_AB, V_BC, V_CA) dos membros de um gerador,
 * e o caminho de volta para Y sem componente de sequência zero:
 *   V_AN = (V_AB − V_CA)/3, V_BN = (V_BC − V_AB)/3, V_CN = (V_CA − V_BC)/3
 */
export function getSourceLinePhasors(
  members: CircuitElement[]
): Record<ThreePhaseRole, SourcePhasor> | null {
  const byRole = (role: ThreePhaseRole) => members.find((m) => m.group?.role === role);
  const a = byRole("A");
  const b = byRole("B");
  const c = byRole("C");

  if (!a?.group || !b || !c) {
    return null;
  }

  const p = (m: CircuitElement) => toRect({ value: m.value, phase: m.phase ?? 0 });

  if (a.group.connection === "D") {
    return { A: toPolar(p(a)), B: toPolar(p(b)), C: toPolar(p(c)) };
  }

  return {
    A: toPolar(subRect(p(a), p(b))),
    B: toPolar(subRect(p(b), p(c))),
    C: toPolar(subRect(p(c), p(a))),
  };
}

export function linePhasorsToStar(
  line: Record<ThreePhaseRole, SourcePhasor>
): Record<ThreePhaseRole, SourcePhasor> {
  const ab = toRect(line.A);
  const bc = toRect(line.B);
  const ca = toRect(line.C);
  const third = (z: { re: number; im: number }) => ({ re: z.re / 3, im: z.im / 3 });

  return {
    A: toPolar(third(subRect(ab, ca))),
    B: toPolar(third(subRect(bc, ab))),
    C: toPolar(third(subRect(ca, bc))),
  };
}

/* Δ: V_CA = −(V_AB + V_BC), para a malha das fontes fechar em zero. */
export function closeDeltaLoop(ab: SourcePhasor, bc: SourcePhasor): SourcePhasor {
  const x = toRect(ab);
  const y = toRect(bc);
  return toPolar({ re: -(x.re + y.re), im: -(x.im + y.im) });
}

export interface ThreePhaseSourceOptions {
  groupId: string;
  connection: "Y" | "D";
  /* Tensão de LINHA (V eficaz). */
  lineVoltage: number;
  /* Desequilibrado: tensão de cada membro (Y: V_AN…; Δ: V_AB…). */
  phasors?: Record<ThreePhaseRole, SourcePhasor>;
  sequence?: "ABC" | "ACB";
  x: number;
  y: number;
  label?: string;
}

export function createThreePhaseSource(
  options: ThreePhaseSourceOptions
): { elements: CircuitElement[]; connections: CircuitConnection[] } {
  const { groupId, connection, lineVoltage, x, y } = options;
  const sequence = options.sequence ?? "ABC";
  const label = options.label ?? groupId;
  const value = connection === "Y" ? lineVoltage / Math.sqrt(3) : lineVoltage;
  const phasors = options.phasors;

  const elements = ROLES.map((role): CircuitElement => {
    const group: ThreePhaseGroup = {
      id: groupId,
      kind: "source",
      connection,
      role,
      sequence,
      ...(phasors ? { balanced: false } : {}),
    };
    const id = `${groupId}${getMemberName(group)}`;

    return {
      id,
      type: "source",
      label: `${label} ${getMemberDisplayName(group)}`,
      value: phasors ? phasors[role].value : value,
      phase: phasors ? phasors[role].phase : getSourceRoleAngle(group),
      x,
      y,
      terminals: createCircuitTerminals(id),
      group,
      ...(connection === "D"
        ? { internalResistance: DELTA_SOURCE_INTERNAL_RESISTANCE }
        : {}),
    };
  });

  return { elements, connections: createGroupWires(elements) };
}

export interface ThreePhaseLoadOptions {
  groupId: string;
  connection: "Y" | "D";
  impedance: ImpedanceParameters;
  /* Desequilibrada: Z de cada fase (A = Z_A ou Z_AB…). */
  impedances?: Partial<Record<ThreePhaseRole, ImpedanceParameters>>;
  x: number;
  y: number;
  label?: string;
}

export function createThreePhaseLoad(
  options: ThreePhaseLoadOptions
): { elements: CircuitElement[]; connections: CircuitConnection[] } {
  const { groupId, connection, impedance, x, y } = options;
  const label = options.label ?? groupId;
  const balanced = options.impedances === undefined;

  const elements = ROLES.map((role): CircuitElement => {
    const group: ThreePhaseGroup = {
      id: groupId,
      kind: "load",
      connection,
      role,
      ...(balanced ? {} : { balanced: false }),
    };
    const id = `${groupId}${getMemberName(group)}`;
    const z = options.impedances?.[role] ?? impedance;

    return {
      id,
      type: "impedance",
      label: `${label} ${getMemberDisplayName(group)}`,
      value: getImpedanceMagnitude(z),
      impedance: { ...z },
      x,
      y,
      terminals: createCircuitTerminals(id),
      group,
    };
  });

  return { elements, connections: createGroupWires(elements) };
}

export function getGroupMembers(
  elements: CircuitElement[],
  groupId: string
): CircuitElement[] {
  return ROLES.map((role) =>
    elements.find((e) => e.group?.id === groupId && e.group.role === role)
  ).filter((e): e is CircuitElement => e !== undefined);
}

export function getGroupIds(elements: CircuitElement[]): string[] {
  return Array.from(
    new Set(
      elements
        .map((e) => e.group?.id)
        .filter((id): id is string => id !== undefined)
    )
  );
}

/* Tensão de linha de um gerador, a partir dos membros. */
export function getSourceLineVoltage(members: CircuitElement[]): number {
  const first = members[0];

  if (!first?.group) {
    return 0;
  }

  return first.group.connection === "Y" ? first.value * Math.sqrt(3) : first.value;
}

/*
 * Troca a ligação (Y ↔ Δ) ou a sequência de um bloco, mantendo a
 * tensão de linha (gerador) ou a Z por fase (carga), a posição e os
 * fios externos ligados às linhas. Fios externos ao neutro somem
 * quando o bloco vira Δ.
 */
export function rebuildGroup(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  groupId: string,
  changes: { connection?: "Y" | "D"; sequence?: "ABC" | "ACB" }
): { elements: CircuitElement[]; connections: CircuitConnection[] } {
  const members = getGroupMembers(elements, groupId);
  const first = members[0];

  if (!first?.group) {
    return { elements, connections };
  }

  const connection = changes.connection ?? first.group.connection;
  const labelBase = first.label.replace(/\s+\S+$/, "");
  const position = { x: first.x, y: first.y };

  /*
   * Gerador desequilibrado: mantém as tensões de LINHA (o que a
   * carga enxerga). Y → Δ: V_AB = V_AN − V_BN…; Δ → Y: estrela sem
   * sequência zero.
   */
  const unbalancedSource =
    first.group.kind === "source" && first.group.balanced === false;
  const linePhasors = unbalancedSource ? getSourceLinePhasors(members) : null;
  const sourcePhasors = linePhasors
    ? connection === "D"
      ? linePhasors
      : first.group.connection === "Y"
        ? (Object.fromEntries(
            members.map((m) => [m.group!.role, { value: m.value, phase: m.phase ?? 0 }])
          ) as Record<ThreePhaseRole, SourcePhasor>)
        : linePhasorsToStar(linePhasors)
    : undefined;

  const rebuilt =
    first.group.kind === "source"
      ? createThreePhaseSource({
          groupId,
          connection,
          lineVoltage: getSourceLineVoltage(members),
          ...(sourcePhasors ? { phasors: sourcePhasors } : {}),
          sequence: changes.sequence ?? first.group.sequence ?? "ABC",
          label: labelBase,
          ...position,
        })
      : createThreePhaseLoad({
          groupId,
          connection,
          impedance: getImpedanceParameters(first),
          /* Desequilibrada: cada fase leva a sua Z para a nova ligação. */
          ...(first.group.balanced === false
            ? {
                impedances: Object.fromEntries(
                  members.map((m) => [m.group!.role, getImpedanceParameters(m)])
                ),
              }
            : {}),
          label: labelBase,
          ...position,
        });

  /* Nó (A/B/C/N) de cada terminal antigo do bloco. */
  const oldRoleByTerminal = new Map<string, ThreePhaseTerminalRole>();
  members.forEach((member) =>
    member.terminals.forEach((terminal) =>
      oldRoleByTerminal.set(
        terminal.id,
        getTerminalRole(member.group as ThreePhaseGroup, terminal.side)
      )
    )
  );

  const newTerminals = getGroupTerminals(rebuilt.elements);

  const external = connections.flatMap((wire): CircuitConnection[] => {
    const fromRole = oldRoleByTerminal.get(wire.fromTerminalId);
    const toRole = oldRoleByTerminal.get(wire.toTerminalId);

    if (fromRole && toRole) {
      return []; /* fio interno: recriado */
    }

    if (!fromRole && !toRole) {
      return [wire];
    }

    const role = (fromRole ?? toRole) as ThreePhaseTerminalRole;
    const target = newTerminals[role];

    if (!target) {
      return []; /* neutro de um bloco que virou Δ */
    }

    return [
      fromRole
        ? { ...wire, fromTerminalId: target }
        : { ...wire, toTerminalId: target },
    ];
  });

  const memberIds = new Set(members.map((m) => m.id));
  const insertAt = elements.findIndex((e) => memberIds.has(e.id));
  const others = elements.filter((e) => !memberIds.has(e.id));

  return {
    elements: [
      ...others.slice(0, insertAt),
      ...rebuilt.elements,
      ...others.slice(insertAt),
    ],
    connections: [...external, ...rebuilt.connections],
  };
}

/* Fio interno de um bloco (estrela/triângulo), que o desenho já mostra. */
export function isInternalGroupConnection(
  connection: CircuitConnection,
  groupByElementId: ReadonlyMap<string, string>
): boolean {
  const elementOf = (terminalId: string) => terminalId.slice(0, terminalId.lastIndexOf(":"));
  const from = groupByElementId.get(elementOf(connection.fromTerminalId));
  const to = groupByElementId.get(elementOf(connection.toTerminalId));

  return from !== undefined && from === to;
}

export function getGroupByElementId(elements: CircuitElement[]): Map<string, string> {
  return new Map(
    elements.filter((e) => e.group).map((e) => [e.id, (e.group as ThreePhaseGroup).id])
  );
}

/* Coloca os membros de cada bloco na posição do membro A. */
export function alignGroups(elements: CircuitElement[]): CircuitElement[] {
  const anchor = new Map<string, { x: number; y: number }>();

  elements.forEach((e) => {
    if (e.group && e.group.role === "A") {
      anchor.set(e.group.id, { x: e.x, y: e.y });
    }
  });

  let changed = false;
  const next = elements.map((e) => {
    const position = e.group ? anchor.get(e.group.id) : undefined;
    if (position && (e.x !== position.x || e.y !== position.y)) {
      changed = true;
      return { ...e, ...position };
    }
    return e;
  });

  /* Sem mudança, a mesma lista (o React não re-renderiza). */
  return changed ? next : elements;
}

/*
 * Os três membros de um bloco são desenhados juntos (estrela ou
 * triângulo): se um deles foi movido, os outros acompanham.
 */
export function syncGroupPositions(
  previous: CircuitElement[],
  next: CircuitElement[]
): CircuitElement[] {
  const previousById = new Map(previous.map((e) => [e.id, e]));
  const moved = new Map<string, { x: number; y: number }>();

  next.forEach((element) => {
    const before = previousById.get(element.id);

    if (element.group && before && (before.x !== element.x || before.y !== element.y)) {
      moved.set(element.group.id, { x: element.x, y: element.y });
    }
  });

  if (moved.size === 0) {
    return next;
  }

  return next.map((element) => {
    const position = element.group ? moved.get(element.group.id) : undefined;

    return position && (element.x !== position.x || element.y !== position.y)
      ? { ...element, ...position }
      : element;
  });
}

/*
 * Mantém os blocos equilibrados: se um membro mudou (valor da
 * fonte, Z da carga), os outros dois recebem o mesmo; ângulos das
 * fontes sempre seguem a ligação e a sequência.
 */
export function enforceBalance(
  previous: CircuitElement[],
  next: CircuitElement[]
): CircuitElement[] {
  const groupIds = getGroupIds(next);

  if (groupIds.length === 0) {
    return next;
  }

  const previousById = new Map(previous.map((e) => [e.id, e]));
  const updates = new Map<string, CircuitElement>();

  groupIds.forEach((groupId) => {
    const members = getGroupMembers(next, groupId);

    if (members.length === 0) {
      return;
    }

    /* Carga desequilibrada: cada fase é livre. */
    if (members[0].group?.kind === "load" && members[0].group.balanced === false) {
      return;
    }

    /*
     * Gerador desequilibrado: Y é livre; em Δ, V_CA acompanha
     * V_AB e V_BC (soma das três tem de ser zero).
     */
    if (members[0].group?.kind === "source" && members[0].group.balanced === false) {
      if (members[0].group.connection === "D") {
        const ab = members.find((m) => m.group?.role === "A");
        const bc = members.find((m) => m.group?.role === "B");
        const ca = members.find((m) => m.group?.role === "C");

        if (ab && bc && ca) {
          const closed = closeDeltaLoop(
            { value: ab.value, phase: ab.phase ?? 0 },
            { value: bc.value, phase: bc.phase ?? 0 }
          );

          if (
            Math.abs(ca.value - closed.value) > 1e-9 ||
            Math.abs((ca.phase ?? 0) - closed.phase) > 1e-6
          ) {
            updates.set(ca.id, { ...ca, value: closed.value, phase: closed.phase });
          }
        }
      }
      return;
    }

    const changed =
      members.find((member) => {
        const before = previousById.get(member.id);

        if (!before) {
          return false;
        }

        return member.group?.kind === "source"
          ? before.value !== member.value
          : before.impedance?.resistance !== member.impedance?.resistance ||
              before.impedance?.reactance !== member.impedance?.reactance;
      }) ?? members[0];

    members.forEach((member) => {
      if (!member.group) {
        return;
      }

      let updated = member;

      if (member.group.kind === "source") {
        const phase = getSourceRoleAngle(member.group);

        if (member.value !== changed.value || member.phase !== phase) {
          updated = { ...member, value: changed.value, phase };
        }
      } else {
        const z = getImpedanceParameters(changed);
        const current = getImpedanceParameters(member);

        if (
          current.resistance !== z.resistance ||
          current.reactance !== z.reactance ||
          member.value !== getImpedanceMagnitude(z)
        ) {
          updated = {
            ...member,
            impedance: { ...z },
            value: getImpedanceMagnitude(z),
          };
        }
      }

      if (updated !== member) {
        updates.set(member.id, updated);
      }
    });
  });

  return updates.size === 0 ? next : next.map((e) => updates.get(e.id) ?? e);
}
