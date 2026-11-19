import type {
  CircuitElement,
  CircuitElementType,
} from "../core/CircuitElement";

import type {
  CircuitConnection,
} from "../core/CircuitConnection";

import {
  createCircuitTerminals,
} from "../core/CircuitTerminal";

import {
  getCircuitState,
} from "../solver/CircuitTopology";

import {
  CircuitGraphBuilder,
} from "../solver/CircuitGraphBuilder";

import {
  ModifiedNodalAnalysisBuilder,
} from "../solver/ModifiedNodalAnalysisBuilder";

import {
  ComplexLinearSolver,
} from "../solver/ComplexLinearSolver";

import {
  MnaElectricalResultsExtractor,
} from "../solver/MnaElectricalResultsExtractor";

import {
  MnaCircuitResultBuilder,
} from "../solver/MnaCircuitResultBuilder";

/*
 * Valida o CircuitGraph e o solver MNA contra valores
 * calculados à mão para circuitos série, paralelo e misto.
 */

const TOLERANCE = 1e-3;

function element(
  id: string,
  type: CircuitElementType,
  value: number
): CircuitElement {
  return {
    id,
    type,
    label: id,
    value,
    x: 0,
    y: 0,
    terminals: createCircuitTerminals(id),
  };
}

function wire(
  fromTerminalId: string,
  toTerminalId: string
): CircuitConnection {
  return {
    id: `${fromTerminalId}~${toTerminalId}`,
    fromTerminalId,
    toTerminalId,
  };
}

interface Expectation {
  available: boolean;
  current?: number;
  impedance?: number;
}

let failures = 0;

function runCase(
  name: string,
  elements: CircuitElement[],
  connections: CircuitConnection[],
  frequency: number,
  expected: Expectation
): void {
  const state =
    getCircuitState(elements, connections);

  const graph =
    CircuitGraphBuilder.build(
      elements,
      connections
    );

  const mna =
    ModifiedNodalAnalysisBuilder.build(
      graph,
      elements,
      frequency
    );

  const solution =
    ComplexLinearSolver.solve(
      mna.matrix.map((row) => row.values),
      mna.rightHandSide
    );

  const results =
    MnaElectricalResultsExtractor.extract(
      graph,
      elements,
      mna,
      solution,
      frequency
    );

  const source =
    elements.find(
      (item) => item.type === "source"
    );

  const output =
    MnaCircuitResultBuilder.build(
      state,
      source?.value ?? 0,
      results
    );

  const current =
    Math.hypot(
      output.result.current.real,
      output.result.current.imag
    );

  const impedance =
    Math.hypot(
      output.equivalentImpedance.real,
      output.equivalentImpedance.imaginary
    );

  let passed =
    output.available === expected.available;

  if (
    expected.current !== undefined &&
    Math.abs(current - expected.current) > TOLERANCE
  ) {
    passed = false;
  }

  if (
    expected.impedance !== undefined &&
    Math.abs(impedance - expected.impedance) > TOLERANCE
  ) {
    passed = false;
  }

  if (!passed) {
    failures += 1;
  }

  const log = passed ? console.log : console.error;

  log(
    `${passed ? "OK    " : "FALHOU"} ${name} | estado=${state}` +
      (output.available
        ? ` | |I|=${current.toFixed(4)} A | |Zeq|=${impedance.toFixed(4)} Ω`
        : ` | ${output.errorMessage ?? "indisponível"}`)
  );
}

console.log("==== TESTE MNA TOPOLOGIAS ====");

const source = () => element("V1", "source", 220);

const omegaL = 2 * Math.PI * 60 * 0.1;

const omegaC = 2 * Math.PI * 60 * 100e-6;

const admittanceRC = Math.hypot(0.01, omegaC);

runCase(
  "Série V1, R1 (100 Ω)",
  [source(), element("R1", "resistor", 100)],
  [wire("V1:right", "R1:left"), wire("R1:right", "V1:left")],
  60,
  { available: true, current: 2.2, impedance: 100 }
);

runCase(
  "Paralelo R1 || R2 (100 || 100)",
  [
    source(),
    element("R1", "resistor", 100),
    element("R2", "resistor", 100),
  ],
  [
    wire("V1:right", "R1:left"),
    wire("R1:left", "R2:left"),
    wire("R1:right", "V1:left"),
    wire("R2:right", "R1:right"),
  ],
  60,
  { available: true, current: 4.4, impedance: 50 }
);

runCase(
  "Misto R1 + (R2 || R3), 100 + (200 || 200)",
  [
    source(),
    element("R1", "resistor", 100),
    element("R2", "resistor", 200),
    element("R3", "resistor", 200),
  ],
  [
    wire("V1:right", "R1:left"),
    wire("R1:right", "R2:left"),
    wire("R2:left", "R3:left"),
    wire("R2:right", "V1:left"),
    wire("R3:right", "R2:right"),
  ],
  60,
  { available: true, current: 1.1, impedance: 200 }
);

runCase(
  "Paralelo R1 (100 Ω) || C1 (100 µF) a 60 Hz",
  [
    source(),
    element("R1", "resistor", 100),
    element("C1", "capacitor", 100e-6),
  ],
  [
    wire("V1:right", "R1:left"),
    wire("R1:left", "C1:left"),
    wire("R1:right", "V1:left"),
    wire("C1:right", "R1:right"),
  ],
  60,
  {
    available: true,
    current: 220 * admittanceRC,
    impedance: 1 / admittanceRC,
  }
);

runCase(
  "R1 desviado por fio, com L1 (100 mH) a 60 Hz",
  [
    source(),
    element("R1", "resistor", 100),
    element("L1", "inductor", 0.1),
  ],
  [
    wire("V1:right", "R1:left"),
    wire("R1:left", "R1:right"),
    wire("R1:right", "L1:left"),
    wire("L1:right", "V1:left"),
  ],
  60,
  { available: true, current: 220 / omegaL, impedance: omegaL }
);

runCase(
  "R2 com um terminal solto + R1 em série",
  [
    source(),
    element("R1", "resistor", 100),
    element("R2", "resistor", 50),
  ],
  [
    wire("V1:right", "R1:left"),
    wire("R1:right", "V1:left"),
    wire("V1:right", "R2:left"),
  ],
  60,
  { available: true, current: 2.2, impedance: 100 }
);

runCase(
  "Curto direto na fonte",
  [source(), element("R1", "resistor", 100)],
  [wire("V1:right", "V1:left")],
  60,
  { available: false }
);

runCase(
  "Circuito aberto (falta o fio de retorno)",
  [source(), element("R1", "resistor", 100)],
  [wire("V1:right", "R1:left")],
  60,
  { available: false }
);

console.log(
  failures === 0
    ? "Resumo: todos os casos passaram."
    : `Resumo: ${failures} caso(s) falharam.`
);
