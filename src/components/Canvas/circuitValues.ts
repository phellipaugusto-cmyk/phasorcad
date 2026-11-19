import type { CircuitElement } from "../../core/CircuitElement";
import type {
  CircuitTerminal,
  CircuitTerminalSide,
} from "../../core/CircuitTerminal";

/* Texto do valor de um componente, com o estado do interruptor. */
export function formatElementValue(element: CircuitElement): string {
  if (element.type === "switch") {
    return element.closed === false ? "aberto" : "fechado";
  }

  return formatValue(element.type, element.value, element.phase ?? 0);
}

export function formatValue(
  type: CircuitElement["type"],
  value: number,
  phase = 0
): string {
  /* Fontes com fase diferente de 0° mostram "módulo ∠fase". */
  const angle =
    phase !== 0
      ? ` ∠${Number(phase.toFixed(2))}°`
      : "";

  switch (type) {
    case "resistor":
      return `${value} Ω`;
    case "capacitor":
      return `${value * 1_000_000} µF`;
    case "inductor":
      return `${value * 1000} mH`;
    case "motor":
      return `${Number(value.toPrecision(4))} kW`;
    case "lamp":
      return `${Number(value.toPrecision(4))} W`;
    case "switch":
      return "";
    case "source":
      return `${value} V${angle}`;
    case "currentSource":
      return `${value} A${angle}`;
    default:
      return `${value}`;
  }
}

export function getEditValue(element: CircuitElement): number {
  switch (element.type) {
    case "capacitor":
      return element.value * 1_000_000;
    case "inductor":
      return element.value * 1000;
    default:
      return element.value;
  }
}

export function convertEditValue(
  element: CircuitElement,
  value: number
): number {
  switch (element.type) {
    case "capacitor":
      return Math.max(value, 0.000001) / 1_000_000;
    case "inductor":
      return Math.max(value, 0.000001) / 1000;
    case "resistor":
      return Math.max(value, 0.000001);
    case "motor":
      return Math.max(value, 0.001);
    case "lamp":
      return Math.max(value, 0.1);
    case "switch":
      return 0;
    case "source":
    case "currentSource":
      return Math.max(value, 0);
    default:
      return value;
  }
}

export function getSymbol(type: CircuitElement["type"]): string {
  switch (type) {
    case "resistor":
      return "/\\/\\/\\";
    case "capacitor":
      return "| |";
    case "inductor":
      return "∿∿∿";
    case "motor":
      return "(M)";
    case "lamp":
      return "(X)";
    case "switch":
      return "_/ _";
    case "source":
      return "(~)";
    case "currentSource":
      return "(→)";
    default:
      return "?";
  }
}

export function getTerminal(
  element: CircuitElement,
  side: CircuitTerminalSide
): CircuitTerminal | undefined {
  return element.terminals.find((terminal) => terminal.side === side);
}

export function createConnectionId(
  originTerminalId: string,
  destinationTerminalId: string
): string {
  const safeOrigin = originTerminalId.replace(/[^a-zA-Z0-9]/g, "-");
  const safeDestination = destinationTerminalId.replace(/[^a-zA-Z0-9]/g, "-");
  return `connection-${safeOrigin}-${safeDestination}-${Date.now()}`;
}
