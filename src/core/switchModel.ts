import type { CircuitElement } from "./CircuitElement";
import type { CircuitConnection } from "./CircuitConnection";

/*
 * Interruptor (ou contato de força de um contator).
 *
 * Fechado: é um fio. O grafo une os dois terminais em um só nó,
 * então o ramo fica "desviado" (tensão e corrente próprias = 0;
 * a corrente passa pelo nó).
 *
 * Aberto: uma condutância desprezível (1 nS = 1 GΩ), que mantém
 * a matriz MNA bem condicionada quando um trecho do circuito
 * fica pendurado só pelo interruptor.
 */

export const SWITCH_OPEN_CONDUCTANCE = 1e-9;

export function isSwitchClosed(
  element: Pick<CircuitElement, "type" | "closed">
): boolean {
  return element.type === "switch" && element.closed !== false;
}

export function isOpenSwitch(
  element: Pick<CircuitElement, "type" | "closed">
): boolean {
  return element.type === "switch" && element.closed === false;
}

/* Fios "virtuais" que representam os interruptores fechados. */
export function getClosedSwitchConnections(
  elements: CircuitElement[]
): CircuitConnection[] {
  return elements
    .filter(isSwitchClosed)
    .map((element) => {
      const left = element.terminals.find((t) => t.side === "left");
      const right = element.terminals.find((t) => t.side === "right");

      return left && right
        ? {
            id: `switch-closed-${element.id}`,
            fromTerminalId: left.id,
            toTerminalId: right.id,
          }
        : null;
    })
    .filter(
      (connection): connection is CircuitConnection => connection !== null
    );
}

export function getSwitchAdmittance(
  element: Pick<CircuitElement, "type" | "closed">
): { real: number; imaginary: number } | null {
  return isOpenSwitch(element)
    ? { real: SWITCH_OPEN_CONDUCTANCE, imaginary: 0 }
    : null;
}
