import type {
  CircuitElement,
  ThreePhaseGroup,
  ThreePhaseRole,
} from "../../core/CircuitElement";
import {
  getTerminalRole,
  type ThreePhaseTerminalRole,
} from "../../core/threePhase";

/*
 * Desenho dos blocos trifásicos como na apostila (Boylestad):
 *
 *   Y: estrela com o neutro no centro, fase A para cima, B embaixo
 *      à direita e C embaixo à esquerda.
 *   Δ: triângulo com A em cima, B embaixo à direita e C embaixo à
 *      esquerda; lados AB (direito), BC (base) e CA (esquerdo).
 *
 * Gerador: bobinas (E); carga: caixas Z1, Z2, Z3. Os três membros do
 * bloco ficam na mesma posição (x, y) = canto superior esquerdo do
 * desenho, e os terminais ficam nas pontas.
 */

export const GROUP_WIDTH = 200;
export const GROUP_HEIGHT = 200;

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface TipPoint extends LayoutPoint {
  /* Lado para onde o fio sai (o roteador só faz saídas horizontais). */
  exit: "left" | "right";
  /*
   * Nó desenhado (ponta da estrela/triângulo). Em B e C o terminal
   * fica um pouco abaixo, ligado ao nó por um trecho vertical, para
   * as linhas B e C correrem em alturas diferentes (como na apostila).
   */
  node: LayoutPoint;
}

const STAR: Record<ThreePhaseTerminalRole, LayoutPoint> = {
  N: { x: 100, y: 100 },
  A: { x: 100, y: 0 },
  B: { x: 200, y: 160 },
  C: { x: 0, y: 160 },
};

const TRIANGLE: Record<ThreePhaseRole, LayoutPoint> = {
  A: { x: 100, y: 0 },
  B: { x: 200, y: 160 },
  C: { x: 0, y: 160 },
};

/* Altura dos terminais das linhas B e C (abaixo dos nós). */
const LINE_B_Y = 190;
const LINE_C_Y = 210;

const NEXT: Record<ThreePhaseRole, ThreePhaseRole> = { A: "B", B: "C", C: "A" };

/* Pontas do bloco (A, B, C e, em Y, N), relativas ao canto do desenho. */
export function getGroupTips(
  group: Pick<ThreePhaseGroup, "kind" | "connection">
): Partial<Record<ThreePhaseTerminalRole, TipPoint>> {
  const isSource = group.kind === "source";
  /* Gerador: fios saem para a direita (carga); carga: para a esquerda. */
  const toward = isSource ? "right" : "left";
  const base = group.connection === "Y" ? STAR : TRIANGLE;

  const tips: Partial<Record<ThreePhaseTerminalRole, TipPoint>> = {
    A: { ...base.A, exit: toward, node: base.A },
    B: { x: base.B.x, y: LINE_B_Y, exit: toward, node: base.B },
    C: { x: base.C.x, y: LINE_C_Y, exit: "left", node: base.C },
  };

  if (group.connection === "Y") {
    tips.N = { ...STAR.N, exit: toward, node: STAR.N };
  }

  return tips;
}

/*
 * Segmento onde fica o símbolo de cada membro: em Y, do neutro até
 * a ponta da fase; em Δ, o lado entre as duas linhas.
 */
export function getMemberSegment(
  group: Pick<ThreePhaseGroup, "connection" | "role">
): { from: LayoutPoint; to: LayoutPoint } {
  if (group.connection === "Y") {
    return { from: STAR.N, to: STAR[group.role] };
  }

  return { from: TRIANGLE[group.role], to: TRIANGLE[NEXT[group.role]] };
}

/* Posição absoluta de um terminal de membro (na ponta do desenho). */
export function getGroupTerminalPoint(
  element: CircuitElement,
  side: "left" | "right"
): TipPoint | null {
  const group = element.group;

  if (!group) {
    return null;
  }

  const role = getTerminalRole(group, side);
  const tip = getGroupTips(group)[role];

  return tip
    ? {
        x: element.x + tip.x,
        y: element.y + tip.y,
        exit: tip.exit,
        node: { x: element.x + tip.node.x, y: element.y + tip.node.y },
      }
    : null;
}

/* Tamanho ocupado pelo componente no desenho. */
export function getElementSize(element: CircuitElement): { width: number; height: number } {
  return element.group
    ? { width: GROUP_WIDTH, height: GROUP_HEIGHT }
    : { width: 80, height: 80 };
}

/*
 * Nomes como na apostila. Gerador: nós A, B, C, N; bobinas E_AN…
 * (Y) ou E_AB… (Δ). Carga: nós a, b, c, n; impedâncias Z1, Z2, Z3
 * (Y: Z1 na fase a…; Δ: Z1 entre a e b, Z2 entre b e c, Z3 entre c e a).
 */
export function getNodeLabel(
  group: Pick<ThreePhaseGroup, "kind">,
  role: ThreePhaseTerminalRole
): string {
  return group.kind === "source" ? role : role.toLowerCase();
}

const PAIR: Record<ThreePhaseRole, string> = { A: "AB", B: "BC", C: "CA" };
const INDEX: Record<ThreePhaseRole, string> = { A: "1", B: "2", C: "3" };

export function getMemberSymbolLabel(
  group: Pick<ThreePhaseGroup, "kind" | "connection" | "role">
): string {
  if (group.kind === "load") {
    return `Z${INDEX[group.role]}`;
  }

  return group.connection === "Y" ? `E${group.role}N` : `E${PAIR[group.role]}`;
}
