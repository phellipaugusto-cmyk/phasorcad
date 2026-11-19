import { getMotorParameters } from "../core/motorModel";
import { getLampRatedVoltage } from "../core/lampModel";
import { getContactorParameters } from "../core/contactorModel";
import type {
  CircuitElement,
  CircuitElementType,
} from "../core/CircuitElement";

import type {
  CircuitConnection,
} from "../core/CircuitConnection";

import {
  isSourceType,
} from "../core/CircuitElement";

import {
  createCircuitTerminals,
} from "../core/CircuitTerminal";

import {
  defaultCircuitModel,
} from "../data/defaultCircuitModel";

export const ELEMENTS_STORAGE_KEY =
  "phasorcad-elements";

export const CONNECTIONS_STORAGE_KEY =
  "phasorcad-connections";

const validElementTypes:
  CircuitElementType[] = [
    "source",
    "currentSource",
    "resistor",
    "capacitor",
    "inductor",
    "motor",
    "lamp",
    "switch",
    "contactor",
  ];

function isElementType(
  value: unknown
): value is CircuitElementType {
  return (
    typeof value === "string" &&
    validElementTypes.includes(
      value as CircuitElementType
    )
  );
}

/* Leituras de bancada: só números finitos; nada válido = ausente. */
function sanitizeMeasured(
  raw: unknown
): CircuitElement["measured"] {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const source = raw as Record<string, unknown>;
  const result: NonNullable<CircuitElement["measured"]> = {};

  (["voltage", "current", "power"] as const).forEach((key) => {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = value;
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeMotor(
  raw: unknown
): NonNullable<CircuitElement["motor"]> {
  const motor = getMotorParameters({
    motor: raw as CircuitElement["motor"],
  });

  return motor;
}

export function migrateElement(
  value: unknown
): CircuitElement | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate =
    value as Partial<CircuitElement>;

  if (
    typeof candidate.id !== "string" ||
    !isElementType(
      candidate.type
    ) ||
    typeof candidate.label !== "string" ||
    typeof candidate.value !== "number" ||
    !Number.isFinite(
      candidate.value
    ) ||
    typeof candidate.x !== "number" ||
    !Number.isFinite(
      candidate.x
    ) ||
    typeof candidate.y !== "number" ||
    !Number.isFinite(
      candidate.y
    )
  ) {
    return null;
  }

  return {
    id:
      candidate.id,

    type:
      candidate.type,

    label:
      candidate.label,

    value:
      candidate.value,

    /* Fase só vale para fontes; sem ela a fonte fica em 0°. */
    ...(isSourceType(
      candidate.type
    ) &&
    typeof candidate.phase === "number" &&
    Number.isFinite(candidate.phase) &&
    candidate.phase !== 0
      ? { phase: candidate.phase }
      : {}),

    ...(candidate.type === "motor"
      ? { motor: sanitizeMotor(candidate.motor) }
      : {}),
    ...(candidate.type === "lamp"
      ? { lamp: { ratedVoltage: getLampRatedVoltage(candidate) } }
      : {}),
    ...(candidate.type === "switch"
      ? {
          closed: candidate.closed !== false,
          ...(typeof candidate.controlledBy === "string" &&
          candidate.controlledBy !== ""
            ? { controlledBy: candidate.controlledBy }
            : {}),
          ...(candidate.normallyClosed === true
            ? { normallyClosed: true }
            : {}),
        }
      : {}),
    ...(candidate.type === "contactor"
      ? { contactor: getContactorParameters(candidate) }
      : {}),
    ...(sanitizeMeasured(candidate.measured)
      ? { measured: sanitizeMeasured(candidate.measured) }
      : {}),

    x:
      candidate.x,

    y:
      candidate.y,

    terminals:
      createCircuitTerminals(
        candidate.id
      ),
  };
}

export function loadElements(): CircuitElement[] {
  const saved =
    localStorage.getItem(
      ELEMENTS_STORAGE_KEY
    );

  if (!saved) {
    return defaultCircuitModel.elements;
  }

  try {
    const parsed: unknown =
      JSON.parse(
        saved
      );

    if (!Array.isArray(parsed)) {
      return defaultCircuitModel.elements;
    }

    if (parsed.length === 0) {
      return [];
    }

    const migratedElements =
      parsed
        .map(
          migrateElement
        )
        .filter(
          (
            element
          ): element is CircuitElement =>
            element !== null
        );

    if (
      migratedElements.length === 0
    ) {
      return defaultCircuitModel.elements;
    }

    return migratedElements;
  } catch {
    return defaultCircuitModel.elements;
  }
}

export function migrateConnection(
  value: unknown
): CircuitConnection | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  /*
   * Aceita também os campos legados from/to de
   * conexões salvas em versões anteriores.
   */
  const candidate =
    value as Partial<CircuitConnection> & {
      from?: unknown;
      to?: unknown;
    };

  if (typeof candidate.id !== "string") {
    return null;
  }

  const legacyFrom =
    typeof candidate.from === "string"
      ? candidate.from
      : null;

  const legacyTo =
    typeof candidate.to === "string"
      ? candidate.to
      : null;

  /*
   * Conexões salvas antes dos terminais existirem
   * não possuem fromTerminalId/toTerminalId.
   *
   * Convenção do modelo padrão: o fio sai do
   * terminal direito de "from" e chega ao terminal
   * esquerdo de "to" (ex.: V1:right -> R1:left).
   */
  const fromTerminalId =
    typeof candidate.fromTerminalId === "string"
      ? candidate.fromTerminalId
      : legacyFrom !== null
        ? `${legacyFrom}:right`
        : null;

  const toTerminalId =
    typeof candidate.toTerminalId === "string"
      ? candidate.toTerminalId
      : legacyTo !== null
        ? `${legacyTo}:left`
        : null;

  if (
    fromTerminalId === null ||
    toTerminalId === null
  ) {
    return null;
  }

  return {
    id: candidate.id,
    fromTerminalId,
    toTerminalId,
  };
}

export function loadConnections(
  elements: CircuitElement[]
): CircuitConnection[] {
  const saved =
    localStorage.getItem(
      CONNECTIONS_STORAGE_KEY
    );

  if (!saved) {
    return defaultCircuitModel.connections;
  }

  try {
    const parsed: unknown =
      JSON.parse(
        saved
      );

    if (!Array.isArray(parsed)) {
      return defaultCircuitModel.connections;
    }

    if (parsed.length === 0) {
      return [];
    }

    /*
     * Descarta conexões órfãs: aquelas cujos
     * terminais não existem mais nos elementos.
     */
    const validTerminalIds =
      new Set(
        elements.flatMap(
          (element) =>
            element.terminals.map(
              (terminal) =>
                terminal.id
            )
        )
      );

    return parsed
      .map(
        migrateConnection
      )
      .filter(
        (
          connection
        ): connection is CircuitConnection =>
          connection !== null &&
          validTerminalIds.has(
            connection.fromTerminalId
          ) &&
          validTerminalIds.has(
            connection.toTerminalId
          )
      );
  } catch {
    return defaultCircuitModel.connections;
  }
}

export function saveElements(
  elements: CircuitElement[]
): void {
  localStorage.setItem(
    ELEMENTS_STORAGE_KEY,
    JSON.stringify(
      elements
    )
  );
}

export function saveConnections(
  connections: CircuitConnection[]
): void {
  localStorage.setItem(
    CONNECTIONS_STORAGE_KEY,
    JSON.stringify(
      connections
    )
  );
}

export function clearStoredCircuit(): void {
  localStorage.removeItem(
    ELEMENTS_STORAGE_KEY
  );

  localStorage.removeItem(
    CONNECTIONS_STORAGE_KEY
  );
}
