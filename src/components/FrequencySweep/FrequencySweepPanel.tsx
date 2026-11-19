import {
  useMemo,
  useState,
} from "react";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

import {
  isSourceType,
} from "../../core/CircuitElement";

import type {
  CircuitConnection,
} from "../../core/CircuitConnection";

import {
  computeFrequencySweep,
  SWEEP_MAX_HZ,
  SWEEP_MIN_HZ,
  type FrequencySweep,
  type SweepPoint,
} from "./frequencySweepData";

interface FrequencySweepPanelProps {
  elements: CircuitElement[];

  connections: CircuitConnection[];

  /* Frequência de operação atual, marcada no gráfico. */
  frequency: number;
}

const WIDTH = 360;
const PLOT_LEFT = 52;
const PLOT_RIGHT = 340;
const CURVE_COLOR = "#0f766e";
const PHASE_COLOR = "#be185d";
const MARKER_COLOR = "#6b7280";

function formatNumber(value: number): string {
  if (value === 0) {
    return "0";
  }

  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${Number((value / 1_000_000).toPrecision(3))}M`;
  }

  if (absolute >= 1000) {
    return `${Number((value / 1000).toPrecision(3))}k`;
  }

  if (absolute < 0.01) {
    return value.toExponential(0);
  }

  return Number(value.toPrecision(3)).toString();
}

function formatFrequency(value: number): string {
  return `${formatNumber(value)} Hz`.replace(".", ",");
}

function niceCeil(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));

  const base = Math.pow(10, exponent);

  const fraction = value / base;

  const step =
    fraction <= 1
      ? 1
      : fraction <= 2
        ? 2
        : fraction <= 5
          ? 5
          : 10;

  return step * base;
}

interface Metric {
  id: string;

  label: string;

  unit: string;

  pick: (point: SweepPoint) => number;
}

function buildMetrics(
  sweep: FrequencySweep,
  elements: CircuitElement[]
): Metric[] {
  const metrics: Metric[] = [
    {
      id: "zeq",
      label: "|Zeq| (impedância)",
      unit: "Ω",
      pick: (point) => point.zeqMagnitude,
    },
    sweep.sourceQuantity === "current"
      ? {
          id: "source",
          label: "|I| da fonte",
          unit: "A",
          pick: (point) => point.sourceMagnitude,
        }
      : {
          id: "source",
          label: "|V| da fonte",
          unit: "V",
          pick: (point) => point.sourceMagnitude,
        },
  ];

  elements
    .filter((element) => !isSourceType(element.type))
    .forEach((element) => {
      metrics.push({
        id: `v:${element.id}`,
        label: `|V| em ${element.label}`,
        unit: "V",
        pick: (point) =>
          point.voltageByElement[element.id] ?? 0,
      });

      metrics.push({
        id: `i:${element.id}`,
        label: `|I| em ${element.label}`,
        unit: "A",
        pick: (point) =>
          point.currentByElement[element.id] ?? 0,
      });
    });

  return metrics;
}

function parseHz(text: string): number {
  return Number(text.replace(",", "."));
}

function circuitKey(
  elements: CircuitElement[],
  connections: CircuitConnection[]
): string {
  /* Só o que afeta a eletricidade (não as posições do Canvas). */
  return (
    elements
      .map(
        (element) =>
          `${element.id}:${element.type}:${element.value}`
      )
      .join("|") +
    "#" +
    connections
      .map(
        (connection) =>
          `${connection.fromTerminalId}>${connection.toTerminalId}`
      )
      .join("|")
  );
}

export function FrequencySweepPanel({
  elements,
  connections,
  frequency,
}: FrequencySweepPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const [minText, setMinText] = useState("1");

  const [maxText, setMaxText] = useState("10000");

  const [metricId, setMetricId] = useState("zeq");

  const [logY, setLogY] = useState(true);

  const minHz = parseHz(minText);

  const maxHz = parseHz(maxText);

  const key = circuitKey(elements, connections);

  const sweep = useMemo(
    () =>
      isOpen
        ? computeFrequencySweep(
            elements,
            connections,
            minHz,
            maxHz
          )
        : null,
    // As posições do Canvas não mudam o resultado: usa a chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, key, minHz, maxHz]
  );

  const metrics = sweep
    ? buildMetrics(sweep, elements)
    : [];

  const metric =
    metrics.find((item) => item.id === metricId) ??
    metrics[0];

  const rangeIsValid =
    Number.isFinite(minHz) &&
    Number.isFinite(maxHz) &&
    minHz >= SWEEP_MIN_HZ &&
    maxHz <= SWEEP_MAX_HZ &&
    maxHz > minHz * 1.01;

  return (
    <details
      style={{
        marginBottom: "16px",
      }}
      onToggle={(event) =>
        setIsOpen(
          (event.currentTarget as HTMLDetailsElement)
            .open
        )
      }
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "17px",
        }}
      >
        Resposta em frequência
      </summary>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px 10px",
          margin: "10px 0",
          fontSize: "13px",
        }}
      >
        <label>
          de{" "}
          <input
            aria-label="Frequência mínima (Hz)"
            value={minText}
            onChange={(event) =>
              setMinText(event.target.value)
            }
            style={{ width: "58px" }}
          />
        </label>

        <label>
          até{" "}
          <input
            aria-label="Frequência máxima (Hz)"
            value={maxText}
            onChange={(event) =>
              setMaxText(event.target.value)
            }
            style={{ width: "58px" }}
          />{" "}
          Hz
        </label>

        {metrics.length > 0 ? (
          <select
            aria-label="Grandeza"
            value={metric?.id}
            onChange={(event) =>
              setMetricId(event.target.value)
            }
          >
            {metrics.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : null}

        <label>
          <input
            type="checkbox"
            checked={logY}
            onChange={(event) =>
              setLogY(event.target.checked)
            }
          />{" "}
          Y logarítmico
        </label>
      </div>

      {!isOpen ? null : !rangeIsValid ? (
        <p style={{ fontSize: "13px", color: "#b91c1c" }}>
          Faixa inválida: use de {SWEEP_MIN_HZ} Hz a{" "}
          {formatNumber(SWEEP_MAX_HZ)} Hz, com o máximo
          maior que o mínimo.
        </p>
      ) : !sweep || !metric ? (
        <p style={{ fontSize: "13px", color: "#6b7280" }}>
          Sem resposta: o circuito precisa estar fechado e ter uma única fonte.
        </p>
      ) : (
        <SweepCharts
          sweep={sweep}
          metric={metric}
          logY={logY}
          minHz={minHz}
          maxHz={maxHz}
          frequency={frequency}
        />
      )}
    </details>
  );
}

interface SweepChartsProps {
  sweep: FrequencySweep;

  metric: Metric;

  logY: boolean;

  minHz: number;

  maxHz: number;

  frequency: number;
}

function SweepCharts({
  sweep,
  metric,
  logY,
  minHz,
  maxHz,
  frequency,
}: SweepChartsProps) {
  const logMin = Math.log10(minHz);

  const logMax = Math.log10(maxHz);

  const toX = (hz: number) =>
    PLOT_LEFT +
    ((Math.log10(hz) - logMin) / (logMax - logMin)) *
      (PLOT_RIGHT - PLOT_LEFT);

  const decadeTicks: number[] = [];

  for (
    let exponent = Math.ceil(logMin - 1e-9);
    exponent <= Math.floor(logMax + 1e-9);
    exponent++
  ) {
    decadeTicks.push(Math.pow(10, exponent));
  }

  const values = sweep.points.map(metric.pick);

  const maxValue = Math.max(...values, 1e-12);

  const positive = values.filter((value) => value > 1e-12);

  const minPositive =
    positive.length > 0
      ? Math.min(...positive)
      : maxValue;

  const useLog =
    logY && minPositive > 0 && maxValue / minPositive > 1.5;

  const TOP = 14;
  const BOTTOM = 150;

  let toY: (value: number) => number;

  let yTicks: number[] = [];

  if (useLog) {
    const lowExp = Math.floor(Math.log10(minPositive));

    const highExp = Math.ceil(Math.log10(maxValue));

    const spanExp = Math.max(highExp - lowExp, 1);

    toY = (value) =>
      BOTTOM -
      ((Math.log10(Math.max(value, 1e-12)) - lowExp) /
        spanExp) *
        (BOTTOM - TOP);

    for (let e = lowExp; e <= highExp; e++) {
      yTicks.push(Math.pow(10, e));
    }
  } else {
    const top = niceCeil(maxValue);

    toY = (value) =>
      BOTTOM - (value / top) * (BOTTOM - TOP);

    yTicks = [0, top / 2, top];
  }

  const path = sweep.points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${toX(
          point.frequency
        ).toFixed(1)} ${toY(
          metric.pick(point)
        ).toFixed(1)}`
    )
    .join(" ");

  const PHASE_MID = 62;
  const PHASE_AMPLITUDE = 48;

  const phaseY = (degrees: number) =>
    PHASE_MID - (degrees / 90) * PHASE_AMPLITUDE;

  const phasePath = sweep.points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${toX(
          point.frequency
        ).toFixed(1)} ${phaseY(
          point.zeqPhaseDegrees
        ).toFixed(1)}`
    )
    .join(" ");

  const markerInside =
    frequency >= minHz && frequency <= maxHz;

  const resonance = sweep.resonanceHz;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} 186`}
        width="100%"
        role="img"
        aria-label={`${metric.label} em função da frequência`}
        style={{
          maxWidth: "360px",
          display: "block",
          margin: "0 auto",
        }}
      >
        <text x={PLOT_LEFT} y={10} fontSize="11" fill={CURVE_COLOR}>
          {metric.label} ({metric.unit})
        </text>

        <line
          x1={PLOT_LEFT}
          y1={TOP}
          x2={PLOT_LEFT}
          y2={BOTTOM}
          stroke="#9ca3af"
        />

        <line
          x1={PLOT_LEFT}
          y1={BOTTOM}
          x2={PLOT_RIGHT}
          y2={BOTTOM}
          stroke="#9ca3af"
        />

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PLOT_LEFT}
              y1={toY(tick)}
              x2={PLOT_RIGHT}
              y2={toY(tick)}
              stroke="#e5e7eb"
            />

            <text
              x={PLOT_LEFT - 5}
              y={toY(tick) + 4}
              fontSize="11"
              textAnchor="end"
              fill="#6b7280"
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {decadeTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={toX(tick)}
              y1={TOP}
              x2={toX(tick)}
              y2={BOTTOM}
              stroke="#f3f4f6"
            />

            <text
              x={toX(tick)}
              y={BOTTOM + 13}
              fontSize="11"
              textAnchor="middle"
              fill="#6b7280"
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {markerInside ? (
          <line
            x1={toX(frequency)}
            y1={TOP}
            x2={toX(frequency)}
            y2={BOTTOM}
            stroke={MARKER_COLOR}
            strokeDasharray="4 3"
          />
        ) : null}

        {resonance !== null ? (
          <line
            x1={toX(resonance)}
            y1={TOP}
            x2={toX(resonance)}
            y2={BOTTOM}
            stroke={PHASE_COLOR}
            strokeDasharray="2 3"
          />
        ) : null}

        <path
          d={path}
          fill="none"
          stroke={CURVE_COLOR}
          strokeWidth={2}
        />

        <text
          x={PLOT_RIGHT}
          y={BOTTOM + 26}
          fontSize="11"
          textAnchor="end"
          fill="#6b7280"
        >
          f (Hz)
        </text>
      </svg>

      <svg
        viewBox={`0 0 ${WIDTH} 128`}
        width="100%"
        role="img"
        aria-label="Fase da impedância em função da frequência"
        style={{
          maxWidth: "360px",
          display: "block",
          margin: "6px auto 0",
        }}
      >
        <text x={PLOT_LEFT} y={10} fontSize="11" fill={PHASE_COLOR}>
          Fase de Zeq (°)
        </text>

        <line
          x1={PLOT_LEFT}
          y1={phaseY(90)}
          x2={PLOT_LEFT}
          y2={phaseY(-90)}
          stroke="#9ca3af"
        />

        {[90, 0, -90].map((degrees) => (
          <g key={degrees}>
            <line
              x1={PLOT_LEFT}
              y1={phaseY(degrees)}
              x2={PLOT_RIGHT}
              y2={phaseY(degrees)}
              stroke={degrees === 0 ? "#9ca3af" : "#e5e7eb"}
            />

            <text
              x={PLOT_LEFT - 5}
              y={phaseY(degrees) + 4}
              fontSize="11"
              textAnchor="end"
              fill="#6b7280"
            >
              {degrees}
            </text>
          </g>
        ))}

        {decadeTicks.map((tick) => (
          <line
            key={tick}
            x1={toX(tick)}
            y1={phaseY(90)}
            x2={toX(tick)}
            y2={phaseY(-90)}
            stroke="#f3f4f6"
          />
        ))}

        {markerInside ? (
          <line
            x1={toX(frequency)}
            y1={phaseY(90)}
            x2={toX(frequency)}
            y2={phaseY(-90)}
            stroke={MARKER_COLOR}
            strokeDasharray="4 3"
          />
        ) : null}

        {resonance !== null ? (
          <line
            x1={toX(resonance)}
            y1={phaseY(90)}
            x2={toX(resonance)}
            y2={phaseY(-90)}
            stroke={PHASE_COLOR}
            strokeDasharray="2 3"
          />
        ) : null}

        <path
          d={phasePath}
          fill="none"
          stroke={PHASE_COLOR}
          strokeWidth={2}
        />
      </svg>

      <p
        style={{
          margin: "6px 0 0",
          fontSize: "13px",
        }}
      >
        {resonance !== null ? (
          <>
            Ressonância (fase = 0°):{" "}
            <strong>f₀ ≈ {formatFrequency(resonance)}</strong>.{" "}
          </>
        ) : (
          "Sem ressonância na faixa (a fase não cruza 0°). "
        )}
        {markerInside
          ? `A linha cinza tracejada é a frequência atual (${formatFrequency(frequency)}).`
          : ""}
      </p>
    </div>
  );
}
