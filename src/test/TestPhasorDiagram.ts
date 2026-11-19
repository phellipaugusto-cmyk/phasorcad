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
  buildPhasorEntries,
  type PhasorQuantity,
} from "../components/PhasorDiagram/phasorDiagramData";

/*
 * Valida os fasores do diagrama num circuito RL em série
 * (220 V, 60 Hz, R = 100 Ω, L = 100 mH), calculado à mão:
 *   XL = 2π·60·0,1 = 37,699 Ω   |Z| = 106,87 Ω   φ = 20,66°
 *   I  = 2,0585 A ∠ -20,66°
 *   VR = 205,85 V ∠ -20,66°     VL = 77,60 V ∠ 69,34°
 * Também confere que a fonte sai sempre como 220 V ∠ 0°,
 * mesmo quando a ligação inverte qual terminal é a referência.
 */

const TOLERANCE = 0.01;

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

function entriesFor(
  connections: CircuitConnection[],
  quantity: PhasorQuantity
) {
  const elements = [
    element("V1", "source", 220),
    element("R1", "resistor", 100),
    element("L1", "inductor", 0.1),
  ];

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

  const results =
    MnaElectricalResultsExtractor.extract(
      graph,
      elements,
      mna,
      solution,
      60
    );

  return buildPhasorEntries(
    results,
    elements,
    quantity
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

console.log(
  "==== TESTE DIAGRAMA FASORIAL ===="
);

const normal = [
  wire("V1:right", "R1:left"),
  wire("R1:right", "L1:left"),
  wire("L1:right", "V1:left"),
];

const reversed = [
  wire("V1:left", "R1:left"),
  wire("R1:right", "L1:left"),
  wire("L1:right", "V1:right"),
];

for (const [label, connections] of [
  ["ligação normal", normal],
  ["ligação invertida", reversed],
] as const) {
  const voltages = entriesFor(
    connections,
    "voltage"
  );

  const currents = entriesFor(
    connections,
    "current"
  );

  const source = voltages.find(
    (item) => item.elementId === "V1"
  );

  const sourceCurrent = currents.find(
    (item) => item.elementId === "V1"
  );

  check(
    `${label}: |V1|`,
    source?.magnitude ?? NaN,
    220
  );

  check(
    `${label}: ∠V1`,
    source?.angleDegrees ?? NaN,
    0
  );

  check(
    `${label}: |I(V1)|`,
    sourceCurrent?.magnitude ?? NaN,
    2.0585
  );

  check(
    `${label}: ∠I(V1)`,
    sourceCurrent?.angleDegrees ?? NaN,
    -20.66
  );
}

const normalVoltages = entriesFor(
  normal,
  "voltage"
);

const vr = normalVoltages.find(
  (item) => item.elementId === "R1"
);

const vl = normalVoltages.find(
  (item) => item.elementId === "L1"
);

check("|VR|", vr?.magnitude ?? NaN, 205.85);
check("∠VR", vr?.angleDegrees ?? NaN, -20.66);
check("|VL|", vl?.magnitude ?? NaN, 77.6);
check("∠VL", vl?.angleDegrees ?? NaN, 69.34);

/* Modo soma: as setas se encadeiam e fecham em 220 V ∠ 0°. */
const chainSource = normalVoltages.find(
  (item) => item.elementId === "V1"
);

check(
  "soma: V1 começa em Re",
  chainSource?.startReal ?? NaN,
  0
);

check(
  "soma: V1 termina em Re",
  (chainSource?.startReal ?? NaN) +
    (chainSource?.real ?? NaN),
  220
);

if (vr && vl) {
  const vrEnd = {
    x: vr.startReal + vr.real,
    y: vr.startImaginary + vr.imaginary,
  };

  const vlEnd = {
    x: vl.startReal + vl.real,
    y: vl.startImaginary + vl.imaginary,
  };

  /* Uma passiva sai da referência e a outra termina na fonte. */
  const first =
    Math.hypot(vl.startReal, vl.startImaginary) <
    0.01
      ? { head: vl, end: vlEnd, tail: vr, tailEnd: vrEnd }
      : { head: vr, end: vrEnd, tail: vl, tailEnd: vlEnd };

  check(
    "soma: 2º começa onde o 1º termina (Re)",
    first.tail.startReal,
    first.end.x
  );

  check(
    "soma: 2º começa onde o 1º termina (Im)",
    first.tail.startImaginary,
    first.end.y
  );

  check(
    "soma: cadeia termina em 220 (Re)",
    first.tailEnd.x,
    220
  );

  check(
    "soma: cadeia termina em 0 (Im)",
    first.tailEnd.y,
    0
  );
}

console.log(
  failures === 0
    ? "Resumo: diagrama fasorial correto."
    : `Resumo: ${failures} verificação(ões) falharam.`
);
