export type CircuitTerminalSide =
  | "left"
  | "right";

export interface CircuitTerminal {
  id: string;

  elementId: string;

  side: CircuitTerminalSide;
}

export function createCircuitTerminals(
  elementId: string
): [
  CircuitTerminal,
  CircuitTerminal
] {
  return [
    {
      id: `${elementId}:left`,
      elementId,
      side: "left",
    },

    {
      id: `${elementId}:right`,
      elementId,
      side: "right",
    },
  ];
}