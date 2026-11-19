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

/*
 * Circuitos arbitrários (nem série nem paralelo simples).
 *
 * 1) Ponte de Wheatstone desbalanceada, 100 V:
 *    R1 = 100 (A–B), R2 = 200 (A–C), R3 = 300 (B–GND),
 *    R4 = 400 (C–GND), R5 = 500 (B–C).
 *    Nós (à mão, por análise nodal): VB = 1260/17 = 74,118 V,
 *    VC = 1160/17 = 68,235 V.
 *    I(R5) = (VB − VC)/500 = 0,011765 A
 *    I total = 7,1/17 = 0,41765 A   →   Req = 239,44 Ω
 *
 * 2) Escada RC, 220 V, 60 Hz: R1 = 20 Ω em série com
 *    [C1 = 100 µF ‖ (R2 = 50 Ω + C2 = 50 µF)].
 *    Conferida contra a fórmula de série/paralelo calculada no
 *    próprio teste, com aritmética complexa independente do MNA.
 */

const FREQUENCY = 60;

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

  const source = elements.find(
    (item) => item.type === "source"
  );

  const primary = MnaCircuitResultBuilder.build(
    getCircuitState(elements, connections),
    source?.value ?? 0,
    results
  );

  return { results, primary };
}

function check(
  name: string,
  actual: number,
  expected: number,
  tolerance: number
): void {
  const ok =
    Math.abs(actual - expected) <= tolerance;

  if (!ok) {
    failures++;
  }

  console.log(
    `${ok ? "OK    " : "FALHOU"} ${name}: ` +
      `${actual.toFixed(5)} (esperado ${expected.toFixed(5)})`
  );
}

function magnitudeOf(
  value: { real: number; imaginary: number }
): number {
  return Math.hypot(value.real, value.imaginary);
}

console.log("Topologia arbitrária: ponte de Wheatstone");

{
  const elements = [
    element("V1", "source", 100),
    element("R1", "resistor", 100),
    element("R2", "resistor", 200),
    element("R3", "resistor", 300),
    element("R4", "resistor", 400),
    element("R5", "resistor", 500),
  ];

  const connections = [
    wire("V1:right", "R1:left"),
    wire("V1:right", "R2:left"),
    wire("R1:right", "R3:left"),
    wire("R1:right", "R5:left"),
    wire("R2:right", "R4:left"),
    wire("R2:right", "R5:right"),
    wire("R3:right", "V1:left"),
    wire("R4:right", "V1:left"),
  ];

  const { results, primary } = solve(
    elements,
    connections
  );

  check("solução disponível", results.available ? 1 : 0, 1, 0);

  const current = (id: string) =>
    magnitudeOf(
      results.elementResults.find(
        (item) => item.elementId === id
      )!.current
    );

  const voltage = (id: string) =>
    magnitudeOf(
      results.elementResults.find(
        (item) => item.elementId === id
      )!.voltage
    );

  check("I(R5) ponte (A)", current("R5"), 0.011765, 1e-5);
  check("V(R3) = VB (V)", voltage("R3"), 74.1176, 1e-3);
  check("V(R4) = VC (V)", voltage("R4"), 68.2353, 1e-3);
  check("I(R1) (A)", current("R1"), 0.258824, 1e-5);
  check("I(R2) (A)", current("R2"), 0.158824, 1e-5);
  check("Req (Ω)", primary.result.zeq.real, 239.437, 1e-2);
  check("corrente total (A)", primary.result.current.real, 0.417647, 1e-5);
}

console.log("Topologia arbitrária: escada RC");

{
  const elements = [
    element("V1", "source", 220),
    element("R1", "resistor", 20),
    element("C1", "capacitor", 100e-6),
    element("R2", "resistor", 50),
    element("C2", "capacitor", 50e-6),
  ];

  /*
   * V1:right → R1 → nó M; M → C1 → GND; M → R2 → C2 → GND.
   * R2:right e C2:left se ligam; C1:right, C2:right e
   * V1:left são o nó de referência.
   */
  const connections = [
    wire("V1:right", "R1:left"),
    wire("R1:right", "C1:left"),
    wire("R1:right", "R2:left"),
    wire("R2:right", "C2:left"),
    wire("C1:right", "V1:left"),
    wire("C2:right", "V1:left"),
  ];

  const { primary } = solve(elements, connections);

  /* Referência independente: série/paralelo com complexos. */
  const omega = 2 * Math.PI * FREQUENCY;

  const zc1 = { re: 0, im: -1 / (omega * 100e-6) };

  const zbranch = {
    re: 50,
    im: -1 / (omega * 50e-6),
  };

  const mul = (
    a: { re: number; im: number },
    b: { re: number; im: number }
  ) => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  });

  const div = (
    a: { re: number; im: number },
    b: { re: number; im: number }
  ) => {
    const d = b.re * b.re + b.im * b.im;

    return {
      re: (a.re * b.re + a.im * b.im) / d,
      im: (a.im * b.re - a.re * b.im) / d,
    };
  };

  const parallel = div(
    mul(zc1, zbranch),
    { re: zc1.re + zbranch.re, im: zc1.im + zbranch.im }
  );

  const zeq = { re: 20 + parallel.re, im: parallel.im };

  check("Zeq real (Ω)", primary.result.zeq.real, zeq.re, 1e-6);
  check("Zeq imag (Ω)", primary.result.zeq.imag, zeq.im, 1e-6);

  const zeqMagnitude = Math.hypot(zeq.re, zeq.im);

  check(
    "|I| = 220/|Zeq| (A)",
    magnitudeOf(primary.sourceCurrent),
    220 / zeqMagnitude,
    1e-6
  );
}

console.log(
  failures === 0
    ? "Topologias arbitrárias: todos os testes passaram."
    : `Topologias arbitrárias: ${failures} FALHA(S).`
);
