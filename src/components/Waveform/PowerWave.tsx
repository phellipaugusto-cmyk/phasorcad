import type {
  PhasorEntry,
} from "../PhasorDiagram/phasorDiagramData";

import { useAnimationClock } from "../Canvas/animationClock";

import {
  buildPowerWave,
} from "./waveformData";

interface PowerWaveProps {
  voltage: PhasorEntry;

  current: PhasorEntry;

  frequency: number;

  /* A fonte mostra a potência entregue; os demais, a absorvida. */
  isSource: boolean;
}

const WIDTH = 360;
const HEIGHT = 180;
const PLOT_LEFT = 52;
const PLOT_RIGHT = 306;
const MIDDLE = 90;
const AMPLITUDE = 62;
const POWER_COLOR = "#7c3aed";

function formatPower(
  value: number,
  unit: string
): string {
  const absolute = Math.abs(value);

  if (absolute >= 1000) {
    return `${Number(
      (value / 1000).toPrecision(3)
    )} k${unit}`;
  }

  return `${Number(
    value.toPrecision(3)
  )} ${unit}`;
}

export function PowerWave({
  voltage,
  current,
  frequency,
  isSource,
}: PowerWaveProps) {
  const clock = useAnimationClock();

  const power = buildPowerWave(
    voltage,
    current,
    frequency
  );

  const title = (
    <h3
      style={{
        margin: "14px 0 8px",
      }}
    >
      {isSource
        ? "Potência entregue p(t)"
        : "Potência p(t)"}
      {` — ${voltage.label}`}
    </h3>
  );

  if (!power || power.apparent < 1e-9) {
    return (
      <div>
        {title}

        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#6b7280",
          }}
        >
          Potência nula neste componente.
        </p>
      </div>
    );
  }

  const scale = Math.max(
    Math.abs(power.peakMax),
    Math.abs(power.peakMin)
  );

  const toX = (time: number) =>
    PLOT_LEFT +
    (time / power.duration) *
      (PLOT_RIGHT - PLOT_LEFT);

  const toY = (value: number) =>
    MIDDLE - (value / scale) * AMPLITUDE;

  const path = power.points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ` +
        `${toX(point.time).toFixed(1)} ` +
        `${toY(point.power).toFixed(1)}`
    )
    .join(" ");

  const periodMilliseconds =
    power.period * 1000;

  const ticks = [0, 1, 2].map((index) => ({
    x: toX(power.period * index),
    label: Number(
      (periodMilliseconds * index).toFixed(1)
    ).toString(),
  }));

  const returnsEnergy =
    power.peakMin < -1e-6 * power.apparent;

  const averageY = toY(power.average);

  const cursorTime = clock.running
    ? ((clock.phase % (4 * Math.PI)) / (2 * Math.PI)) * power.period
    : null;

  let cursorPower = 0;

  if (cursorTime !== null) {
    const pts = power.points;
    let low = 0;
    let high = pts.length - 1;

    while (high - low > 1) {
      const mid = (low + high) >> 1;

      if (pts[mid].time <= cursorTime) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const span = pts[high].time - pts[low].time || 1;
    const ratio = Math.min(1, Math.max(0, (cursorTime - pts[low].time) / span));

    cursorPower = pts[low].power + (pts[high].power - pts[low].power) * ratio;
  }

  const verb = isSource
    ? "entregue"
    : "absorvida";

  return (
    <div>
      {title}

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Potência instantânea de ${voltage.label}`}
        style={{
          maxWidth: "360px",
          display: "block",
          margin: "0 auto",
        }}
      >
        <line
          x1={PLOT_LEFT}
          y1={MIDDLE}
          x2={PLOT_RIGHT}
          y2={MIDDLE}
          stroke="#9ca3af"
          strokeWidth={1}
        />

        <line
          x1={PLOT_LEFT}
          y1={MIDDLE - AMPLITUDE - 6}
          x2={PLOT_LEFT}
          y2={MIDDLE + AMPLITUDE + 6}
          stroke="#9ca3af"
          strokeWidth={1}
        />

        {ticks.map((tick) => (
          <g key={tick.label}>
            <line
              x1={tick.x}
              y1={MIDDLE - 3}
              x2={tick.x}
              y2={MIDDLE + 3}
              stroke="#9ca3af"
            />

            <text
              x={tick.x}
              y={HEIGHT - 8}
              fontSize="11"
              textAnchor="middle"
              fill="#6b7280"
            >
              {tick.label}
            </text>
          </g>
        ))}

        <text
          x={PLOT_LEFT - 6}
          y={HEIGHT - 8}
          fontSize="11"
          textAnchor="end"
          fill="#6b7280"
        >
          t (ms)
        </text>

        <line
          x1={PLOT_LEFT}
          y1={averageY}
          x2={PLOT_RIGHT}
          y2={averageY}
          stroke={POWER_COLOR}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.8}
        />

        <path
          d={path}
          fill="none"
          stroke={POWER_COLOR}
          strokeWidth={2}
        />

        {cursorTime !== null ? (
          <g pointerEvents="none">
            <line
              x1={toX(cursorTime)}
              y1={MIDDLE - AMPLITUDE - 6}
              x2={toX(cursorTime)}
              y2={MIDDLE + AMPLITUDE + 6}
              stroke="#6b7280"
              strokeDasharray="3 3"
            />
            <circle
              cx={toX(cursorTime)}
              cy={toY(cursorPower)}
              r="5"
              fill="#fff"
              stroke={POWER_COLOR}
              strokeWidth="2.5"
            />
          </g>
        ) : null}

        <text
          x={PLOT_LEFT - 6}
          y={toY(power.peakMax) + 4}
          fontSize="11"
          textAnchor="end"
          fill={POWER_COLOR}
        >
          {formatPower(power.peakMax, "W")}
        </text>

        {returnsEnergy ? (
          <text
            x={PLOT_LEFT - 6}
            y={toY(power.peakMin) + 4}
            fontSize="11"
            textAnchor="end"
            fill={POWER_COLOR}
          >
            {formatPower(power.peakMin, "W")}
          </text>
        ) : null}

        <text
          x={PLOT_RIGHT + 4}
          y={averageY + 4}
          fontSize="11"
          fill={POWER_COLOR}
        >
          P
        </text>
      </svg>

      {cursorTime !== null ? (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "13px",
            fontVariantNumeric: "tabular-nums",
            color: POWER_COLOR,
          }}
        >
          p = {cursorPower.toFixed(1)} W
        </p>
      ) : null}

      <p
        style={{
          margin: "6px 0 0",
          fontSize: "13px",
        }}
      >
        Potência ativa {verb} (média){" "}
        <strong>
          P = {formatPower(power.average, "W")}
        </strong>
        ; S = {formatPower(power.apparent, "VA")}.{" "}
        {returnsEnergy
          ? "p(t) fica negativa em parte do ciclo: há troca de energia (potência reativa)."
          : "p(t) nunca fica negativa: não há troca de energia."}
      </p>

      <p
        style={{
          margin: "4px 0 0",
          fontSize: "11px",
          color: "#6b7280",
        }}
      >
        p(t) = v(t)·i(t) oscila ao dobro da frequência; a linha
        tracejada é a média P.
      </p>
    </div>
  );
}
