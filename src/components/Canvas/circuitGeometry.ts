import { getGroupTerminalPoint } from "./threePhaseLayout";
import type {
  CircuitElement,
} from "../../core/CircuitElement";

import type {
  CircuitTerminalSide,
} from "../../core/CircuitTerminal";

/* Tamanho mínimo do Canvas; ele cresce para ocupar o espaço livre. */
export const CANVAS_WIDTH =
  720;

export const CANVAS_HEIGHT =
  480;

export interface CanvasSize {
  width: number;

  height: number;
}

export const DEFAULT_CANVAS_SIZE:
  CanvasSize = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};

export const COMPONENT_WIDTH =
  80;

export const COMPONENT_HEIGHT =
  80;

export const GRID_SIZE =
  20;

export const TERMINAL_SIZE =
  12;

const TERMINAL_EXIT_DISTANCE =
  24;

const CONNECTION_LANE_DISTANCE =
  60;

const CONNECTION_LANE_SPACING =
  18;

const CANVAS_WIRE_MARGIN =
  12;

export interface Point {
  x: number;

  y: number;
}

export interface TerminalPoint
  extends Point {
  side: CircuitTerminalSide;
}

/* Reserva uma folga ao redor para os fios passarem pela borda. */
export const ELEMENT_EDGE_GAP = 40;

export function clampElementPosition(
  x: number,
  y: number,
  size: CanvasSize =
    DEFAULT_CANVAS_SIZE
): Point {
  return {
    x: Math.max(
      ELEMENT_EDGE_GAP,
      Math.min(
        x,
        size.width -
          COMPONENT_WIDTH -
          ELEMENT_EDGE_GAP
      )
    ),

    y: Math.max(
      ELEMENT_EDGE_GAP,
      Math.min(
        y,
        size.height -
          COMPONENT_HEIGHT -
          ELEMENT_EDGE_GAP
      )
    ),
  };
}

export function snapElementPosition(
  x: number,
  y: number,
  size: CanvasSize =
    DEFAULT_CANVAS_SIZE
): Point {
  return clampElementPosition(
    Math.round(x / GRID_SIZE) *
      GRID_SIZE,
    Math.round(y / GRID_SIZE) *
      GRID_SIZE,
    size
  );
}

export function getTerminalPosition(
  element: CircuitElement,
  terminalId: string
): TerminalPoint {
  const terminal =
    element.terminals.find(
      (item) =>
        item.id ===
        terminalId
    );

  const side:
    CircuitTerminalSide =
      terminal?.side ??
      "right";

  /* Bloco trifásico: o terminal fica na ponta da estrela/triângulo. */
  const groupPoint = element.group
    ? getGroupTerminalPoint(element, side)
    : null;

  if (groupPoint) {
    return { x: groupPoint.x, y: groupPoint.y, side: groupPoint.exit };
  }

  return {
    x:
      side === "left"
        ? element.x
        : element.x +
          COMPONENT_WIDTH,

    y:
      element.y +
      COMPONENT_HEIGHT /
        2,

    side,
  };
}

function getTerminalExitX(
  terminal:
    TerminalPoint
): number {
  if (
    terminal.side ===
    "left"
  ) {
    return (
      terminal.x -
      TERMINAL_EXIT_DISTANCE
    );
  }

  return (
    terminal.x +
    TERMINAL_EXIT_DISTANCE
  );
}

function terminalsFaceEachOther(
  start:
    TerminalPoint,
  end:
    TerminalPoint
): boolean {
  const startFacesRight =
    start.side ===
      "right" &&
    start.x <=
      end.x &&
    end.side ===
      "left";

  const startFacesLeft =
    start.side ===
      "left" &&
    start.x >=
      end.x &&
    end.side ===
      "right";

  return (
    startFacesRight ||
    startFacesLeft
  );
}

function getExternalLaneY(
  start:
    TerminalPoint,
  end:
    TerminalPoint,
  routeIndex: number
): number {
  const laneOffset =
    CONNECTION_LANE_DISTANCE +
    routeIndex *
      CONNECTION_LANE_SPACING;

  const lowerLane =
    Math.max(
      start.y,
      end.y
    ) +
    laneOffset;

  if (
    lowerLane <=
    CANVAS_HEIGHT -
      CANVAS_WIRE_MARGIN
  ) {
    return lowerLane;
  }

  const upperLane =
    Math.min(
      start.y,
      end.y
    ) -
    laneOffset;

  return Math.max(
    CANVAS_WIRE_MARGIN,
    upperLane
  );
}

function createDirectPath(
  start:
    TerminalPoint,
  end:
    TerminalPoint
): string {
  if (
    start.y ===
    end.y
  ) {
    return [
      `M ${start.x} ${start.y}`,
      `L ${end.x} ${end.y}`,
    ].join(" ");
  }

  const middleX =
    (
      start.x +
      end.x
    ) /
    2;

  return [
    `M ${start.x} ${start.y}`,
    `L ${middleX} ${start.y}`,
    `L ${middleX} ${end.y}`,
    `L ${end.x} ${end.y}`,
  ].join(" ");
}

function createExternalPath(
  start:
    TerminalPoint,
  end:
    TerminalPoint,
  routeIndex: number
): string {
  const startExitX =
    getTerminalExitX(
      start
    );

  const endExitX =
    getTerminalExitX(
      end
    );

  const laneY =
    getExternalLaneY(
      start,
      end,
      routeIndex
    );

  return [
    `M ${start.x} ${start.y}`,

    `L ${startExitX} ${start.y}`,

    `L ${startExitX} ${laneY}`,

    `L ${endExitX} ${laneY}`,

    `L ${endExitX} ${end.y}`,

    `L ${end.x} ${end.y}`,
  ].join(" ");
}

export function createOrthogonalPath(
  start:
    TerminalPoint,
  end:
    TerminalPoint,
  routeIndex = 0
): string {
  if (
    terminalsFaceEachOther(
      start,
      end
    )
  ) {
    return createDirectPath(
      start,
      end
    );
  }

  return createExternalPath(
    start,
    end,
    routeIndex
  );
}