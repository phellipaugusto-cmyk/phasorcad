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

import {
  getCircuitState,
} from "../solver/CircuitTopology";

import {
  buildPhasorEntries,
  type PhasorQuantity,
} from "../components/PhasorDiagram/phasorDiagramData";

/*
 * Fonte de corrente ideal (60 Hz), conferida com cálculo à mão.
 *
 * Série: I = 2 A ∠0°, R = 50 Ω, L = 100 mH (XL = 37,699 Ω)
 *   VR = 100 V ∠0°           VL = 75,398 V ∠90°
 *   Vfonte = 100 + j75,398 = 125,24 V ∠37,02°
 *   Zeq = 50 + j37,699 Ω
 *
 * Paralelo: I = 3 A ∠0°, R = 100 Ω ‖ C = 100 µF (XC = 26,526 Ω)
 *   Y = 0,01 + j0,037699 S  |Y| = 0,039002 S
 *   V = 76,92 V ∠-75,14°
 *   IR = 0,7692 A ∠-75,14°   IC = 2,8999 A ∠14,86°
 */

const TOLERANCE = 0.02;

let failures = 0;

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

function solve(
  elements: CircuitElement[],
  connections: CircuitConnection[]
) {
  const graph =
    CircuitGraphBuilder.build(
      elements,
      connections
    );

  const mna =
    ModifiedNodalAnalysisBuilder.build(
      graph,
      elements,
      60
    );

  const solution =
    ComplexLinearSolver.solve(
      mna.matrix.map((row) => row.values),
      mna.rightHandSide
    );

  return MnaElectricalResultsExtractor.extract(
    graph,
    elements,
    mna,
    solution,
    60
  );
}

function check(
  name: string,
  actual: number,
  expected: number
): void {
  const ok =
    Math.abs(actual - expected) <=
    TOLERANCE;

  if (!ok) {
    failures++;
  }

  console.log(
    `${ok ? "OK    " : "FALHOU"} ${name}: ` +
      `${actual.toFixed(3)} (esperado ${expected})`
  );
}

function entry(
  results: ReturnType<typeof solve>,
  elements: CircuitElement[],
  quantity: PhasorQuantity,
  id: string
) {
  const found = buildPhasorEntries(
    results,
    elements,
    quantity
  ).find((item) => item.elementId === id);

  if (!found) {
    failures++;
    console.log(`FALHOU fasor ${quantity} de ${id} não encontrado`);

    return { magnitude: NaN, angleDegrees: NaN };
  }

  return found;
}

console.log(
  "Fonte de corrente: série I=2 A, R=50 Ω, L=100 mH"
);

{
  const elements = [
    element("I1", "currentSource", 2),
    element("R1", "resistor", 50),
    element("L1", "inductor", 0.1),
  ];

  const connections = [
    wire("I1:right", "R1:left"),
    wire("R1:right", "L1:left"),
    wire("L1:right", "I1:left"),
  ];

  check(
    "estado fechado",
    getCircuitState(elements, connections) === "closed"
      ? 1
      : 0,
    1
  );

  const results = solve(elements, connections);

  check("solução disponível", results.available ? 1 : 0, 1);

  const vr = entry(results, elements, "voltage", "R1");
  const vl = entry(results, elements, "voltage", "L1");
  const vs = entry(results, elements, "voltage", "I1");
  const is = entry(results, elements, "current", "I1");

  check("|VR| (V)", vr.magnitude, 100);
  check("∠VR (°)", vr.angleDegrees, 0);
  check("|VL| (V)", vl.magnitude, 75.398);
  check("∠VL (°)", vl.angleDegrees, 90);
  check("|V fonte| (V)", vs.magnitude, 125.239);
  check("∠V fonte (°)", vs.angleDegrees, 37.0);
  check("|I fonte| (A)", is.magnitude, 2);
  check("∠I fonte (°)", is.angleDegrees, 0);

  const primary = MnaCircuitResultBuilder.build(
    "closed",
    0,
    results
  );

  check("Zeq real (Ω)", primary.result.zeq.real, 50);
  check("Zeq imag (Ω)", primary.result.zeq.imag, 37.699);
  check("corrente real (A)", primary.result.current.real, 2);
  check("P (W)", primary.result.activePower, 200);
  check("Q (var)", primary.result.reactivePower, 150.796);
}

console.log(
  "Fonte de corrente: paralelo I=3 A, R=100 Ω ‖ C=100 µF"
);

{
  const elements = [
    element("I1", "currentSource", 3),
    element("R1", "resistor", 100),
    element("C1", "capacitor", 100 / 1_000_000),
  ];

  const connections = [
    wire("I1:right", "R1:left"),
    wire("I1:right", "C1:left"),
    wire("R1:right", "I1:left"),
    wire("C1:right", "I1:left"),
  ];

  const results = solve(elements, connections);

  const v = entry(results, elements, "voltage", "I1");
  const ir = entry(results, elements, "current", "R1");
  const ic = entry(results, elements, "current", "C1");
  const is = entry(results, elements, "current", "I1");

  check("|V| (V)", v.magnitude, 76.92);
  check("∠V (°)", v.angleDegrees, -75.14);
  check("|IR| (A)", ir.magnitude, 0.7692);
  check("∠IR (°)", ir.angleDegrees, -75.14);
  check("|IC| (A)", ic.magnitude, 2.8999);
  check("∠IC (°)", ic.angleDegrees, 14.86);
  check("|I fonte| (A)", is.magnitude, 3);
  check("∠I fonte (°)", is.angleDegrees, 0);
}

console.log("Fonte de corrente: circuito aberto");

{
  const elements = [
    element("I1", "currentSource", 2),
    element("R1", "resistor", 50),
  ];

  const connections = [
    wire("I1:right", "R1:left"),
  ];

  check(
    "estado aberto",
    getCircuitState(elements, connections) === "open"
      ? 1
      : 0,
    1
  );
}

console.log(
  failures === 0
    ? "Fonte de corrente: todos os testes passaram."
    : `Fonte de corrente: ${failures} FALHA(S).`
);
