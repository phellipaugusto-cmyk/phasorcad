import { Complex } from "../math/Complex";

export class Phasor {

  magnitude: number;
  angle: number;

  constructor(
    magnitude: number,
    angle: number
  ) {
    this.magnitude = magnitude;
    this.angle = angle;
  }

  toComplex(): Complex {

    const radians =
      this.angle *
      Math.PI /
      180;

    return new Complex(
      this.magnitude *
        Math.cos(radians),

      this.magnitude *
        Math.sin(radians)
    );

  }

    static fromComplex(
    value: Complex
  ): Phasor {

    return new Phasor(
      value.magnitude(),
      value.angle()
    );

  }

  toString(): string {

    return `${this.magnitude.toFixed(2)}∠${this.angle.toFixed(2)}°`;

  }

}

