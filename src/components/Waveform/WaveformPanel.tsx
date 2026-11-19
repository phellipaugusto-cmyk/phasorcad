import { AnimateToggle } from "../Canvas/AnimateToggle";
import { useAnimationClock } from "../Canvas/animationClock";
import {
  isSourceType,
} from "../../core/CircuitElement";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

import type {
  MnaElectricalResults,
} from "../../core/MnaElectricalResults";

import {
  buildPhasorEntries,
} from "../PhasorDiagram/phasorDiagramData";

import {
  PowerWave,
} from "./PowerWave";

import {
  buildWaveform,
  getPhaseRelation,
  type WaveformPoint,
} from "./waveformData";

interface WaveformPanelProps {
  results: MnaElectricalResults;

  elements: CircuitElement[];

  selectedElementId: string | null;

  frequency: number;
}

const WIDTH = 360;

const HEIGHT = 210;

const PLOT_LEFT = 52;

const PLOT_RIGHT = 306;

const MIDDLE = 112;

const AMPLITUDE = 70;

const VOLTAGE_COLOR = "#2563eb";

const CURRENT_COLOR = "#dc2626";

function formatPeak(
  value: number
): string {
  return Number(
    value.toPrecision(3)
  ).toString();
}

function formatMilliseconds(
  seconds: number
): string {
  return (
    (Math.abs(seconds) * 1000)
      .toFixed(2)
      .replace(".", ",")
  );
}

/* Instante (dentro de um período) do primeiro pico positivo. */
function getPeakTime(
  angleDegrees: number,
  frequency: number
): number {
  const period = 1 / frequency;

  const time =
    -angleDegrees /
    360 /
    frequency;

  return (
    ((time % period) + period) %
    period
  );
}

export function WaveformPanel({
  results,
  elements,
  selectedElementId,
  frequency,
}: WaveformPanelProps) {
  const clock = useAnimationClock();

  const voltages =
    buildPhasorEntries(
      results,
      elements,
      "voltage"
    );

  const currents =
    buildPhasorEntries(
      results,
      elements,
      "current"
    );

  /* Sem seleção (ou seleção sem fasor), mostra a fonte. */
  const elementId =
    voltages.some(
      (entry) =>
        entry.elementId ===
        selectedElementId
    )
      ? selectedElementId
      : (voltages.find(
          (entry) =>
            isSourceType(entry.type)
        )?.elementId ?? null);

  const voltage = voltages.find(
    (entry) =>
      entry.elementId === elementId
  );

  const current = currents.find(
    (entry) =>
      entry.elementId === elementId
  );

  const wave =
    voltage && current
      ? buildWaveform(
          voltage,
          current,
          frequency
        )
      : null;

  const title = (
    <h3
      style={{
        margin: "0 0 8px",
      }}
    >
      Ondas no Tempo
      {voltage
        ? ` — ${voltage.label}`
        : ""}
      <span style={{ float: "right", fontSize: "13px", fontWeight: 400 }}>
        <AnimateToggle />
      </span>
    </h3>
  );

  if (!voltage || !current || !wave) {
    return (
      <section
        style={{
          marginBottom: "16px",
        }}
      >
        {title}

        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#6b7280",
          }}
        >
          Sem ondas: o circuito
          precisa estar fechado.
        </p>
      </section>
    );
  }

  const voltageScale =
    wave.voltagePeak > 1e-9
      ? wave.voltagePeak
      : 1;

  const currentScale =
    wave.currentPeak > 1e-9
      ? wave.currentPeak
      : 1;

  const toX = (time: number) =>
    PLOT_LEFT +
    (time / wave.duration) *
      (PLOT_RIGHT - PLOT_LEFT);

  const toY = (
    value: number,
    scale: number
  ) =>
    MIDDLE -
    (value / scale) * AMPLITUDE;

  const pathFor = (
    pick: (point: WaveformPoint) => number,
    scale: number
  ) =>
    wave.points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ` +
          `${toX(point.time).toFixed(1)} ` +
          `${toY(pick(point), scale).toFixed(1)}`
      )
      .join(" ");

  /* Cursor animado: a mesma fase do Canvas, varrendo 2 períodos. */
  const cursorTime = clock.running
    ? ((clock.phase % (4 * Math.PI)) / (2 * Math.PI)) * wave.period
    : null;

  const sample = (
    time: number,
    pick: (point: WaveformPoint) => number
  ) => {
    const pts = wave.points;
    let low = 0;
    let high = pts.length - 1;

    while (high - low > 1) {
      const mid = (low + high) >> 1;

      if (pts[mid].time <= time) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const span = pts[high].time - pts[low].time || 1;
    const ratio = Math.min(1, Math.max(0, (time - pts[low].time) / span));

    return pick(pts[low]) + (pick(pts[high]) - pick(pts[low])) * ratio;
  };

  const cursorVoltage =
    cursorTime === null ? 0 : sample(cursorTime, (point) => point.voltage);

  const cursorCurrent =
    cursorTime === null ? 0 : sample(cursorTime, (point) => point.current);

  const relation =
    getPhaseRelation(
      voltage.angleDegrees,
      current.angleDegrees,
      frequency
    );

  const voltagePeakX = toX(
    getPeakTime(
      voltage.angleDegrees,
      frequency
    )
  );

  const currentPeakX = toX(
    getPeakTime(
      current.angleDegrees,
      frequency
    )
  );

  const topY = MIDDLE - AMPLITUDE;

  const arrowY = topY - 14;

  const showShift =
    relation.kind !== "in-phase";

  const description =
    relation.kind === "in-phase"
      ? "Tensão e corrente em fase (0°)."
      : relation.kind ===
          "current-lags"
        ? `Corrente atrasada ${Math.abs(
            relation.differenceDegrees
          )
            .toFixed(1)
            .replace(".", ",")}° ` +
          `(${formatMilliseconds(
            relation.lagSeconds
          )} ms) em relação à tensão.`
        : `Corrente adiantada ${Math.abs(
            relation.differenceDegrees
          )
            .toFixed(1)
            .replace(".", ",")}° ` +
          `(${formatMilliseconds(
            relation.lagSeconds
          )} ms) em relação à tensão.`;

  const ticks = [
    0,
    wave.period / 2,
    wave.period,
    (wave.period * 3) / 2,
    wave.duration,
  ];

  return (
    <section
      style={{
        marginBottom: "16px",
      }}
    >
      {title}

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        style={{
          maxWidth: "360px",
          display: "block",
          margin: "0 auto",
        }}
        role="img"
        aria-label="Ondas de tensão e corrente no tempo"
      >
        <line
          x1={PLOT_LEFT}
          y1={topY}
          x2={PLOT_RIGHT}
          y2={topY}
          stroke="#e5e7eb"
        />

        <line
          x1={PLOT_LEFT}
          y1={MIDDLE + AMPLITUDE}
          x2={PLOT_RIGHT}
          y2={MIDDLE + AMPLITUDE}
          stroke="#e5e7eb"
        />

        <line
          x1={PLOT_LEFT}
          y1={MIDDLE}
          x2={PLOT_RIGHT}
          y2={MIDDLE}
          stroke="#6b7280"
        />

        {ticks.map((time) => (
          <g key={time}>
            <line
              x1={toX(time)}
              y1={MIDDLE - 3}
              x2={toX(time)}
              y2={MIDDLE + 3}
              stroke="#6b7280"
            />

            <text
              x={toX(time)}
              y={MIDDLE + AMPLITUDE + 18}
              fontSize="12"
              textAnchor="middle"
              fill="#6b7280"
            >
              {(time * 1000)
                .toFixed(1)
                .replace(".0", "")}
            </text>
          </g>
        ))}

        <text
          x={PLOT_LEFT - 22}
          y={MIDDLE + AMPLITUDE + 18}
          fontSize="12"
          textAnchor="end"
          fill="#6b7280"
        >
          t (ms)
        </text>

        {/* Escalas de pico: tensão à esquerda, corrente à direita. */}
        <text
          x={PLOT_LEFT - 4}
          y={topY + 4}
          fontSize="12"
          textAnchor="end"
          fill={VOLTAGE_COLOR}
        >
          {formatPeak(
            wave.voltagePeak
          )}
        </text>

        <text
          x={PLOT_LEFT - 4}
          y={MIDDLE + AMPLITUDE + 4}
          fontSize="12"
          textAnchor="end"
          fill={VOLTAGE_COLOR}
        >
          −{formatPeak(
            wave.voltagePeak
          )}
        </text>

        <text
          x={PLOT_RIGHT + 4}
          y={topY + 4}
          fontSize="12"
          fill={CURRENT_COLOR}
        >
          {formatPeak(
            wave.currentPeak
          )}
        </text>

        <text
          x={PLOT_RIGHT + 4}
          y={MIDDLE + AMPLITUDE + 4}
          fontSize="12"
          fill={CURRENT_COLOR}
        >
          −{formatPeak(
            wave.currentPeak
          )}
        </text>

        <path
          d={pathFor(
            (point) => point.voltage,
            voltageScale
          )}
          fill="none"
          stroke={VOLTAGE_COLOR}
          strokeWidth="2.5"
        />

        <path
          d={pathFor(
            (point) => point.current,
            currentScale
          )}
          fill="none"
          stroke={CURRENT_COLOR}
          strokeWidth="2.5"
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
              cy={toY(cursorVoltage, voltageScale)}
              r="5"
              fill="#fff"
              stroke={VOLTAGE_COLOR}
              strokeWidth="2.5"
            />
            <circle
              cx={toX(cursorTime)}
              cy={toY(cursorCurrent, currentScale)}
              r="5"
              fill="#fff"
              stroke={CURRENT_COLOR}
              strokeWidth="2.5"
            />
          </g>
        ) : null}

        {showShift ? (
          <g>
            <line
              x1={voltagePeakX}
              y1={arrowY}
              x2={voltagePeakX}
              y2={topY}
              stroke={VOLTAGE_COLOR}
              strokeDasharray="2 2"
            />

            <line
              x1={currentPeakX}
              y1={arrowY}
              x2={currentPeakX}
              y2={topY}
              stroke={CURRENT_COLOR}
              strokeDasharray="2 2"
            />

            <line
              x1={voltagePeakX}
              y1={arrowY}
              x2={currentPeakX}
              y2={arrowY}
              stroke="#374151"
              strokeWidth="1.5"
            />

            <text
              x={
                (voltagePeakX +
                  currentPeakX) /
                2
              }
              y={arrowY - 4}
              fontSize="12"
              textAnchor="middle"
              fill="#374151"
            >
              Δt ={" "}
              {formatMilliseconds(
                relation.lagSeconds
              )}{" "}
              ms
            </text>
          </g>
        ) : null}
      </svg>

      {cursorTime !== null ? (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "13px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          t = {(cursorTime * 1000).toFixed(2)} ms ·{" "}
          <span style={{ color: VOLTAGE_COLOR }}>
            v = {cursorVoltage.toFixed(1)} V
          </span>{" "}
          ·{" "}
          <span style={{ color: CURRENT_COLOR }}>
            i = {cursorCurrent.toFixed(2)} A
          </span>
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          fontSize: "13px",
          marginTop: "4px",
        }}
      >
        <span
          style={{
            color: VOLTAGE_COLOR,
          }}
        >
          ━ v(t)
        </span>

        <span
          style={{
            color: CURRENT_COLOR,
          }}
        >
          ━ i(t)
        </span>
      </div>

      <p
        style={{
          margin: "6px 0 0",
          fontSize: "13px",
        }}
      >
        {description}
      </p>

      <p
        style={{
          margin: "4px 0 0",
          fontSize: "11px",
          color: "#6b7280",
        }}
      >
        Cada onda usa a própria escala (pico = √2 × valor eficaz). Os
        valores mostrados são os picos, em V e em A.
      </p>

      <PowerWave
        voltage={voltage}
        current={current}
        frequency={frequency}
        isSource={isSourceType(voltage.type)}
      />
    </section>
  );
}
