import type {
  CircuitElement,
} from "../../core/CircuitElement";

import type {
  CircuitConnection,
} from "../../core/CircuitConnection";

import {
  CircuitGraphBuilder,
} from "../../solver/CircuitGraphBuilder";

import {
  ModifiedNodalAnalysisBuilder,
} from "../../solver/ModifiedNodalAnalysisBuilder";

import {
  ComplexLinearSolver,
} from "../../solver/ComplexLinearSolver";

import {
  MnaElectricalResultsExtractor,
} from "../../solver/MnaElectricalResultsExtractor";

import {
  MnaCircuitResultBuilder,
} from "../../solver/MnaCircuitResultBuilder";

import {
  getCircuitState,
} from "../../solver/CircuitTopology";

export interface SweepPoint {
  /* Frequência em Hz. */
  frequency: number;

  /* Impedância vista pela fonte. */
  zeqMagnitude: number;

  zeqPhaseDegrees: number;

  /*
   * Grandeza da fonte: corrente (A) numa fonte de tensão;
   * tensão (V) numa fonte de corrente.
   */
  sourceMagnitude: number;

  /* Módulo (eficaz) da tensão e da corrente de cada componente. */
  voltageByElement: Record<string, number>;

  currentByElement: Record<string, number>;
}

export interface FrequencySweep {
  points: SweepPoint[];

  /*
   * Primeira frequência em que a fase de Zeq cruza zero
   * (ressonância), interpolada em escala logarítmica.
   */
  resonanceHz: number | null;

  /* "current" se a fonte é de tensão; "voltage" se for de corrente. */
  sourceQuantity: "current" | "voltage";
}

export const SWEEP_MIN_HZ = 0.1;

export const SWEEP_MAX_HZ = 1_000_000;

const MIN_SPAN_RATIO = 1.01;

const MAGNITUDE_FLOOR = 1e-12;

/*
 * Resolve o circuito em frequências espaçadas
 * logaritmicamente entre minHz e maxHz.
 * Retorna null se o circuito não estiver fechado, se não
 * tiver exatamente uma fonte ou se a faixa for inválida.
 */
export function computeFrequencySweep(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  minHz: number,
  maxHz: number,
  pointsPerDecade = 40
): FrequencySweep | null {
  if (
    !Number.isFinite(minHz) ||
    !Number.isFinite(maxHz) ||
    minHz < SWEEP_MIN_HZ ||
    maxHz > SWEEP_MAX_HZ ||
    maxHz < minHz * MIN_SPAN_RATIO
  ) {
    return null;
  }

  const circuitState = getCircuitState(
    elements,
    connections
  );

  if (circuitState !== "closed") {
    return null;
  }

  /*
   * A resposta mostra Zeq e as grandezas da fonte; isso só é
   * definido com uma única fonte. Com várias, retorna null.
   */
  const sources = elements.filter(
    (element) =>
      element.type === "source" ||
      element.type === "currentSource"
  );

  if (sources.length !== 1) {
    return null;
  }

  const source = sources[0];

  const graph = CircuitGraphBuilder.build(
    elements,
    connections
  );

  const voltageSourceValue =
    source.type === "source"
      ? source.value
      : 0;

  const decades = Math.log10(maxHz / minHz);

  const steps = Math.max(
    2,
    Math.ceil(decades * pointsPerDecade)
  );

  const points: SweepPoint[] = [];

  for (let index = 0; index <= steps; index++) {
    const frequency =
      minHz *
      Math.pow(10, (decades * index) / steps);

    const mna =
      ModifiedNodalAnalysisBuilder.build(
        graph,
        elements,
        frequency
      );

    const solution = ComplexLinearSolver.solve(
      mna.matrix.map((row) => row.values),
      mna.rightHandSide
    );

    const electrical =
      MnaElectricalResultsExtractor.extract(
        graph,
        elements,
        mna,
        solution,
        frequency
      );

    const primary = MnaCircuitResultBuilder.build(
      circuitState,
      voltageSourceValue,
      electrical
    );

    if (!primary.available) {
      continue;
    }

    const voltageByElement: Record<string, number> =
      {};

    const currentByElement: Record<string, number> =
      {};

    electrical.elementResults.forEach((result) => {
      voltageByElement[result.elementId] =
        Math.hypot(
          result.voltage.real,
          result.voltage.imaginary
        );

      currentByElement[result.elementId] =
        Math.hypot(
          result.current.real,
          result.current.imaginary
        );
    });

    const zeq = primary.result.zeq;

    const zeqMagnitude = Math.hypot(
      zeq.real,
      zeq.imag
    );

    points.push({
      frequency,
      zeqMagnitude,
      zeqPhaseDegrees:
        zeqMagnitude < MAGNITUDE_FLOOR
          ? 0
          : (Math.atan2(zeq.imag, zeq.real) *
              180) /
            Math.PI,
      sourceMagnitude:
        source.type === "source"
          ? Math.hypot(
              primary.sourceCurrent.real,
              primary.sourceCurrent.imaginary
            )
          : Math.hypot(
              primary.result.zeq.real *
                source.value,
              primary.result.zeq.imag *
                source.value
            ),
      voltageByElement,
      currentByElement,
    });
  }

  if (points.length < 2) {
    return null;
  }

  return {
    points,
    resonanceHz: findResonance(points),
    sourceQuantity:
      source.type === "source"
        ? "current"
        : "voltage",
  };
}

function findResonance(
  points: SweepPoint[]
): number | null {
  for (let index = 1; index < points.length; index++) {
    const before = points[index - 1];

    const after = points[index];

    const a = before.zeqPhaseDegrees;

    const b = after.zeqPhaseDegrees;

    /* Cruzamento real de sinal, ignorando ruído em torno de zero. */
    if (
      (a < -1e-6 && b > 1e-6) ||
      (a > 1e-6 && b < -1e-6)
    ) {
      const ratio = a / (a - b);

      const logFrequency =
        Math.log10(before.frequency) +
        ratio *
          (Math.log10(after.frequency) -
            Math.log10(before.frequency));

      return Math.pow(10, logFrequency);
    }
  }

  return null;
}
