import { useMemo } from "react";

import type {
  MouseEvent,
  ReactElement,
} from "react";

import {
  FLOW_MAX_OFFSET,
  type FlowState,
} from "./circuitAnimation";

import type {
  CircuitConnection,
} from "../../core/CircuitConnection";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

import {
  DEFAULT_CANVAS_SIZE,
  getTerminalPosition,
  type CanvasSize,
} from "./circuitGeometry";

import {
  routeConnections,
} from "./wireRouter";

interface CircuitConnectionsSvgProps {
  connections:
    CircuitConnection[];

  elements:
    CircuitElement[];

  selectedConnectionId:
    string | null;

  canvasSize?: CanvasSize;

  /* Cor de cada terminal na animação; vazio quando desligada. */
  terminalColors?: Record<string, string>;
  wireFlow?: Record<string, FlowState>;

  onSelectConnection: (
    event:
      MouseEvent<SVGPathElement>,
    connectionId: string
  ) => void;
}

const WIRE_DOT_SPACING = 16;

function parsePath(pathData: string) {
  const nums = pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }

  return points;
}

/* Pontos de corrente andando ao longo do fio. */
function WireDots({
  pathData,
  flow,
}: {
  pathData: string;
  flow: FlowState;
}) {
  if (flow.strength < 0.02) {
    return null;
  }

  const points = parsePath(pathData);
  const lengths: number[] = [];
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );

    lengths.push(length);
    total += length;
  }

  if (total < 1) {
    return null;
  }

  const dots: ReactElement[] = [];
  const first = Math.floor(-FLOW_MAX_OFFSET / WIRE_DOT_SPACING) - 1;
  const last = Math.ceil((total + FLOW_MAX_OFFSET) / WIRE_DOT_SPACING) + 1;

  for (let k = first; k <= last; k++) {
    let distance = k * WIRE_DOT_SPACING + flow.offset;

    if (distance < 0 || distance > total) {
      continue;
    }

    let segment = 0;

    while (
      segment < lengths.length - 1 &&
      distance > lengths[segment]
    ) {
      distance -= lengths[segment];
      segment++;
    }

    const a = points[segment];
    const b = points[segment + 1];
    const ratio = lengths[segment] > 0 ? distance / lengths[segment] : 0;

    dots.push(
      <circle
        key={k}
        cx={a.x + (b.x - a.x) * ratio}
        cy={a.y + (b.y - a.y) * ratio}
        r={2.6}
        fill="#f59e0b"
        stroke="#92400e"
        strokeWidth={0.6}
        pointerEvents="none"
      />
    );
  }

  return <>{dots}</>;
}

export function CircuitConnectionsSvg({
  connections,
  elements,
  selectedConnectionId,
  canvasSize = DEFAULT_CANVAS_SIZE,
  terminalColors,
  wireFlow,
  onSelectConnection,
}: CircuitConnectionsSvgProps) {
  const fromTerminalByConnectionId =
    new Map(
      connections.map((connection) => [
        connection.id,
        connection.fromTerminalId,
      ])
    );

  const routes =
    useMemo(
      () =>
        routeConnections(
          elements,
          connections,
          canvasSize
        ),
      [elements, connections, canvasSize]
    );

  /*
   * Terminal com duas ou mais ligações é uma junção
   * elétrica. Esquemas reais marcam esses pontos com
   * uma bolinha preenchida.
   */
  const junctions =
    useMemo(() => {
      const counts =
        new Map<string, number>();

      connections.forEach(
        (connection) => {
          [
            connection.fromTerminalId,
            connection.toTerminalId,
          ].forEach(
            (terminalId) => {
              counts.set(
                terminalId,
                (counts.get(
                  terminalId
                ) ?? 0) + 1
              );
            }
          );
        }
      );

      const points: {
        id: string;
        x: number;
        y: number;
      }[] = [];

      counts.forEach(
        (count, terminalId) => {
          if (count < 2) {
            return;
          }

          const element =
            elements.find(
              (item) =>
                item.terminals.some(
                  (terminal) =>
                    terminal.id ===
                    terminalId
                )
            );

          if (!element) {
            return;
          }

          const position =
            getTerminalPosition(
              element,
              terminalId
            );

          points.push({
            id: terminalId,
            x: position.x,
            y: position.y,
          });
        }
      );

      return points;
    }, [elements, connections]);

  return (
    <svg
      aria-label="Conexões do circuito"
      style={{
        position:
          "absolute",

        inset:
          0,

        width:
          "100%",

        height:
          "100%",

        zIndex:
          0,

        overflow:
          "visible",
      }}
    >
      {routes.map(
        (route) => {
          const isSelected =
            selectedConnectionId ===
            route.connectionId;

          const animatedColor =
            terminalColors?.[
              fromTerminalByConnectionId.get(
                route.connectionId
              ) ?? ""
            ];

          return (
            <g
              key={
                route.connectionId
              }
            >
              <path
                d={
                  route.pathData
                }
                fill="none"
                stroke="transparent"
                strokeWidth={
                  16
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                cursor="pointer"
                onPointerDown={(
                  event
                ) => {
                  event.stopPropagation();
                }}
                onClick={(
                  event
                ) =>
                  onSelectConnection(
                    event,
                    route.connectionId
                  )
                }
              />

              <path
                d={
                  route.pathData
                }
                fill="none"
                stroke={
                  isSelected
                    ? "#2563eb"
                    : (animatedColor ??
                      "#222222")
                }
                strokeWidth={
                  isSelected ||
                  animatedColor
                    ? 3
                    : 2
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />

              {wireFlow?.[route.connectionId] ? (
                <WireDots
                  pathData={route.pathData}
                  flow={wireFlow[route.connectionId]}
                />
              ) : null}
            </g>
          );
        }
      )}

      {junctions.map(
        (junction) => (
          <circle
            key={
              junction.id
            }
            cx={
              junction.x
            }
            cy={
              junction.y
            }
            r={4}
            fill="#222222"
            pointerEvents="none"
          />
        )
      )}
    </svg>
  );
}
