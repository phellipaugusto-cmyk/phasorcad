import { getMotorEquivalent } from "../core/motorModel";
import { getLampResistance } from "../core/lampModel";
import { getContactorAdmittance } from "../core/contactorModel";
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

        case "motor": {

          const equivalent = getMotorEquivalent(element);

          if (equivalent) {
            impedances.push(
              new Complex(
                equivalent.resistance,
                2 * Math.PI * frequency * equivalent.inductance
              )
            );
          }

          break;

        }

        case "lamp": {

          const resistance = getLampResistance(element);

          if (resistance) {
            impedances.push(new Complex(resistance, 0));
          }

          break;

        }

        case "contactor": {

          const y = getContactorAdmittance(element, frequency);

          if (y) {
            const d = y.real * y.real + y.imaginary * y.imaginary;
            impedances.push(new Complex(y.real / d, -y.imaginary / d));
          }

          break;

        }

        case "source":

          break;

      }

    }

    return impedances;

  }

}