import type {
  PhasorEntry,
} from "../components/PhasorDiagram/phasorDiagramData";

import {
  buildPowerWave,
} from "../components/Waveform/waveformData";

/*
 * p(t) = v(t)·i(t) num RL série (220 V ∠0°, R = 100 Ω, L = 100 mH,
 * 60 Hz), calculado à mão:
 *   I = 2,0585 A ∠-20,66°      S = 220 · 2,0585 = 452,87 VA
 *   P = S·cos(20,66°) = 423,7 W  (= I²R = 2,0585² · 100)
 *   pico máximo = P + S = 876,6 W   pico mínimo = P − S = -29,12 W
 * Para um resistor puro (φ = 0): P = S e p(t) nunca é negativa.
 */

let failures = 0;

function entry(
  magnitude: number,
  angleDegrees: number
): PhasorEntry {
  const angle =
    (angleDegrees * Math.PI) / 180;

  return {
    elementId: "X",
    label: "X",
    type: "resistor",
    real: magnitude * Math.cos(angle),
    imaginary: magnitude * Math.sin(angle),
    startReal: 0,
    startImaginary: 0,
    magnitude,
    angleDegrees,
  };
}

function check(
  name: string,
  actual: number,
  expected: number,
  tolerance = 0.1
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

console.log("Potência instantânea p(t): RL série");

{
  const power = buildPowerWave(
    entry(220, 0),
    entry(2.0585, -20.66),
    60,
    2,
    2000
  );

  if (!power) {
    failures++;
    console.log("FALHOU p(t) indisponível");
  } else {
    check("P média (W)", power.average, 423.7);
    check("S (VA)", power.apparent, 452.87);
    check("pico máximo (W)", power.peakMax, 876.6);
    check("pico mínimo (W)", power.peakMin, -29.12);

    const maxSample = Math.max(
      ...power.points.map((point) => point.power)
    );

    const minSample = Math.min(
      ...power.points.map((point) => point.power)
    );

    check("máximo das amostras (W)", maxSample, 876.6, 0.5);
    check("mínimo das amostras (W)", minSample, -29.12, 0.5);

    /* Média numérica (trapézios) de p(t) em 2 períodos. */
    let area = 0;

    for (let i = 1; i < power.points.length; i++) {
      const a = power.points[i - 1];
      const b = power.points[i];

      area +=
        ((a.power + b.power) / 2) *
        (b.time - a.time);
    }

    check(
      "média numérica de p(t) (W)",
      area / power.duration,
      423.7,
      0.2
    );

    check(
      "período (ms)",
      power.period * 1000,
      16.667,
      0.01
    );
  }
}

console.log("Potência instantânea p(t): resistor puro");

{
  const power = buildPowerWave(
    entry(100, 30),
    entry(2, 30),
    60
  );

  if (!power) {
    failures++;
    console.log("FALHOU p(t) indisponível");
  } else {
    check("P = S (W)", power.average, 200);
    check("pico mínimo (W)", power.peakMin, 0, 1e-6);
    check("pico máximo (W)", power.peakMax, 400);
  }
}

expectNull();

function expectNull(): void {
  const power = buildPowerWave(
    entry(1, 0),
    entry(1, 0),
    0
  );

  const ok = power === null;

  if (!ok) {
    failures++;
  }

  console.log(
    `${ok ? "OK    " : "FALHOU"} frequência 0 não gera onda`
  );
}

console.log(
  failures === 0
    ? "Potência p(t): todos os testes passaram."
    : `Potência p(t): ${failures} FALHA(S).`
);
