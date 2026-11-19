import { getElementIdFromTerminalId } from "../../core/CircuitConnection";
import type {
  CircuitConnection,
} from "../../core/CircuitConnection";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

import {
  DEFAULT_CANVAS_SIZE,
  type CanvasSize,
  COMPONENT_HEIGHT,
  COMPONENT_WIDTH,
  createOrthogonalPath,
  getTerminalPosition,
} from "./circuitGeometry";

import type {
  Point,
  TerminalPoint,
} from "./circuitGeometry";

/*
 * Roteador de fios ortogonais (estilo esquemático).
 *
 * Usa A* em uma grade de STEP px. Os componentes são
 * obstáculos, então os fios contornam os corpos em vez de
 * atravessá-los. Curvas e sobreposição com outros fios
 * recebem penalidade, o que gera caminhos curtos, com
 * poucas dobras e bem separados.
 */

const STEP = 10;

/* Margem fora do Canvas onde os fios ainda podem passar. */
const OFFSET = 60;

const LEAD = 20;

const BODY_MARGIN = 10;

/* Distância mínima entre os fios e a borda do Canvas. */
const EDGE_MARGIN = 20;

const TURN_COST = 6;

const OVERLAP_COST = 4;

/*
 * Dimensões da grade de busca. O tamanho do Canvas muda com a
 * janela, então a grade é reconfigurada a cada chamada de
 * routeConnections (o roteamento é síncrono, sem concorrência).
 */
let canvasWidth = DEFAULT_CANVAS_SIZE.width;

let canvasHeight = DEFAULT_CANVAS_SIZE.height;

let COLUMNS = 0;

let ROWS = 0;

function configureGrid(
  size: CanvasSize
): void {
  canvasWidth = size.width;

  canvasHeight = size.height;

  COLUMNS =
    Math.ceil(
      (canvasWidth + OFFSET * 2) /
        STEP
    ) + 1;

  ROWS =
    Math.ceil(
      (canvasHeight + OFFSET * 2) /
        STEP
    ) + 1;
}

configureGrid(DEFAULT_CANVAS_SIZE);

/* 0 = direita, 1 = baixo, 2 = esquerda, 3 = cima */
const DX = [1, 0, -1, 0];

const DY = [0, 1, 0, -1];

function toCell(
  value: number,
  max: number
): number {
  return Math.min(
    max - 1,
    Math.max(
      0,
      Math.round(
        (value + OFFSET) / STEP
      )
    )
  );
}

function cellToPoint(
  column: number,
  row: number
): Point {
  return {
    x: column * STEP - OFFSET,
    y: row * STEP - OFFSET,
  };
}

class MinHeap {
  private items:
    { key: number; value: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(
    key: number,
    value: number
  ): void {
    const items = this.items;

    items.push({ key, value });

    let index = items.length - 1;

    while (index > 0) {
      const parent =
        (index - 1) >> 1;

      if (
        items[parent].key <=
        items[index].key
      ) {
        break;
      }

      [items[parent], items[index]] =
        [items[index], items[parent]];

      index = parent;
    }
  }

  pop(): number {
    const items = this.items;

    const top = items[0];

    const last = items.pop();

    if (
      items.length > 0 &&
      last
    ) {
      items[0] = last;

      let index = 0;

      for (;;) {
        const left = index * 2 + 1;

        const right = left + 1;

        let smallest = index;

        if (
          left < items.length &&
          items[left].key <
            items[smallest].key
        ) {
          smallest = left;
        }

        if (
          right < items.length &&
          items[right].key <
            items[smallest].key
        ) {
          smallest = right;
        }

        if (smallest === index) {
          break;
        }

        [items[smallest], items[index]] =
          [items[index], items[smallest]];

        index = smallest;
      }
    }

    return top.value;
  }
}

function buildObstacles(
  elements: CircuitElement[]
): Uint8Array {
  const blocked =
    new Uint8Array(
      COLUMNS * ROWS
    );

  /* Fios não saem do Canvas nem correm colados na borda. */
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const point = cellToPoint(column, row);

      if (
        point.x < EDGE_MARGIN ||
        point.x > canvasWidth - EDGE_MARGIN ||
        point.y < EDGE_MARGIN ||
        point.y > canvasHeight - EDGE_MARGIN
      ) {
        blocked[row * COLUMNS + column] = 1;
      }
    }
  }

  elements.forEach(
    (element) => {
      /*
       * Bloqueia o corpo do componente (sem os terminais
       * das bordas) mais uma margem, para os fios não
       * encostarem no desenho.
       */
      const left =
        element.x + 1;

      const right =
        element.x +
        COMPONENT_WIDTH -
        1;

      const top =
        element.y -
        BODY_MARGIN;

      const bottom =
        element.y +
        COMPONENT_HEIGHT +
        BODY_MARGIN;

      const firstColumn =
        toCell(left, COLUMNS);

      const lastColumn =
        toCell(right, COLUMNS);

      const firstRow =
        toCell(top, ROWS);

      const lastRow =
        toCell(bottom, ROWS);

      for (
        let row = firstRow;
        row <= lastRow;
        row++
      ) {
        for (
          let column = firstColumn;
          column <= lastColumn;
          column++
        ) {
          /*
           * A linha central (a dos terminais) fica livre
           * nas bordas para o fio sair do componente.
           */
          blocked[
            row * COLUMNS + column
          ] = 1;
        }
      }
    }
  );

  return blocked;
}

function exitPoint(
  terminal: TerminalPoint
): Point {
  return {
    x:
      terminal.side === "left"
        ? terminal.x - LEAD
        : terminal.x + LEAD,

    y: terminal.y,
  };
}

function simplify(
  points: Point[]
): Point[] {
  const result: Point[] = [];

  points.forEach(
    (point) => {
      const last =
        result[result.length - 1];

      if (
        last &&
        last.x === point.x &&
        last.y === point.y
      ) {
        return;
      }

      result.push(point);

      while (result.length >= 3) {
        const a =
          result[result.length - 3];

        const b =
          result[result.length - 2];

        const c =
          result[result.length - 1];

        const collinear =
          (a.x === b.x &&
            b.x === c.x) ||
          (a.y === b.y &&
            b.y === c.y);

        if (!collinear) {
          break;
        }

        result.splice(
          result.length - 2,
          1
        );
      }
    }
  );

  return result;
}

function findPath(
  start: Point,
  end: Point,
  startDirection: number,
  blocked: Uint8Array,
  used: Uint8Array
): Point[] | null {
  const startColumn =
    toCell(start.x, COLUMNS);

  const startRow =
    toCell(start.y, ROWS);

  const endColumn =
    toCell(end.x, COLUMNS);

  const endRow =
    toCell(end.y, ROWS);

  const stateCount =
    COLUMNS * ROWS * 4;

  const cost =
    new Float64Array(
      stateCount
    ).fill(Infinity);

  const previous =
    new Int32Array(
      stateCount
    ).fill(-1);

  const heap = new MinHeap();

  const startState =
    (startRow * COLUMNS +
      startColumn) *
      4 +
    startDirection;

  cost[startState] = 0;

  heap.push(0, startState);

  let goalState = -1;

  while (heap.size > 0) {
    const state = heap.pop();

    const direction = state % 4;

    const cell = (state - direction) / 4;

    const column = cell % COLUMNS;

    const row = (cell - column) / COLUMNS;

    if (
      column === endColumn &&
      row === endRow
    ) {
      goalState = state;

      break;
    }

    for (
      let next = 0;
      next < 4;
      next++
    ) {
      /* Sem retorno de 180°. */
      if (
        next === (direction + 2) % 4
      ) {
        continue;
      }

      const nextColumn =
        column + DX[next];

      const nextRow =
        row + DY[next];

      if (
        nextColumn < 0 ||
        nextRow < 0 ||
        nextColumn >= COLUMNS ||
        nextRow >= ROWS
      ) {
        continue;
      }

      const nextCell =
        nextRow * COLUMNS +
        nextColumn;

      const isGoal =
        nextColumn === endColumn &&
        nextRow === endRow;

      if (
        blocked[nextCell] &&
        !isGoal
      ) {
        continue;
      }

      const stepCost =
        1 +
        (next !== direction
          ? TURN_COST
          : 0) +
        (used[nextCell]
          ? OVERLAP_COST
          : 0);

      const nextState =
        nextCell * 4 + next;

      const total =
        cost[state] + stepCost;

      if (total < cost[nextState]) {
        cost[nextState] = total;

        previous[nextState] = state;

        const heuristic =
          Math.abs(
            nextColumn - endColumn
          ) +
          Math.abs(
            nextRow - endRow
          );

        heap.push(
          total + heuristic,
          nextState
        );
      }
    }
  }

  if (goalState === -1) {
    return null;
  }

  const points: Point[] = [];

  let state = goalState;

  while (state !== -1) {
    const direction = state % 4;

    const cell = (state - direction) / 4;

    const column = cell % COLUMNS;

    const row = (cell - column) / COLUMNS;

    points.push(
      cellToPoint(column, row)
    );

    state = previous[state];
  }

  return points.reverse();
}

function toPathData(
  points: Point[]
): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");
}

export interface RoutedConnection {
  connectionId: string;

  pathData: string;
}

export function routeConnections(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  size: CanvasSize =
    DEFAULT_CANVAS_SIZE
): RoutedConnection[] {
  configureGrid(size);

  const blocked =
    buildObstacles(elements);

  const used =
    new Uint8Array(
      COLUMNS * ROWS
    );

  const routed:
    RoutedConnection[] = [];

  connections.forEach(
    (connection, index) => {
      const from =
        elements.find(
          (element) =>
            element.id ===
            getElementIdFromTerminalId(
              connection.fromTerminalId
            )
        );

      const to =
        elements.find(
          (element) =>
            element.id ===
            getElementIdFromTerminalId(
              connection.toTerminalId
            )
        );

      if (!from || !to) {
        return;
      }

      const start =
        getTerminalPosition(
          from,
          connection.fromTerminalId
        );

      const end =
        getTerminalPosition(
          to,
          connection.toTerminalId
        );

      const startExit =
        exitPoint(start);

      const endExit =
        exitPoint(end);

      const found =
        findPath(
          startExit,
          endExit,
          start.side === "left"
            ? 2
            : 0,
          blocked,
          used
        );

      if (!found) {
        routed.push({
          connectionId:
            connection.id,

          pathData:
            createOrthogonalPath(
              start,
              end,
              index
            ),
        });

        return;
      }

      const points =
        simplify([
          { x: start.x, y: start.y },
          startExit,
          ...found,
          endExit,
          { x: end.x, y: end.y },
        ]);

      /* Marca as células usadas para afastar os próximos fios. */
      found.forEach(
        (point) => {
          used[
            toCell(point.y, ROWS) *
              COLUMNS +
              toCell(
                point.x,
                COLUMNS
              )
          ] = 1;
        }
      );

      routed.push({
        connectionId:
          connection.id,

        pathData:
          toPathData(points),
      });
    }
  );

  return routed;
}
