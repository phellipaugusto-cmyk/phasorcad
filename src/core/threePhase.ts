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
 * Convenções (sequência ABC, referência V_AN = 0°):
 *   Y: V_AN ∠0°, V_BN ∠−120°, V_CN ∠+120°
 *   Δ: V_AB ∠+30°, V_BC ∠−90°, V_CA ∠+150°   (V_L = √3·V_F)
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
  ABC: { A: 30, B: -90, C: 150 },
  ACB: { A: -30, B: 90, C: -150 },
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

export interface ThreePhaseSourceOptions {
  groupId: string;
  connection: "Y" | "D";
  /* Tensão de LINHA (V eficaz). */
  lineVoltage: number;
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

  const elements = ROLES.map((role, index): CircuitElement => {
    const group: ThreePhaseGroup = {
      id: groupId,
      kind: "source",
      connection,
      role,
      sequence,
    };
    const id = `${groupId}${getMemberName(group)}`;

    return {
      id,
      type: "source",
      label: `${label} ${getMemberName(group)}`,
      value,
      phase: getSourceRoleAngle(group),
      x,
      y: y + index * GROUP_ROW_SPACING,
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
  x: number;
  y: number;
  label?: string;
}

export function createThreePhaseLoad(
  options: ThreePhaseLoadOptions
): { elements: CircuitElement[]; connections: CircuitConnection[] } {
  const { groupId, connection, impedance, x, y } = options;
  const label = options.label ?? groupId;

  const elements = ROLES.map((role, index): CircuitElement => {
    const group: ThreePhaseGroup = { id: groupId, kind: "load", connection, role };
    const id = `${groupId}${getMemberName(group)}`;

    return {
      id,
      type: "impedance",
      label: `${label} ${getMemberName(group)}`,
      value: getImpedanceMagnitude(impedance),
      impedance: { ...impedance },
      x,
      y: y + index * GROUP_ROW_SPACING,
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

  const rebuilt =
    first.group.kind === "source"
      ? createThreePhaseSource({
          groupId,
          connection,
          lineVoltage: getSourceLineVoltage(members),
          sequence: changes.sequence ?? first.group.sequence ?? "ABC",
          label: labelBase,
          ...position,
        })
      : createThreePhaseLoad({
          groupId,
          connection,
          impedance: getImpedanceParameters(first),
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
