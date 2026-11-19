import type { CircuitElement } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import { isCoilEnergized } from "../core/contactorModel";
import { CircuitGraphBuilder } from "./CircuitGraphBuilder";
import { ModifiedNodalAnalysisBuilder } from "./ModifiedNodalAnalysisBuilder";
import { ComplexLinearSolver } from "./ComplexLinearSolver";
import { MnaElectricalResultsExtractor } from "./MnaElectricalResultsExtractor";
import { getCircuitState } from "./CircuitTopology";

/*
 * Contatos comandados por bobinas de contator.
 *
 * O estado dos contatos depende da tensão nas bobinas, e a tensão
 * nas bobinas depende dos contatos (ex.: um contato auxiliar que
 * alimenta outra bobina). Por isso a solução é iterativa:
 *
 *   1. parte do estado anterior das bobinas (memória);
 *   2. ajusta os contatos (NA fecha / NF abre com bobina energizada);
 *   3. resolve o circuito e mede a tensão de cada bobina;
 *   4. repete até as bobinas não mudarem de estado.
 *
 * Se o estado oscilar (ex.: bobina alimentada pelo próprio NF, que
 * na prática "chia"), o resultado fica marcado como não convergido.
 */

export interface CoilState {
  voltage: number;
  energized: boolean;
}

export interface ContactorResolution {
  elements: CircuitElement[];
  coilStates: Record<string, CoilState>;
  converged: boolean;
  iterations: number;
}

const MAX_ITERATIONS = 12;

export function isControlledContact(
  element: CircuitElement,
  elements: CircuitElement[]
): boolean {
  return (
    element.type === "switch" &&
    element.controlledBy !== undefined &&
    elements.some(
      (other) =>
        other.id === element.controlledBy && other.type === "contactor"
    )
  );
}

/* Botoeira manual: NA fecha só pressionada; NF abre só pressionada. */
function applyPushButtons(elements: CircuitElement[]): CircuitElement[] {
  return elements.map((element) => {
    if (
      element.type !== "switch" ||
      !element.momentary ||
      isControlledContact(element, elements)
    ) {
      return element;
    }

    const pressed = element.pressed === true;
    const closed = element.normallyClosed ? !pressed : pressed;

    return element.closed === closed ? element : { ...element, closed };
  });
}

function applyCoilStates(
  elements: CircuitElement[],
  energized: Record<string, boolean>
): CircuitElement[] {
  return elements.map((element) => {
    if (element.type === "contactor") {
      const on = energized[element.id] === true;

      return element.energized === on ? element : { ...element, energized: on };
    }

    if (!isControlledContact(element, elements)) {
      return element;
    }

    const on = energized[element.controlledBy as string] === true;
    const closed = element.normallyClosed ? !on : on;

    return element.closed === closed ? element : { ...element, closed };
  });
}

function measureCoils(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  frequency: number
): Record<string, CoilState> | null {
  if (getCircuitState(elements, connections) === "short") {
    return null;
  }

  try {
    const graph = CircuitGraphBuilder.build(elements, connections);
    const mna = ModifiedNodalAnalysisBuilder.build(graph, elements, frequency);
    const solution = ComplexLinearSolver.solve(
      mna.matrix.map((row) => row.values),
      mna.rightHandSide
    );
    const results = MnaElectricalResultsExtractor.extract(
      graph,
      elements,
      mna,
      solution,
      frequency
    );

    if (!results.available) {
      return null;
    }

    const states: Record<string, CoilState> = {};

    elements.forEach((element) => {
      if (element.type !== "contactor") {
        return;
      }

      const result = results.elementResults.find(
        (item) => item.elementId === element.id
      );
      const voltage = result
        ? Math.hypot(result.voltage.real, result.voltage.imaginary)
        : 0;

      states[element.id] = {
        voltage,
        energized: isCoilEnergized(element, voltage),
      };
    });

    return states;
  } catch {
    return null;
  }
}

export function resolveContactors(
  input: CircuitElement[],
  connections: CircuitConnection[],
  frequency: number
): ContactorResolution {
  const elements = applyPushButtons(input);
  const hasCoil = elements.some((element) => element.type === "contactor");

  if (!hasCoil) {
    return { elements, coilStates: {}, converged: true, iterations: 0 };
  }

  /*
   * Parte do estado em que as bobinas estavam (memória). Sem isso,
   * um contato de selo nunca seguraria o contator.
   */
  let energized: Record<string, boolean> = {};
  elements.forEach((element) => {
    if (element.type === "contactor" && element.energized) {
      energized[element.id] = true;
    }
  });
  let current = applyCoilStates(elements, energized);
  let coilStates: Record<string, CoilState> = {};

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    const measured = measureCoils(current, connections, frequency);

    if (!measured) {
      return { elements: current, coilStates, converged: false, iterations: iteration };
    }

    coilStates = measured;

    const next: Record<string, boolean> = {};
    Object.entries(measured).forEach(([id, state]) => {
      next[id] = state.energized;
    });

    const changed = Object.keys(next).some(
      (id) => (energized[id] === true) !== next[id]
    );

    if (!changed) {
      return { elements: current, coilStates, converged: true, iterations: iteration };
    }

    energized = next;
    current = applyCoilStates(elements, energized);
  }

  return { elements: current, coilStates, converged: false, iterations: MAX_ITERATIONS };
}
