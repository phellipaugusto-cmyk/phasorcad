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
} from "../components/PhasorDiagram/phasorDiagramData";

/*
 * Várias fontes e ângulo de fase, conferidos com cálculo à mão.
 *
 * A) Duas fontes de tensão em série com R = 100 Ω:
 *    V1 = 100 V ∠0°, V2 = 100 V ∠90°.
 *    EMF = 100 + j100  →  I = 1 + j1 = 1,4142 A ∠45°
 *    VR = 141,42 V ∠45°, P(R) = |I|²R = 200 W
 *    V1 entrega P = 100 W, Q = -100 var (I* = 1 − j1)
 *    V2 entrega P = 100 W, Q = +100 var
 *
 * B) Fonte de tensão em série com fonte de corrente e R = 10 Ω:
 *    V1 = 10 V, I1 = 2 A  →  a corrente do laço é 2 A
 *    V(R) = 20 V, V(I1) = 20 − 10 = 10 V
 *    V1 entrega 20 W, I1 entrega 20 W, R absorve 40 W
 *
 * C) V1 = 100 V ∠0° em paralelo com I1 = 1 A ∠90° e R = 50 Ω:
 *    corrente do resistor = 2 A; V1 entrega I = 2 − j1 = 2,236 A ∠-26,57°
 *    V1: P = 200 W, Q = +100 var; I1: P = 0, Q = -100 var
 *    soma Q = 0 e P = 200 W = |2|²·50
 *
 * D) Uma só fonte com fase: 220 V ∠30° sobre R = 100 Ω
 *    I = 2,2 A ∠30°, Zeq = 100 Ω ∠0°, P = 484 W
 */

const FREQUENCY = 60;

let failures = 0;

function element(
  id: string,
  type: CircuitElementType,
  value: number,
  phase?: number
): CircuitElement {
  return {
    id,
    type,
    label: id,
    value,
    ...(phase === undefined ? {} : { phase }),
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
  const graph = CircuitGraphBuilder.build(
    elements,
    connections
  );

  const mna = ModifiedNodalAnalysisBuilder.build(
    graph,
    elements,
    FREQUENCY
  );

  const solution = ComplexLinearSolver.solve(
    mna.matrix.map((row) => row.values),
    mna.rightHandSide
  );

  const results =
    MnaElectricalResultsExtractor.extract(
      graph,
      elements,
      mna,
      solution,
      FREQUENCY
    );

  const primary = MnaCircuitResultBuilder.build(
    getCircuitState(elements, connections),
    0,
    results
  );

  return { results, primary };
}

function check(
  name: string,
  actual: number,
  expected: number,
  tolerance = 0.01
): void {
  const ok =
    Math.abs(actual - expected) <= tolerance;

  if (!ok) {
    failures++;
  }

  console.log(
    `${ok ? "OK    " : "FALHOU"} ${name}: ` +
      `${actual.toFixed(4)} (esperado ${expected})`
  );
}

function phasor(
  results: ReturnType<typeof solve>["results"],
  elements: CircuitElement[],
  quantity: "voltage" | "current",
  id: string
) {
  const found = buildPhasorEntries(
    results,
    elements,
    quantity
  ).find((item) => item.elementId === id);

  if (!found) {
    failures++;
    console.log(`FALHOU fasor ${quantity} de ${id} ausente`);

    return { magnitude: NaN, angleDegrees: NaN };
  }

  return found;
}

function delivered(
  results: ReturnType<typeof solve>["results"],
  id: string
) {
  const found = results.elementResults.find(
    (item) => item.elementId === id
  )!;

  return {
    p: -found.complexPower.real,
    q: -found.complexPower.imaginary,
  };
}

console.log("A) Duas fontes de tensão em série (0° e 90°)");

{
  const elements = [
    element("V1", "source", 100, 0),
    element("V2", "source", 100, 90),
    element("R1", "resistor", 100),
  ];

  const connections = [
    wire("V1:right", "V2:left"),
    wire("V2:right", "R1:left"),
    wire("R1:right", "V1:left"),
  ];

  check(
    "estado fechado",
    getCircuitState(elements, connections) ===
      "closed"
      ? 1
      : 0,
    1,
    0
  );

  const { results, primary } = solve(elements, connections);

  const ir = phasor(results, elements, "current", "R1");
  const vr = phasor(results, elements, "voltage", "R1");

  check("|I| (A)", ir.magnitude, 1.4142);
  check("∠I (°)", ir.angleDegrees, 45);
  check("|VR| (V)", vr.magnitude, 141.42);
  check("∠VR (°)", vr.angleDegrees, 45);

  const v1 = delivered(results, "V1");
  const v2 = delivered(results, "V2");

  check("V1 entrega P (W)", v1.p, 100);
  check("V1 entrega Q (var)", v1.q, -100);
  check("V2 entrega P (W)", v2.p, 100);
  check("V2 entrega Q (var)", v2.q, 100);

  check("P total das cargas (W)", primary.result.activePower, 200);
  check("Q total das cargas (var)", primary.result.reactivePower, 0);
  check("fontes contadas", primary.result.sourceCount ?? 0, 2, 0);

  const iv2 = phasor(results, elements, "current", "V2");
  const vv2 = phasor(results, elements, "voltage", "V2");

  check("∠V2 no diagrama (°)", vv2.angleDegrees, 90);
  check("|V2| no diagrama (V)", vv2.magnitude, 100);
  check("∠I de V2 no diagrama (°)", iv2.angleDegrees, 45);
}

console.log("B) Fonte de tensão em série com fonte de corrente");

{
  const elements = [
    element("V1", "source", 10),
    element("I1", "currentSource", 2),
    element("R1", "resistor", 10),
  ];

  const connections = [
    wire("V1:right", "I1:left"),
    wire("I1:right", "R1:left"),
    wire("R1:right", "V1:left"),
  ];

  check(
    "estado fechado",
    getCircuitState(elements, connections) ===
      "closed"
      ? 1
      : 0,
    1,
    0
  );

  const { results } = solve(elements, connections);

  const vr = phasor(results, elements, "voltage", "R1");
  const vi = phasor(results, elements, "voltage", "I1");

  check("|VR| (V)", vr.magnitude, 20);
  check("|V(I1)| (V)", vi.magnitude, 10);
  check("V1 entrega (W)", delivered(results, "V1").p, 20);
  check("I1 entrega (W)", delivered(results, "I1").p, 20);
}

console.log("C) Fonte de tensão em paralelo com fonte de corrente defasada");

{
  const elements = [
    element("V1", "source", 100, 0),
    element("I1", "currentSource", 1, 90),
    element("R1", "resistor", 50),
  ];

  const connections = [
    wire("V1:right", "R1:left"),
    wire("V1:right", "I1:right"),
    wire("R1:right", "V1:left"),
    wire("I1:left", "V1:left"),
  ];

  const { results, primary } = solve(elements, connections);

  const iv1 = phasor(results, elements, "current", "V1");

  check("|I| entregue por V1 (A)", iv1.magnitude, 2.2361);
  check("∠I entregue por V1 (°)", iv1.angleDegrees, -26.565);

  const v1 = delivered(results, "V1");
  const i1 = delivered(results, "I1");

  check("V1 entrega P (W)", v1.p, 200);
  check("V1 entrega Q (var)", v1.q, 100);
  check("I1 entrega P (W)", i1.p, 0);
  check("I1 entrega Q (var)", i1.q, -100);
  check("P das cargas (W)", primary.result.activePower, 200);
  check("Q das cargas (var)", primary.result.reactivePower, 0);

  const ii = phasor(results, elements, "current", "I1");

  check("|I1| no diagrama (A)", ii.magnitude, 1);
  check("∠I1 no diagrama (°)", ii.angleDegrees, 90);
}

console.log("D) Uma fonte com fase 30°");

{
  const elements = [
    element("V1", "source", 220, 30),
    element("R1", "resistor", 100),
  ];

  const connections = [
    wire("V1:right", "R1:left"),
    wire("R1:right", "V1:left"),
  ];

  const { results, primary } = solve(elements, connections);

  check("Zeq real (Ω)", primary.result.zeq.real, 100);
  check("Zeq imag (Ω)", primary.result.zeq.imag, 0);
  check("P (W)", primary.result.activePower, 484);
  check("fontes contadas", primary.result.sourceCount ?? 0, 1, 0);

  const v = phasor(results, elements, "voltage", "V1");
  const i = phasor(results, elements, "current", "V1");

  check("|V| (V)", v.magnitude, 220);
  check("∠V (°)", v.angleDegrees, 30);
  check("|I| (A)", i.magnitude, 2.2);
  check("∠I (°)", i.angleDegrees, 30);
}

console.log("Sem fase informada, a fonte fica em 0°");

{
  const elements = [
    element("V1", "source", 220),
    element("R1", "resistor", 100),
  ];

  const connections = [
    wire("V1:right", "R1:left"),
    wire("R1:right", "V1:left"),
  ];

  const { results } = solve(elements, connections);

  check(
    "∠V sem fase (°)",
    phasor(results, elements, "voltage", "V1").angleDegrees,
    0
  );
}

console.log(
  failures === 0
    ? "Várias fontes: todos os testes passaram."
    : `Várias fontes: ${failures} FALHA(S).`
);
