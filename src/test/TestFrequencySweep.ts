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
  computeFrequencySweep,
} from "../components/FrequencySweep/frequencySweepData";

/*
 * Varredura de frequência conferida com cálculo à mão.
 *
 * RLC série (R = 10 Ω, L = 100 mH, C = 100 µF), fonte de 220 V:
 *   f0 = 1 / (2π·√(L·C)) = 50,33 Hz
 *   em f0: |Z| = R = 10 Ω, fase 0°, |I| = 22 A
 *   abaixo de f0 a fase é negativa (capacitivo); acima, positiva.
 *
 * RLC paralelo alimentado por fonte de corrente de 1 A
 * (R = 100 Ω, L = 100 mH, C = 100 µF):
 *   ressonância em f0 = 50,33 Hz, |Z| = R = 100 Ω (máximo),
 *   tensão na fonte = 100 V.
 */

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
      `${actual.toFixed(3)} (esperado ${expected})`
  );
}

const F0 =
  1 /
  (2 * Math.PI * Math.sqrt(0.1 * 100e-6));

console.log("Varredura: RLC série, fonte de tensão");

{
  const elements = [
    element("V1", "source", 220),
    element("R1", "resistor", 10),
    element("L1", "inductor", 0.1),
    element("C1", "capacitor", 100e-6),
  ];

  const connections = [
    wire("V1:right", "R1:left"),
    wire("R1:right", "L1:left"),
    wire("L1:right", "C1:left"),
    wire("C1:right", "V1:left"),
  ];

  const sweep = computeFrequencySweep(
    elements,
    connections,
    1,
    10000,
    100
  );

  if (!sweep) {
    failures++;
    console.log("FALHOU varredura indisponível");
  } else {
    check(
      "frequência de ressonância (Hz)",
      sweep.resonanceHz ?? NaN,
      F0,
      0.3
    );

    const first = sweep.points[0];
    const last = sweep.points[sweep.points.length - 1];

    check("primeira frequência (Hz)", first.frequency, 1, 1e-9);
    check("última frequência (Hz)", last.frequency, 10000, 1e-6);

    check(
      "fase em 1 Hz é capacitiva (°)",
      first.zeqPhaseDegrees < -80 ? 1 : 0,
      1,
      0
    );

    check(
      "fase em 10 kHz é indutiva (°)",
      last.zeqPhaseDegrees > 80 ? 1 : 0,
      1,
      0
    );

    const nearest = sweep.points.reduce(
      (best, point) =>
        Math.abs(point.frequency - F0) <
        Math.abs(best.frequency - F0)
          ? point
          : best
    );

    check(
      "|Z| na ressonância (Ω)",
      nearest.zeqMagnitude,
      10,
      0.1
    );

    check(
      "|I| na ressonância (A)",
      nearest.sourceMagnitude,
      22,
      0.3
    );

    check(
      "|V| do capacitor > fonte (Q elevado)",
      nearest.voltageByElement["C1"] > 220 ? 1 : 0,
      1,
      0
    );

    check(
      "grandeza da fonte",
      sweep.sourceQuantity === "current" ? 1 : 0,
      1,
      0
    );
  }
}

console.log("Varredura: RLC paralelo, fonte de corrente");

{
  const elements = [
    element("I1", "currentSource", 1),
    element("R1", "resistor", 100),
    element("L1", "inductor", 0.1),
    element("C1", "capacitor", 100e-6),
  ];

  const connections = [
    wire("I1:right", "R1:left"),
    wire("I1:right", "L1:left"),
    wire("I1:right", "C1:left"),
    wire("R1:right", "I1:left"),
    wire("L1:right", "I1:left"),
    wire("C1:right", "I1:left"),
  ];

  const sweep = computeFrequencySweep(
    elements,
    connections,
    1,
    10000,
    100
  );

  if (!sweep) {
    failures++;
    console.log("FALHOU varredura indisponível");
  } else {
    check(
      "frequência de ressonância (Hz)",
      sweep.resonanceHz ?? NaN,
      F0,
      0.3
    );

    const maxZ = Math.max(
      ...sweep.points.map((point) => point.zeqMagnitude)
    );

    check("|Z| máximo = R (Ω)", maxZ, 100, 0.5);

    const nearest = sweep.points.reduce(
      (best, point) =>
        Math.abs(point.frequency - F0) <
        Math.abs(best.frequency - F0)
          ? point
          : best
    );

    check(
      "tensão da fonte na ressonância (V)",
      nearest.sourceMagnitude,
      100,
      0.5
    );

    check(
      "grandeza da fonte",
      sweep.sourceQuantity === "voltage" ? 1 : 0,
      1,
      0
    );
  }
}

console.log("Varredura: entradas inválidas");

{
  const elements = [
    element("V1", "source", 220),
    element("R1", "resistor", 10),
  ];

  const open = [wire("V1:right", "R1:left")];

  check(
    "circuito aberto retorna null",
    computeFrequencySweep(elements, open, 1, 100) ===
      null
      ? 1
      : 0,
    1,
    0
  );

  const closed = [
    wire("V1:right", "R1:left"),
    wire("R1:right", "V1:left"),
  ];

  check(
    "faixa invertida retorna null",
    computeFrequencySweep(elements, closed, 100, 10) ===
      null
      ? 1
      : 0,
    1,
    0
  );

  const twoSources = [
    element("V1", "source", 220),
    element("V2", "source", 100),
    element("R1", "resistor", 10),
  ];

  check(
    "duas fontes retornam null",
    computeFrequencySweep(
      twoSources,
      [
        wire("V1:right", "V2:left"),
        wire("V2:right", "R1:left"),
        wire("R1:right", "V1:left"),
      ],
      1,
      100
    ) === null
      ? 1
      : 0,
    1,
    0
  );

  check(
    "frequência zero retorna null",
    computeFrequencySweep(elements, closed, 0, 100) ===
      null
      ? 1
      : 0,
    1,
    0
  );
}

console.log(
  failures === 0
    ? "Varredura de frequência: todos os testes passaram."
    : `Varredura de frequência: ${failures} FALHA(S).`
);
