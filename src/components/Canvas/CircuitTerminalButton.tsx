import type { MouseEvent } from "react";

import type {
  CircuitTerminalSide,
} from "../../core/CircuitTerminal";

import {
  TERMINAL_SIZE,
} from "./circuitGeometry";

interface CircuitTerminalButtonProps {
  terminalId: string;

  side: CircuitTerminalSide;

  elementLabel: string;

  isSelected: boolean;

  isConnected: boolean;

  onClick: (
    event:
      MouseEvent<HTMLButtonElement>
  ) => void;
}

export function CircuitTerminalButton({
  terminalId,
  side,
  elementLabel,
  isSelected,
  isConnected,
  onClick,
}: CircuitTerminalButtonProps) {
  const borderColor =
    isSelected
      ? "#1d4ed8"
      : isConnected
        ? "#15803d"
        : "#111827";

  const backgroundColor =
    isSelected
      ? "#2563eb"
      : isConnected
        ? "#22c55e"
        : "#ffffff";

  const boxShadow =
    isSelected
      ? "0 0 0 4px rgba(37, 99, 235, 0.22)"
      : isConnected
        ? "0 0 0 3px rgba(34, 197, 94, 0.18)"
        : "none";

  const connectionState =
    isConnected
      ? "conectado"
      : "livre";

  return (
    <button
      type="button"
      className="terminal-btn"
      title={`${terminalId} (${connectionState})`}
      aria-label={
        `Selecionar terminal ${
          side === "left"
            ? "esquerdo"
            : "direito"
        } de ${elementLabel}. Terminal ${connectionState}.`
      }
      onPointerDown={(event) =>
        event.stopPropagation()
      }
      onClick={onClick}
      style={{
        position: "absolute",

        ...(side === "left"
          ? {
              left:
                `${-TERMINAL_SIZE / 2}px`,
            }
          : {
              right:
                `${-TERMINAL_SIZE / 2}px`,
            }),

        top:
          `calc(50% - ${TERMINAL_SIZE / 2}px)`,

        width:
          `${TERMINAL_SIZE}px`,

        height:
          `${TERMINAL_SIZE}px`,

        padding: 0,

        border:
          `2px solid ${borderColor}`,

        borderRadius: "50%",

        backgroundColor,

        boxShadow,

        cursor: "crosshair",

        zIndex: 3,
      }}
    />
  );
}