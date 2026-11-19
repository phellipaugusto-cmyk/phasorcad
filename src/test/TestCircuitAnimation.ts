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
  FLOW_MAX_OFFSET,
  buildAnimationModel,
  colorForVoltage,
  getAnimationFrame,
} from "../components/Canvas/circuitAnimation";

/*
 * Animação do Canvas, conferida com cálculo à mão num RL série
 * (220 V, R = 100 Ω, L = 100 mH, 60 Hz):
 *   nó da fonte: 220 V ∠0° (pico 311,13 V)
 *   I = 2,0585 A ∠-20,66° (pico 2,911 A), a mesma em todos os
 *   componentes.
 * Em φ = 0 a tensão do nó da fonte é máxima e positiva; em
 * φ = π é máxima e negativa. O deslocamento dos pontos é
 * proporcional a sen(φ + θ).
 */

let failures = 0;

function expect(
  name: string,
  condition: boolean
): void {
  if (!condition) {
    failures++;
  }

  console.log(
    `${condition ? "OK    " : "FALHOU"} ${name}`
  );
}

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

function parse(color: string): number[] {
  return (
    color.match(/\d+/g) ?? []
  ).map(Number);
}

const elements = [
  element("V1", "source", 220),
  element("R1", "resistor", 100),
  element("L1", "inductor", 0.1),
];

const connections = [
  wire("V1:right", "R1:left"),
  wire("R1:right", "L1:left"),
  wire("L1:right", "V1:left"),
];

const graph = CircuitGraphBuilder.build(
  elements,
  connections
);

const mna = ModifiedNodalAnalysisBuilder.build(
  graph,
  elements,
  60
);

const solution = ComplexLinearSolver.solve(
  mna.matrix.map((row) => row.values),
  mna.rightHandSide
);

const results = MnaElectricalResultsExtractor.extract(
  graph,
  elements,
  mna,
  solution,
  60
);

console.log("Animação do Canvas");

const model = buildAnimationModel(graph, results, elements, connections);

expect("modelo disponível", model !== null);

if (model) {
  expect(
    "pico de tensão = 311,13 V",
    Math.abs(model.maxVoltagePeak - 311.13) < 0.05
  );

  expect(
    "pico de corrente = 2,911 A",
    Math.abs(model.maxCurrentPeak - 2.911) < 0.005
  );

  const atZero = getAnimationFrame(model, 0);
  const atPi = getAnimationFrame(model, Math.PI);

  const positive = parse(atZero.terminalColor["V1:right"]);
  const negative = parse(atPi.terminalColor["V1:right"]);

  expect(
    "φ=0: fio da fonte fica verde (G > R)",
    positive[1] > positive[0]
  );

  expect(
    "φ=π: fio da fonte fica vermelho (R > G)",
    negative[0] > negative[1]
  );

  expect(
    "terminal de referência (GND) fica cinza",
    atZero.terminalColor["V1:left"] ===
      "rgb(156, 163, 175)"
  );

  /*
   * Corrente em fase 0: sen(0 + (-20,66°)) < 0, logo os pontos
   * estão deslocados para a esquerda; em φ = 20,66° + 90° o
   * deslocamento é o máximo, para a direita.
   */
  const lagging = (20.66 * Math.PI) / 180;

  const flowAtZero = atZero.flow["R1"];

  expect(
    "corrente atrasada: deslocamento negativo em φ=0",
    flowAtZero.offset < 0
  );

  const maxFrame = getAnimationFrame(
    model,
    lagging + Math.PI / 2
  );

  expect(
    "deslocamento máximo = amplitude (18 px)",
    Math.abs(maxFrame.flow["R1"].offset - FLOW_MAX_OFFSET) <
      0.01
  );

  expect(
    "mesma corrente em série: R1 e L1 andam juntos",
    Math.abs(
      maxFrame.flow["R1"].offset -
        maxFrame.flow["L1"].offset
    ) < 1e-9
  );

  expect(
    "a fonte entrega no mesmo sentido do circuito",
    Math.abs(
      maxFrame.flow["V1"].offset -
        maxFrame.flow["R1"].offset
    ) < 1e-9
  );

  const wires = getAnimationFrame(model, lagging + Math.PI / 2).wireFlow;

  expect(
    "série: todos os fios andam como o resistor",
    connections.every(
      (c) =>
        Math.abs(wires[c.id].offset - FLOW_MAX_OFFSET) < 0.01
    )
  );
}

/*
 * Paralelo: V1 alimenta R1 e R2 (100 Ω e 200 Ω).
 * I1 = 2,2 A, I2 = 1,1 A; o fio da fonte leva 3,3 A (soma) e
 * o ramo de R2 leva a metade do de R1.
 */
{
  const els = [
    element("V1", "source", 220),
    element("R1", "resistor", 100),
    element("R2", "resistor", 200),
  ];

  const cons = [
    wire("V1:right", "R1:left"),
    wire("V1:right", "R2:left"),
    wire("R1:right", "V1:left"),
    wire("R2:right", "V1:left"),
  ];

  const g = CircuitGraphBuilder.build(els, cons);
  const m = ModifiedNodalAnalysisBuilder.build(g, els, 60);
  const sol = ComplexLinearSolver.solve(
    m.matrix.map((row) => row.values),
    m.rightHandSide
  );
  const res = MnaElectricalResultsExtractor.extract(g, els, m, sol, 60);
  const mdl = buildAnimationModel(g, res, els, cons);

  expect("paralelo: modelo disponível", mdl !== null);

  if (mdl) {
    const c = mdl.connectionCurrent;

    expect(
      "fio da fonte→R1 leva 2,2 A rms",
      Math.abs(c[cons[0].id].peak / Math.SQRT2 - 2.2) < 0.01
    );

    expect(
      "fio da fonte→R2 leva 1,1 A rms",
      Math.abs(c[cons[1].id].peak / Math.SQRT2 - 1.1) < 0.01
    );

    expect(
      "fio de retorno de R1 leva 2,2 A rms",
      Math.abs(c[cons[2].id].peak / Math.SQRT2 - 2.2) < 0.01
    );
  }
}

expect(
  "cor em 0 é cinza",
  colorForVoltage(0) === "rgb(156, 163, 175)"
);

expect(
  "cor em +1 é verde",
  colorForVoltage(1) === "rgb(22, 163, 74)"
);

expect(
  "cor em -1 é vermelha",
  colorForVoltage(-1) === "rgb(220, 38, 38)"
);

expect(
  "cor satura além de ±1",
  colorForVoltage(5) === colorForVoltage(1)
);

console.log(
  failures === 0
    ? "Animação do Canvas: todos os testes passaram."
    : `Animação do Canvas: ${failures} FALHA(S).`
);
