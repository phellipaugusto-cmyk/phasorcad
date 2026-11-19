import {
  isSourceType,
} from "../core/CircuitElement";
import {
  getClosedSwitchConnections,
  isOpenSwitch,
} from "../core/switchModel";

import type {
  CircuitElement,
} from "../core/CircuitElement";

import type {
  CircuitConnection,
} from "../core/CircuitConnection";

function addGraphEdge(
  graph: Map<string, Set<string>>,
  from: string,
  to: string
): void {
  if (!graph.has(from)) {
    graph.set(
      from,
      new Set<string>()
    );
  }

  if (!graph.has(to)) {
    graph.set(
      to,
      new Set<string>()
    );
  }

  graph.get(from)?.add(
    to
  );

  graph.get(to)?.add(
    from
  );
}

function getTerminalId(
  element: CircuitElement,
  side: "left" | "right"
): string | null {
  const terminal =
    element.terminals.find(
      (item) =>
        item.side === side
    );

  return terminal?.id ?? null;
}

export function isCircuitClosed(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  sourceOverride?: CircuitElement
): boolean {
  const source =
    sourceOverride ??
    elements.find(
      (element) =>
        isSourceType(element.type)
    );

  if (!source) {
    return false;
  }

  const sourceLeftTerminalId =
    getTerminalId(
      source,
      "left"
    );

  const sourceRightTerminalId =
    getTerminalId(
      source,
      "right"
    );

  if (
    !sourceLeftTerminalId ||
    !sourceRightTerminalId
  ) {
    return false;
  }

  const validTerminalIds =
    new Set<string>();

  elements.forEach(
    (element) => {
      element.terminals.forEach(
        (terminal) => {
          validTerminalIds.add(
            terminal.id
          );
        }
      );
    }
  );

  const graph =
    new Map<
      string,
      Set<string>
    >();

  /*
   * Cada fio cria uma ligação bidirecional entre
   * dois terminais.
   */
  connections.forEach(
    (connection) => {
      const fromTerminalExists =
        validTerminalIds.has(
          connection.fromTerminalId
        );

      const toTerminalExists =
        validTerminalIds.has(
          connection.toTerminalId
        );

      if (
        !fromTerminalExists ||
        !toTerminalExists
      ) {
        return;
      }

      addGraphEdge(
        graph,
        connection.fromTerminalId,
        connection.toTerminalId
      );
    }
  );

  /*
   * Cada componente passivo permite continuidade
   * elétrica entre seu terminal esquerdo e direito.
   *
   * A fonte não recebe essa ligação interna no grafo.
   * Se ligássemos os terminais da fonte internamente,
   * todo circuito com uma fonte seria considerado
   * fechado mesmo sem caminho externo.
   */
  elements.forEach(
    (element) => {
      /*
       * Só a fonte analisada é "aberta" internamente. As outras
       * fontes deixam passar o caminho (uma fonte em série com a
       * outra não impede o circuito de fechar).
       */
      if (element.id === source.id) {
        return;
      }

      /* Interruptor aberto não dá continuidade. */
      if (isOpenSwitch(element)) {
        return;
      }

      const leftTerminalId =
        getTerminalId(
          element,
          "left"
        );

      const rightTerminalId =
        getTerminalId(
          element,
          "right"
        );

      if (
        !leftTerminalId ||
        !rightTerminalId
      ) {
        return;
      }

      addGraphEdge(
        graph,
        leftTerminalId,
        rightTerminalId
      );
    }
  );

  const visited =
    new Set<string>();

  const queue: string[] = [
    sourceRightTerminalId,
  ];

  while (
    queue.length > 0
  ) {
    const currentTerminalId =
      queue.shift();

    if (!currentTerminalId) {
      continue;
    }

    if (
      currentTerminalId ===
      sourceLeftTerminalId
    ) {
      return true;
    }

    if (
      visited.has(
        currentTerminalId
      )
    ) {
      continue;
    }

    visited.add(
      currentTerminalId
    );

    const neighbors =
      graph.get(
        currentTerminalId
      );

    if (!neighbors) {
      continue;
    }

    neighbors.forEach(
      (neighborTerminalId) => {
        if (
          !visited.has(
            neighborTerminalId
          )
        ) {
          queue.push(
            neighborTerminalId
          );
        }
      }
    );
  }

  return false;
}

export type CircuitState =
  | "open"
  | "closed"
  | "short";

/*
 * Verifica se existe um caminho formado SOMENTE por fios
 * entre os dois terminais da fonte, sem passar por nenhum
 * componente passivo.
 *
 * Isso é um curto-circuito na fonte ideal: impedância zero
 * entre os polos exigiria corrente infinita.
 */
function hasWireOnlyPathBetweenSourceTerminals(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  sourceOverride?: CircuitElement
): boolean {
  const source =
    sourceOverride ??
    elements.find(
      (element) =>
        isSourceType(element.type)
    );

  /*
   * Uma fonte de corrente ideal em curto apenas entrega
   * a corrente a um fio (V = 0): não é uma condição de falha.
   */
  if (source && source.type === "currentSource") {
    return false;
  }

  if (!source) {
    return false;
  }

  const sourceLeftTerminalId =
    getTerminalId(
      source,
      "left"
    );

  const sourceRightTerminalId =
    getTerminalId(
      source,
      "right"
    );

  if (
    !sourceLeftTerminalId ||
    !sourceRightTerminalId
  ) {
    return false;
  }

  const validTerminalIds =
    new Set<string>();

  elements.forEach(
    (element) => {
      element.terminals.forEach(
        (terminal) => {
          validTerminalIds.add(
            terminal.id
          );
        }
      );
    }
  );

  const graph =
    new Map<
      string,
      Set<string>
    >();

  /* Interruptor fechado conta como fio. */
  [
    ...connections,
    ...getClosedSwitchConnections(elements),
  ].forEach(
    (connection) => {
      if (
        !validTerminalIds.has(
          connection.fromTerminalId
        ) ||
        !validTerminalIds.has(
          connection.toTerminalId
        )
      ) {
        return;
      }

      addGraphEdge(
        graph,
        connection.fromTerminalId,
        connection.toTerminalId
      );
    }
  );

  const visited =
    new Set<string>();

  const queue: string[] = [
    sourceRightTerminalId,
  ];

  while (queue.length > 0) {
    const current =
      queue.shift();

    if (!current) {
      continue;
    }

    if (
      current ===
      sourceLeftTerminalId
    ) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    graph.get(current)?.forEach(
      (neighbor) => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    );
  }

  return false;
}

/*
 * Estado elétrico do circuito:
 *
 * short  - fios ligam os dois polos da fonte diretamente
 * closed - há caminho entre os polos passando por componentes
 * open   - não há caminho entre os polos
 */
export function getCircuitState(
  elements: CircuitElement[],
  connections: CircuitConnection[]
): CircuitState {
  const sources = elements.filter(
    (element) =>
      isSourceType(element.type)
  );

  if (sources.length === 0) {
    return "open";
  }

  /* Fonte de tensão ligada só por fios: curto em qualquer uma. */
  if (
    sources.some((source) =>
      hasWireOnlyPathBetweenSourceTerminals(
        elements,
        connections,
        source
      )
    )
  ) {
    return "short";
  }

  /* Fechado só se TODAS as fontes têm caminho entre seus terminais. */
  return sources.every((source) =>
    isCircuitClosed(
      elements,
      connections,
      source
    )
  )
    ? "closed"
    : "open";
}
