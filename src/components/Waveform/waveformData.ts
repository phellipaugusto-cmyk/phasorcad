import type {
  PhasorEntry,
} from "../PhasorDiagram/phasorDiagramData";

/*
 * Os módulos dos fasores do app são valores eficazes (RMS):
 * 220 V × 4,4 A = 968 W. A amplitude (pico) da onda é √2 vezes
 * o valor eficaz:  x(t) = √2·|X|·cos(ωt + θ).
 */

export interface WaveformPoint {
  /* Tempo em segundos. */
  time: number;

  voltage: number;

  current: number;
}

export interface WaveformData {
  points: WaveformPoint[];

  voltagePeak: number;

  currentPeak: number;

  /* Duração total mostrada, em segundos. */
  duration: number;

  period: number;
}

export interface PhaseRelation {
  /* Ângulo da corrente menos o da tensão, entre -180° e 180°. */
  differenceDegrees: number;

  /* Atraso (positivo) ou avanço (negativo) em segundos. */
  lagSeconds: number;

  kind:
    | "in-phase"
    | "current-lags"
    | "current-leads";
}

const PHASE_EPSILON_DEGREES = 0.05;

function normalizeDegrees(
  degrees: number
): number {
  let value =
    ((degrees % 360) + 360) % 360;

  if (value > 180) {
    value -= 360;
  }

  return value;
}

export function getPhaseRelation(
  voltageAngleDegrees: number,
  currentAngleDegrees: number,
  frequency: number
): PhaseRelation {
  const difference =
    normalizeDegrees(
      currentAngleDegrees -
        voltageAngleDegrees
    );

  const kind =
    Math.abs(difference) <
    PHASE_EPSILON_DEGREES
      ? "in-phase"
      : difference < 0
        ? "current-lags"
        : "current-leads";

  return {
    differenceDegrees: difference,

    /* Corrente atrasada (ângulo negativo) → atraso positivo. */
    lagSeconds:
      frequency > 0
        ? -difference /
          360 /
          frequency
        : 0,

    kind,
  };
}

export function buildWaveform(
  voltage: PhasorEntry,
  current: PhasorEntry,
  frequency: number,
  periods = 2,
  samplesPerPeriod = 120
): WaveformData | null {
  if (
    !Number.isFinite(frequency) ||
    frequency <= 0
  ) {
    return null;
  }

  const period = 1 / frequency;

  const duration = period * periods;

  const omega =
    2 * Math.PI * frequency;

  const voltagePeak =
    Math.SQRT2 * voltage.magnitude;

  const currentPeak =
    Math.SQRT2 * current.magnitude;

  const voltagePhase =
    (voltage.angleDegrees * Math.PI) /
    180;

  const currentPhase =
    (current.angleDegrees * Math.PI) /
    180;

  const count =
    periods * samplesPerPeriod;

  const points: WaveformPoint[] = [];

  for (let index = 0; index <= count; index++) {
    const time =
      (duration * index) / count;

    points.push({
      time,

      voltage:
        voltagePeak *
        Math.cos(
          omega * time + voltagePhase
        ),

      current:
        currentPeak *
        Math.cos(
          omega * time + currentPhase
        ),
    });
  }

  return {
    points,
    voltagePeak,
    currentPeak,
    duration,
    period,
  };
}

export interface PowerWaveData {
  points: {
    /* Tempo em segundos. */
    time: number;
    /* Potência instantânea p(t) = v(t)·i(t), em W. */
    power: number;
  }[];

  /* Potência ativa (valor médio de p), em W. */
  average: number;

  /* Maior e menor valor de p(t), em W. */
  peakMax: number;

  peakMin: number;

  /* Potência aparente S = V·I (eficazes), em VA. */
  apparent: number;

  duration: number;

  period: number;
}

/*
 * Potência instantânea de um componente:
 *   p(t) = v(t)·i(t) = V·I·[cos(θv − θi) + cos(2ωt + θv + θi)]
 *
 * Valor médio: P = V·I·cos(θv − θi). Oscila a 2f com amplitude
 * S = V·I em torno da média. Positiva significa energia
 * absorvida (na fonte, entregue ao circuito).
 */
export function buildPowerWave(
  voltage: PhasorEntry,
  current: PhasorEntry,
  frequency: number,
  periods = 2,
  samplesPerPeriod = 120
): PowerWaveData | null {
  const wave = buildWaveform(
    voltage,
    current,
    frequency,
    periods,
    samplesPerPeriod
  );

  if (!wave) {
    return null;
  }

  const apparent =
    voltage.magnitude * current.magnitude;

  const phase =
    ((voltage.angleDegrees -
      current.angleDegrees) *
      Math.PI) /
    180;

  const average =
    apparent * Math.cos(phase);

  return {
    points: wave.points.map((point) => ({
      time: point.time,
      power: point.voltage * point.current,
    })),
    average,
    peakMax: average + apparent,
    peakMin: average - apparent,
    apparent,
    duration: wave.duration,
    period: wave.period,
  };
}
