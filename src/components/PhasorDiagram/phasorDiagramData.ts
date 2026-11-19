import type {
  CircuitElement,
  CircuitElementType,
} from "../../core/CircuitElement";

import type {
  MnaElectricalResults,
} from "../../core/MnaElectricalResults";

export type PhasorQuantity =
  | "voltage"
  | "current";

export interface PhasorEntry {
  elementId: string;

  label: string;

  type: CircuitElementType;

  real: number;

  imaginary: number;

  /*
   * Ponto onde a seta começa no modo "soma" (potencial de um
   * nó, com a referência na origem). A ponta fica em
   * start + (real, imaginary). Para correntes é sempre (0, 0).
   */
  startReal: number;

  startImaginary: number;

  magnitude: number;

  /* Ângulo em graus, entre -180 e 180. */
  angleDegrees: number;
}

const EPSILON = 1e-9;

function toDegrees(
  radians: number
): number {
  const degrees =
    (radians * 180) / Math.PI;

  /* Evita "-0" e ruído numérico como 1e-14. */
  return Math.abs(degrees) < 1e-9
    ? 0
    : degrees;
}

/*
 * Monta os fasores de tensão ou de corrente de cada elemento
 * a partir dos resultados do MNA.
 *
 * Convenção: passivos usam o sentido from → to do solver.
 * A fonte usa a convenção de gerador: a tensão aponta para
 * o sentido positivo (referência) e a corrente é a que ela
 * entrega ao circuito. O sinal depende de qual terminal virou
 * o nó de referência, então os dois são normalizados juntos
 * (a defasagem entre tensão e corrente é preservada).
 */
export function buildPhasorEntries(
  results: MnaElectricalResults,
  elements: CircuitElement[],
  quantity: PhasorQuantity
): PhasorEntry[] {
  if (!results.available) {
    return [];
  }

  const entries: PhasorEntry[] = [];

  const nodePotential = (
    nodeId: string
  ) =>
    results.nodeVoltages.find(
      (node) =>
        node.nodeId === nodeId
    )?.voltage ?? {
      real: 0,
      imaginary: 0,
    };

  results.elementResults.forEach(
    (result) => {
      if (result.isBypassed) {
        return;
      }

      const element =
        elements.find(
          (item) =>
            item.id ===
            result.elementId
        );

      /*
       * Fonte: o ramo traz o sinal oposto ao do gerador. Gira o
       * fasor de referência (tensão, ou corrente numa fonte de
       * corrente) pelo ângulo de fase da fonte e vira o sinal
       * quando ele aponta contra o sentido esperado.
       */
      const phase =
        ((element?.phase ?? 0) *
          Math.PI) /
        180;

      const reference =
        result.elementType ===
        "currentSource"
          ? result.current
          : result.voltage;

      const sign =
        result.isSource &&
        reference.real *
          Math.cos(phase) +
          reference.imaginary *
            Math.sin(phase) <
          0
          ? -1
          : 1;

      const value =
        quantity === "voltage"
          ? result.voltage
          : result.current;

      const real =
        value.real * sign;

      const imaginary =
        value.imaginary * sign;

      const magnitude = Math.hypot(
        real,
        imaginary
      );

      /*
       * tensão = V(from) - V(to). A seta vai de V(to) até
       * V(from); se o sinal foi invertido (fonte), vai de
       * V(from) até V(to). Assim as setas se encadeiam do
       * nó de referência até a tensão da fonte.
       */
      const start =
        quantity === "voltage"
          ? nodePotential(
              sign === 1
                ? result.toNodeId
                : result.fromNodeId
            )
          : { real: 0, imaginary: 0 };

      entries.push({
        elementId:
          result.elementId,

        label:
          element?.label ??
          result.elementId,

        type: result.elementType,

        real,

        imaginary,

        startReal: start.real,

        startImaginary:
          start.imaginary,

        magnitude,

        angleDegrees:
          magnitude < EPSILON
            ? 0
            : toDegrees(
                Math.atan2(
                  imaginary,
                  real
                )
              ),
      });
    }
  );

  return entries;
}
