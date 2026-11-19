import type {
  MouseEvent,
  ReactElement,
} from "react";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

import type {
  CircuitTerminal,
} from "../../core/CircuitTerminal";

import type {
  FlowState,
} from "./circuitAnimation";

import {
  COMPONENT_HEIGHT,
  COMPONENT_WIDTH,
} from "./circuitGeometry";

import {
  formatElementValue,
  getTerminal,
} from "./circuitValues";

import {
  CircuitTerminalButton,
} from "./CircuitTerminalButton";

/*
 * Símbolos esquemáticos desenhados em um quadro de 80 x 80.
 * O condutor passa pela linha central (y = 40), onde ficam
 * os terminais.
 */
function ElementSymbol({
  type,
  closed = true,
}: {
  type: CircuitElement["type"];
  closed?: boolean;
}) {
  const stroke = "#222222";

  const common = {
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      width={COMPONENT_WIDTH}
      height={COMPONENT_HEIGHT}
      viewBox="0 0 80 80"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
      }}
    >
      {type === "resistor" ? (
        <path
          {...common}
          d="M 0 40 L 18 40 L 24 28 L 32 52 L 40 28 L 48 52 L 56 28 L 62 40 L 80 40"
        />
      ) : null}

      {type === "capacitor" ? (
        <>
          <path
            {...common}
            d="M 0 40 L 35 40 M 45 40 L 80 40"
          />

          <path
            {...common}
            d="M 35 22 L 35 58 M 45 22 L 45 58"
          />
        </>
      ) : null}

      {type === "inductor" ? (
        <path
          {...common}
          d="M 0 40 L 16 40 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 L 80 40"
        />
      ) : null}

      {type === "motor" ? (
        <>
          <path
            {...common}
            d="M 0 40 L 22 40 M 58 40 L 80 40"
          />
          <circle
            {...common}
            cx={40}
            cy={40}
            r={18}
          />
          <path
            {...common}
            d="M 32 49 L 32 31 L 40 42 L 48 31 L 48 49"
          />
        </>
      ) : null}
      {type === "lamp" ? (
        <>
          <path
            {...common}
            d="M 0 40 L 26 40 M 54 40 L 80 40"
          />
          <circle
            {...common}
            cx={40}
            cy={40}
            r={14}
          />
          <path
            {...common}
            d="M 30 30 L 50 50 M 50 30 L 30 50"
          />
        </>
      ) : null}

      {type === "switch" ? (
        <>
          <path
            {...common}
            d="M 0 40 L 24 40 M 56 40 L 80 40"
          />
          <circle {...common} cx={24} cy={40} r={2.5} />
          <circle {...common} cx={56} cy={40} r={2.5} />
          <path
            {...common}
            stroke={closed ? stroke : "#dc2626"}
            d={closed ? "M 24 40 L 56 40" : "M 24 40 L 53 24"}
          />
        </>
      ) : null}

      {type === "source" ? (
        <>
          <path
            {...common}
            d="M 0 40 L 24 40 M 56 40 L 80 40"
          />

          <circle
            {...common}
            cx={40}
            cy={40}
            r={16}
          />

          <path
            {...common}
            d="M 31 40 q 4.5 -10 9 0 t 9 0"
          />
        </>
      ) : null}

      {type === "currentSource" ? (
        <>
          <path
            {...common}
            d="M 0 40 L 24 40 M 56 40 L 80 40"
          />

          <circle
            {...common}
            cx={40}
            cy={40}
            r={16}
          />

          <path
            {...common}
            d="M 30 40 L 50 40 M 44 34 L 50 40 L 44 46"
          />
        </>
      ) : null}
    </svg>
  );
}

const DOT_SPACING = 16;

/*
 * Pontos de corrente sobre o condutor (y = 40). Andam com o
 * deslocamento da carga e reaparecem do outro lado (80 px).
 */
function FlowDots({
  flow,
}: {
  flow: FlowState;
}) {
  if (flow.strength < 0.02) {
    return null;
  }

  const count = Math.floor(
    COMPONENT_WIDTH / DOT_SPACING
  );

  const dots: ReactElement[] = [];

  for (let index = 0; index <= count; index++) {
    const raw =
      index * DOT_SPACING + flow.offset;

    const x =
      ((raw % COMPONENT_WIDTH) +
        COMPONENT_WIDTH) %
      COMPONENT_WIDTH;

    dots.push(
      <circle
        key={index}
        cx={x}
        cy={40}
        r={2.6}
        fill="#f59e0b"
        stroke="#92400e"
        strokeWidth={0.6}
      />
    );
  }

  return (
    <svg
      width={COMPONENT_WIDTH}
      height={COMPONENT_HEIGHT}
      viewBox="0 0 80 80"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
      }}
    >
      {dots}
    </svg>
  );
}

interface CircuitComponentProps {
  element: CircuitElement;

  /* Estado dos pontos de corrente na animação (ausente = desligada). */
  flow?: FlowState;

  isSelected: boolean;

  isEditing: boolean;

  editingValue: string;

  selectedOriginTerminalId:
    string | null;

  connectedTerminalIds:
    ReadonlySet<string>;

  onStartDrag: (
    event:
      MouseEvent<HTMLDivElement>,
    element:
      CircuitElement
  ) => void;

  onSelectElement: (
    elementId: string
  ) => void;

  onStartEditing: (
    element: CircuitElement
  ) => void;

  onEditingValueChange: (
    value: string
  ) => void;

  onSaveValue: (
    element: CircuitElement
  ) => void;

  onCancelEditing: () => void;

  onSelectTerminal: (
    event:
      MouseEvent<HTMLButtonElement>,
    element:
      CircuitElement,
    terminal:
      CircuitTerminal | undefined
  ) => void;
}

export function CircuitComponent({
  element,
  flow,
  isSelected,
  isEditing,
  editingValue,
  selectedOriginTerminalId,
  connectedTerminalIds,
  onStartDrag,
  onSelectElement,
  onStartEditing,
  onEditingValueChange,
  onSaveValue,
  onCancelEditing,
  onSelectTerminal,
}: CircuitComponentProps) {
  const leftTerminal =
    getTerminal(
      element,
      "left"
    );

  const rightTerminal =
    getTerminal(
      element,
      "right"
    );

  return (
    <div
      onPointerDown={(event) =>
        onStartDrag(
          event,
          element
        )
      }
      onClick={() =>
        onSelectElement(
          element.id
        )
      }
      onDoubleClick={() =>
        onStartEditing(
          element
        )
      }
      style={{
        touchAction: "none",
        position: "absolute",

        left: element.x,

        top: element.y,

        width:
          `${COMPONENT_WIDTH}px`,

        height:
          `${COMPONENT_HEIGHT}px`,

        boxSizing:
          "border-box",

        textAlign:
          "center",

        backgroundColor:
          "#ffffff",

        zIndex: 1,

        border:
          isSelected
            ? "2px dashed #2563eb"
            : "2px solid transparent",

        borderRadius:
          "6px",

        cursor:
          isEditing
            ? "text"
            : "move",

        userSelect:
          "none",
      }}
    >
      {leftTerminal ? (
        <CircuitTerminalButton
          terminalId={
            leftTerminal.id
          }
          side="left"
          elementLabel={
            element.label
          }
          isSelected={
            selectedOriginTerminalId ===
            leftTerminal.id
          }
          isConnected={
            connectedTerminalIds.has(
              leftTerminal.id
            )
          }
          onClick={(event) =>
            onSelectTerminal(
              event,
              element,
              leftTerminal
            )
          }
        />
      ) : null}

      {rightTerminal ? (
        <CircuitTerminalButton
          terminalId={
            rightTerminal.id
          }
          side="right"
          elementLabel={
            element.label
          }
          isSelected={
            selectedOriginTerminalId ===
            rightTerminal.id
          }
          isConnected={
            connectedTerminalIds.has(
              rightTerminal.id
            )
          }
          onClick={(event) =>
            onSelectTerminal(
              event,
              element,
              rightTerminal
            )
          }
        />
      ) : null}

      <ElementSymbol
        type={element.type}
        closed={element.closed !== false}
      />

      {flow ? (
        <FlowDots flow={flow} />
      ) : null}

      <div
        style={{
          position: "absolute",
          top: 2,
          left: 0,
          right: 0,
          fontSize: "13px",
          pointerEvents: "none",
        }}
      >
        <strong>
          {element.label}
        </strong>
      </div>

      {isEditing ? (
        <input
          autoFocus
          type="number"
          value={editingValue}
          onPointerDown={(event) =>
            event.stopPropagation()
          }
          onClick={(event) =>
            event.stopPropagation()
          }
          onChange={(event) =>
            onEditingValueChange(
              event.target.value
            )
          }
          onBlur={() =>
            onSaveValue(
              element
            )
          }
          onKeyDown={(event) => {
            if (
              event.key ===
              "Enter"
            ) {
              onSaveValue(
                element
              );
            }

            if (
              event.key ===
              "Escape"
            ) {
              onCancelEditing();
            }
          }}
          style={{
            position: "absolute",
            bottom: 4,
            left: 5,
            width: "66px",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            fontSize: "13px",
            pointerEvents: "none",
          }}
        >
          {formatElementValue(element)}
        </div>
      )}
    </div>
  );
}