import type {
  PhasorEntry,
} from "../components/PhasorDiagram/phasorDiagramData";

import {
  buildWaveform,
  getPhaseRelation,
} from "../components/Waveform/waveformData";

/*
 * Valida as ondas v(t) e i(t) e a defasagem num RL em série
 * (220 V eficaz, 60 Hz, I = 2,0585 A ∠ -20,66°):
 *   pico de v = 311,13 V      pico de i = 2,911 A
 *   atraso = 20,66° / 360° / 60 Hz = 0,9564 ms
 *   v(0) = 311,13 V           i(0) = 2,911·cos(-20,66°) = 2,7236 A
 */

const TOLERANCE = 0.01;

let failures = 0;

function entry(
  magnitude: number,
  angleDegrees: number
): PhasorEntry {
  return {
    elementId: "X",
    label: "X",
    type: "source",
    real: 0,
    imaginary: 0,
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
  tolerance = TOLERANCE
): void {
  const ok =
    Math.abs(actual - expected) <=
    tolerance;

  if (!ok) {
    failures++;
  }

  console.log(
    `${ok ? "OK    " : "FALHOU"} ${name}: ` +
      `${actual.toFixed(4)} (esperado ${expected})`
  );
}

console.log("==== TESTE ONDAS v(t) e i(t) ====");

const wave = buildWaveform(
  entry(220, 0),
  entry(2.0585, -20.66),
  60
);

if (!wave) {
  failures++;
  console.log("FALHOU onda não gerada");
} else {
  check("pico de v", wave.voltagePeak, 311.127);
  check("pico de i", wave.currentPeak, 2.911, 0.001);
  check("período (ms)", wave.period * 1000, 16.6667, 0.001);
  check("v(0)", wave.points[0].voltage, 311.127);
  check("i(0)", wave.points[0].current, 2.7236, 0.001);
  check("pontos", wave.points.length, 241, 0);

  /* Depois de um período inteiro, a onda se repete. */
  const atPeriod = wave.points[120];

  check("v(T) = v(0)", atPeriod.voltage, 311.127);
}

const lagging = getPhaseRelation(0, -20.66, 60);

check("Δφ (atrasada)", lagging.differenceDegrees, -20.66);
check("atraso (ms)", lagging.lagSeconds * 1000, 0.9564, 0.001);
console.log(
  lagging.kind === "current-lags"
    ? "OK     RL: corrente atrasada"
    : "FALHOU RL: deveria ser corrente atrasada"
);
if (lagging.kind !== "current-lags") failures++;

const leading = getPhaseRelation(0, 27.95, 60);

check("Δφ (adiantada)", leading.differenceDegrees, 27.95);
check("avanço (ms)", leading.lagSeconds * 1000, -1.2940, 0.001);
if (leading.kind !== "current-leads") {
  failures++;
  console.log("FALHOU RC: deveria ser corrente adiantada");
} else {
  console.log("OK     RC: corrente adiantada");
}

/* Passagem por ±180° e fase igual. */
check(
  "normaliza 350° → -10°",
  getPhaseRelation(0, 350, 60).differenceDegrees,
  -10
);

if (getPhaseRelation(30, 30.01, 60).kind !== "in-phase") {
  failures++;
  console.log("FALHOU: 0,01° deveria ser em fase");
} else {
  console.log("OK     0,01° conta como em fase");
}

if (buildWaveform(entry(1, 0), entry(1, 0), 0) !== null) {
  failures++;
  console.log("FALHOU: frequência 0 deveria dar null");
} else {
  console.log("OK     frequência 0 não gera onda");
}

console.log(
  failures === 0
    ? "Resumo: ondas corretas."
    : `Resumo: ${failures} verificação(ões) falharam.`
);
