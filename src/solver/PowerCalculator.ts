import { Complex } from "../math/Complex";

export class PowerCalculator {

  static calculateComplexPower(
    voltage: Complex,
    current: Complex
  ): Complex {

    return voltage.multiply(
      current.conjugate()
    );

  }

  static calculateActivePower(
    power: Complex
  ): number {

    return power.real;

  }

  static calculateReactivePower(
    power: Complex
  ): number {

    return power.imag;

  }

  static calculateApparentPower(
    power: Complex
  ): number {

    return power.magnitude();

  }

  static calculatePowerFactor(
    power: Complex
  ): number {

    return (
      power.real /
      power.magnitude()
    );

  }

}