import type { Circuit } from "../core/Circuit";

export class CircuitHelper {

  static getSourceVoltage(
    circuit: Circuit
  ): number {

    const source =
      circuit.elements.find(
        element =>
          element.type === "source"
      );

    return source?.value ?? 0;

  }

}