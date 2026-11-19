import type {
  CircuitElement,
} from "../core/CircuitElement";

import type {
  CircuitConnection,
} from "../core/CircuitConnection";

import {
  migrateConnection,
  migrateElement,
} from "./circuitStorage";

/*
 * Arquivo de circuito (.json) para levar um circuito entre
 * máquinas, versões e origens do app (o localStorage de
 * cada origem é separado).
 */

export const CIRCUIT_FILE_FORMAT =
  "phasorcad-circuit";

export const CIRCUIT_FILE_VERSION = 1;

const MAX_ELEMENTS = 200;

const DEFAULT_FREQUENCY = 60;

export interface CircuitFileData {
  elements: CircuitElement[];

  connections: CircuitConnection[];

  frequency: number;
}

export type CircuitFileParseResult =
  | {
      ok: true;
      data: CircuitFileData;
    }
  | {
      ok: false;
      error: string;
    };

export function serializeCircuit(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  frequency: number
): string {
  return JSON.stringify(
    {
      format: CIRCUIT_FILE_FORMAT,
      version: CIRCUIT_FILE_VERSION,
      frequency,
      elements: elements.map(
        (element) => ({
          id: element.id,
          type: element.type,
          label: element.label,
          value: element.value,
          ...(element.phase
            ? { phase: element.phase }
            : {}),
          ...(element.type === "motor" && element.motor
            ? { motor: element.motor }
            : {}),
          ...(element.type === "lamp" && element.lamp
            ? { lamp: element.lamp }
            : {}),
          ...(element.type === "switch"
            ? {
                closed: element.closed !== false,
                ...(element.controlledBy
                  ? { controlledBy: element.controlledBy }
                  : {}),
                ...(element.normallyClosed ? { normallyClosed: true } : {}),
                ...(element.momentary ? { momentary: true } : {}),
              }
            : {}),
          ...(element.type === "contactor" && element.contactor
            ? {
                contactor: element.contactor,
                ...(element.energized ? { energized: true } : {}),
              }
            : {}),
          ...(element.measured
            ? { measured: element.measured }
            : {}),
          x: element.x,
          y: element.y,
        })
      ),
      connections: connections.map(
        (connection) => ({
          id: connection.id,
          fromTerminalId:
            connection.fromTerminalId,
          toTerminalId:
            connection.toTerminalId,
        })
      ),
    },
    null,
    2
  );
}

function fail(
  error: string
): CircuitFileParseResult {
  return {
    ok: false,
    error,
  };
}

export function parseCircuitFile(
  text: string
): CircuitFileParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(
      "O arquivo não é um JSON válido."
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null
  ) {
    return fail(
      "O arquivo não contém um circuito."
    );
  }

  const file = parsed as Record<
    string,
    unknown
  >;

  if (
    file.format !== CIRCUIT_FILE_FORMAT
  ) {
    return fail(
      "O arquivo não é um circuito do PhasorCAD."
    );
  }

  if (
    typeof file.version !== "number" ||
    file.version > CIRCUIT_FILE_VERSION
  ) {
    return fail(
      "O arquivo foi criado por uma versão mais nova do PhasorCAD."
    );
  }

  if (
    !Array.isArray(file.elements) ||
    !Array.isArray(file.connections)
  ) {
    return fail(
      "O arquivo não tem a lista de componentes e de conexões."
    );
  }

  if (file.elements.length > MAX_ELEMENTS) {
    return fail(
      `O circuito tem componentes demais (máximo ${MAX_ELEMENTS}).`
    );
  }

  const elements: CircuitElement[] = [];

  for (
    let index = 0;
    index < file.elements.length;
    index++
  ) {
    const element = migrateElement(
      file.elements[index]
    );

    if (element === null) {
      return fail(
        `O componente ${index + 1} do arquivo é inválido.`
      );
    }

    elements.push(element);
  }

  const ids = new Set(
    elements.map((element) => element.id)
  );

  if (ids.size !== elements.length) {
    return fail(
      "Há componentes com o mesmo identificador."
    );
  }

  const terminalIds = new Set(
    elements.flatMap((element) =>
      element.terminals.map(
        (terminal) => terminal.id
      )
    )
  );

  const connections: CircuitConnection[] =
    [];

  const connectionIds =
    new Set<string>();

  for (
    let index = 0;
    index < file.connections.length;
    index++
  ) {
    const connection = migrateConnection(
      file.connections[index]
    );

    if (connection === null) {
      return fail(
        `A conexão ${index + 1} do arquivo é inválida.`
      );
    }

    if (
      !terminalIds.has(
        connection.fromTerminalId
      ) ||
      !terminalIds.has(
        connection.toTerminalId
      )
    ) {
      return fail(
        `A conexão ${index + 1} liga um terminal que não existe.`
      );
    }

    if (
      connectionIds.has(connection.id)
    ) {
      return fail(
        "Há conexões com o mesmo identificador."
      );
    }

    connectionIds.add(connection.id);

    connections.push(connection);
  }

  const frequency =
    typeof file.frequency === "number" &&
    Number.isFinite(file.frequency) &&
    file.frequency > 0
      ? file.frequency
      : DEFAULT_FREQUENCY;

  return {
    ok: true,
    data: {
      elements,
      connections,
      frequency,
    },
  };
}
