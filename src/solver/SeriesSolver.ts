import { Complex } from "../math/Complex";

export class SeriesSolver {

  static calculate(
    impedances: Complex[]
  ): Complex {

    let total =
      new Complex(0, 0);

    for (const z of impedances) {

      total =
        total.add(z);

    }

    return total;

  }

}