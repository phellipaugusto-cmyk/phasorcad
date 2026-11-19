import type { Circuit } from "../core/Circuit";

import { Complex } from "../math/Complex";

export class CircuitBuilder {

  static buildImpedances(
    circuit: Circuit,
    frequency: number
  ): Complex[] {

    const impedances: Complex[] = [];

    for (const element of circuit.elements) {

      switch (element.type) {

        case "resistor":

          impedances.push(
            new Complex(
              element.value,
              0
            )
          );

          break;

        case "capacitor": {

          const omega =
            2 * Math.PI * frequency;

          impedances.push(
            new Complex(
              0,
              -1 / (
                omega *
                element.value
              )
            )
          );

          break;

        }

        case "inductor": {

          const omega =
            2 * Math.PI * frequency;

          impedances.push(
            new Complex(
              0,
              omega *
              element.value
            )
          );

          break;

        }

        case "source":

          break;

      }

    }

    return impedances;

  }

}