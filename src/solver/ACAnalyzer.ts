import type { CircuitResult } from "../core/CircuitResult";

import { Complex } from "../math/Complex";

import { SeriesSolver } from "./SeriesSolver";
import { PowerCalculator } from "./PowerCalculator";

export class ACAnalyzer {

  static analyzeSeriesCircuit(
    voltage: number,
    impedances: Complex[]
  ): CircuitResult {

    const zeq =
      SeriesSolver.calculate(
        impedances
      );

    const current =
      new Complex(
        voltage,
        0
      ).divide(zeq);

    const power =
      PowerCalculator.calculateComplexPower(
        new Complex(
          voltage,
          0
        ),
        current
      );

    return {

      zeq,

      current,

      activePower:
        PowerCalculator.calculateActivePower(
          power
        ),

      reactivePower:
        PowerCalculator.calculateReactivePower(
          power
        ),

      apparentPower:
        PowerCalculator.calculateApparentPower(
          power
        ),

      powerFactor:
        PowerCalculator.calculatePowerFactor(
          power
        )

    };

  }

}