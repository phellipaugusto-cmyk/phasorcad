import {
  useState,
} from "react";

import type {
  CircuitElement,
  CircuitElementType,
} from "../../core/CircuitElement";

import type {
  MnaElectricalResults,
} from "../../core/MnaElectricalResults";

import { AnimateToggle } from "../Canvas/AnimateToggle";
import { useAnimationClock } from "../Canvas/animationClock";

import {
  buildPhasorEntries,
  type PhasorQuantity,
} from "./phasorDiagramData";

interface PhasorDiagramProps {
  results: MnaElectricalResults;

  elements: CircuitElement[];

  selectedElementId: string | null;
}

const SIZE = 320;

const CENTER = SIZE / 2;

const RADIUS = 120;

const COLORS: Record<
  CircuitElementType,
  string
> = {
  source: "#15803d",
  currentSource: "#0d9488",
  resistor: "#2563eb",
  capacitor: "#ea580c",
  inductor: "#9333ea",
  motor: "#b45309",
  lamp: "#ca8a04",
  switch: "#475569",
  contactor: "#7c3aed",
  impedance: "#0f766e",
};

const UNITS: Record<
  PhasorQuantity,
  string
> = {
  voltage: "V",
  current: "A",
};

/* Arredonda o fundo de escala para um valor "redondo" logo acima do máximo. */
const NICE_STEPS = [
  1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10,
];

function getNiceScale(
  maximum: number
): number {
  if (maximum <= 0) {
    return 1;
  }

  const exponent = Math.floor(
    Math.log10(maximum)
  );

  const base = 10 ** exponent;

  const fraction = maximum / base;

  const nice =
    NICE_STEPS.find(
      (step) => step >= fraction - 1e-9
    ) ?? 10;

  return nice * base;
}

function formatNumber(
  value: number
): string {
  return Number(
    value.toPrecision(3)
  ).toString();
}

export function PhasorDiagram({
  results,
  elements,
  selectedElementId,
}: PhasorDiagramProps) {
  const [quantity, setQuantity] =
    useState<PhasorQuantity>(
      "voltage"
    );

  const [isChained, setIsChained] =
    useState(false);

  /* Animação: todo o diagrama gira à frequência angular ω (câmera lenta). */
  const clock = useAnimationClock();
  const spin = clock.running ? clock.phase : 0;
  const cosSpin = Math.cos(spin);
  const sinSpin = Math.sin(spin);
  const rotate = (real: number, imaginary: number) => ({
    real: real * cosSpin - imaginary * sinSpin,
    imaginary: real * sinSpin + imaginary * cosSpin,
  });

  const entries =
    buildPhasorEntries(
      results,
      elements,
      quantity
    );

  const unit = UNITS[quantity];

  /* O modo soma só faz sentido para tensões (potenciais dos nós). */
  const chained =
    isChained &&
    quantity === "voltage";

  const maximum = Math.max(
    0,
    ...entries.map((entry) =>
      chained
        ? Math.max(
            Math.hypot(
              entry.startReal,
              entry.startImaginary
            ),
            Math.hypot(
              entry.startReal +
                entry.real,
              entry.startImaginary +
                entry.imaginary
            )
          )
        : entry.magnitude
    )
  );

  const scale = getNiceScale(
    maximum
  );

  const pixelsPerUnit =
    RADIUS / scale;

  const placedLabels: {
    x: number;
    y: number;
  }[] = [];

  return (
    <section
      style={{
        marginBottom: "16px",
      }}
    >
      <h3
        style={{
          margin: "0 0 8px",
        }}
      >
        Diagrama Fasorial
        <span style={{ float: "right", fontSize: "13px", fontWeight: 400 }}>
          <AnimateToggle />
        </span>
      </h3>

      <div
        style={{
          display: "flex",
          justifyContent:
            "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        {(
          [
            ["voltage", "Tensões"],
            ["current", "Correntes"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() =>
              setQuantity(key)
            }
            style={{
              fontWeight:
                quantity === key
                  ? 700
                  : 400,
              background:
                quantity === key
                  ? "#dbeafe"
                  : undefined,
            }}
          >
            {text}
          </button>
        ))}
      </div>

      {quantity === "voltage" ? (
        <div
          style={{
            display: "flex",
            justifyContent:
              "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {(
            [
              [false, "Origem comum"],
              [true, "Soma (ponta a ponta)"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={text}
              type="button"
              onClick={() =>
                setIsChained(value)
              }
              style={{
                fontSize: "12px",
                fontWeight:
                  isChained === value
                    ? 700
                    : 400,
                background:
                  isChained === value
                    ? "#dbeafe"
                    : undefined,
              }}
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#6b7280",
          }}
        >
          Sem fasores: o circuito
          precisa estar fechado.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width="100%"
            style={{
              maxWidth: "360px",
              display: "block",
              margin: "0 auto",
            }}
            role="img"
            aria-label="Diagrama fasorial"
          >
            <defs>
              {(
                Object.keys(
                  COLORS
                ) as CircuitElementType[]
              ).map((type) => (
                <marker
                  key={type}
                  id={`phasor-arrow-${type}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerUnits="userSpaceOnUse"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 0 0 L 10 5 L 0 10 z"
                    fill={COLORS[type]}
                  />
                </marker>
              ))}
            </defs>

            {[0.5, 1].map(
              (fraction) => (
                <g key={fraction}>
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={
                      RADIUS *
                      fraction
                    }
                    fill="none"
                    stroke="#d1d5db"
                    strokeDasharray="3 3"
                  />

                  <text
                    x={
                      CENTER -
                      RADIUS *
                        fraction *
                        0.7071 -
                      3
                    }
                    y={
                      CENTER +
                      RADIUS *
                        fraction *
                        0.7071 +
                      12
                    }
                    fontSize="14"
                    textAnchor="end"
                    fill="#6b7280"
                  >
                    {formatNumber(
                      scale *
                        fraction
                    )}{" "}
                    {unit}
                  </text>
                </g>
              )
            )}

            <line
              x1={CENTER - RADIUS - 10}
              y1={CENTER}
              x2={CENTER + RADIUS + 10}
              y2={CENTER}
              stroke="#6b7280"
            />

            <line
              x1={CENTER}
              y1={CENTER + RADIUS + 10}
              x2={CENTER}
              y2={CENTER - RADIUS - 10}
              stroke="#6b7280"
            />

            <text
              x={SIZE - 2}
              y={CENTER - 8}
              fontSize="14"
              textAnchor="end"
              fill="#6b7280"
            >
              Re
            </text>

            <text
              x={CENTER + 4}
              y={12}
              fontSize="14"
              fill="#6b7280"
            >
              Im
            </text>

            {entries
              .filter(
                (entry) =>
                  entry.magnitude >
                  1e-9
              )
              .map((entry) => {
                const startRotated = rotate(
                  chained ? entry.startReal : 0,
                  chained ? entry.startImaginary : 0
                );
                const vectorRotated = rotate(
                  entry.real,
                  entry.imaginary
                );
                const startReal = startRotated.real;
                const startImaginary = startRotated.imaginary;

                const startX =
                  CENTER +
                  startReal *
                    pixelsPerUnit;

                const startY =
                  CENTER -
                  startImaginary *
                    pixelsPerUnit;

                const tipX =
                  startX +
                  vectorRotated.real * pixelsPerUnit;

                const tipY =
                  startY -
                  vectorRotated.imaginary * pixelsPerUnit;

                const isSelected =
                  entry.elementId ===
                  selectedElementId;

                /*
                 * O rótulo fica além da ponta, na direção do fasor,
                 * para nunca cair em cima da própria seta.
                 */
                const length =
                  Math.hypot(
                    tipX - startX,
                    tipY - startY
                  ) || 1;

                const directionX =
                  (tipX - startX) /
                  length;

                const directionY =
                  (tipY - startY) /
                  length;

                let labelX: number;

                let labelY: number;

                if (chained) {
                  /*
                   * Setas encadeadas: o rótulo fica no meio da
                   * seta, do lado oposto à origem, para não
                   * cair sobre a seta seguinte.
                   */
                  const middleX =
                    (startX + tipX) /
                    2;

                  const middleY =
                    (startY + tipY) /
                    2;

                  let normalX =
                    -directionY;

                  let normalY =
                    directionX;

                  if (
                    normalX *
                      (middleX -
                        CENTER) +
                      normalY *
                        (middleY -
                          CENTER) <
                    0
                  ) {
                    normalX =
                      -normalX;

                    normalY =
                      -normalY;
                  }

                  labelX =
                    middleX +
                    normalX * 16;

                  labelY =
                    middleY +
                    normalY * 16 +
                    5;
                } else {
                  labelX =
                    tipX +
                    directionX * 18;

                  labelY =
                    tipY +
                    directionY * 14 +
                    5;
                }

                /* Mantém o rótulo dentro do desenho quando o fasor gira. */
                labelX = Math.min(SIZE - 18, Math.max(18, labelX));
                labelY = Math.min(SIZE - 6, Math.max(32, labelY));

                /* Empilha rótulos que cairiam um sobre o outro. */
                while (
                  placedLabels.some(
                    (placed) =>
                      Math.abs(
                        placed.x -
                          labelX
                      ) < 44 &&
                      Math.abs(
                        placed.y -
                          labelY
                      ) < 17
                  )
                ) {
                  labelY -= 17;
                }

                placedLabels.push({
                  x: labelX,
                  y: labelY,
                });

                return (
                  <g
                    key={
                      entry.elementId
                    }
                  >
                    <line
                      x1={startX}
                      y1={startY}
                      x2={tipX}
                      y2={tipY}
                      stroke={
                        COLORS[
                          entry.type
                        ]
                      }
                      strokeWidth={2.5 + (isSelected ? 1.5 : 0)}
                      markerEnd={`url(#phasor-arrow-${entry.type})`}
                    />

                    {clock.running ? (
                      <g pointerEvents="none">
                        <line
                          x1={tipX}
                          y1={tipY}
                          x2={tipX}
                          y2={CENTER}
                          stroke={COLORS[entry.type]}
                          strokeOpacity="0.55"
                          strokeDasharray="3 3"
                        />
                        <circle
                          cx={tipX}
                          cy={CENTER}
                          r="4"
                          fill="#fff"
                          stroke={COLORS[entry.type]}
                          strokeWidth="2"
                        />
                      </g>
                    ) : null}

                    <text
                      x={labelX}
                      y={labelY}
                      fontSize="16"
                      fontWeight={
                        isSelected
                          ? 700
                          : 600
                      }
                      textAnchor="middle"
                      fill={
                        COLORS[
                          entry.type
                        ]
                      }
                    >
                      {entry.label}
                    </text>
                  </g>
                );
              })}
          </svg>

          <table
            style={{
              margin: "8px auto 0",
              fontSize: "13px",
              borderCollapse:
                "collapse",
            }}
          >
            <tbody>
              {entries.map(
                (entry) => (
                  <tr
                    key={
                      entry.elementId
                    }
                    style={{
                      fontWeight:
                        entry.elementId ===
                        selectedElementId
                          ? 700
                          : 400,
                    }}
                  >
                    <td
                      style={{
                        color:
                          COLORS[
                            entry
                              .type
                          ],
                        paddingRight:
                          "12px",
                      }}
                    >
                      {entry.label}
                    </td>

                    <td>
                      {entry.magnitude.toFixed(
                        2
                      )}{" "}
                      {unit} ∠{" "}
                      {entry.angleDegrees.toFixed(
                        1
                      )}
                      °
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
