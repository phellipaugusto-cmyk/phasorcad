export class Complex {
  real: number;
  imag: number;

  constructor(real: number, imag: number) {
    this.real = real;
    this.imag = imag;
  }

  add(other: Complex): Complex {
    return new Complex(
      this.real + other.real,
      this.imag + other.imag
    );
  }

  subtract(other: Complex): Complex {
    return new Complex(
      this.real - other.real,
      this.imag - other.imag
    );
  }

  multiply(other: Complex): Complex {
    return new Complex(
      this.real * other.real -
        this.imag * other.imag,

      this.real * other.imag +
        this.imag * other.real
    );
  }

  divide(other: Complex): Complex {
    const denominator =
      other.real * other.real +
      other.imag * other.imag;

    return new Complex(
      (
        this.real * other.real +
        this.imag * other.imag
      ) / denominator,

      (
        this.imag * other.real -
        this.real * other.imag
      ) / denominator
    );
  }

  conjugate(): Complex {
    return new Complex(
      this.real,
      -this.imag
    );
  }

  magnitude(): number {
    return Math.sqrt(
      this.real * this.real +
      this.imag * this.imag
    );
  }

  angle(): number {
    return (
      Math.atan2(
        this.imag,
        this.real
      ) *
      180 /
      Math.PI
    );
  }

  toString(): string {
    const imagAbs =
      Math.abs(this.imag);

    if (this.imag >= 0) {
      return `${this.real} + j${imagAbs}`;
    }

    return `${this.real} - j${imagAbs}`;
  }

  toFormattedString(
    decimals: number = 2
  ): string {

    const real =
      this.real.toFixed(decimals);

    const imag =
      Math.abs(this.imag)
        .toFixed(decimals);

    if (this.imag >= 0) {
      return `${real} + j${imag}`;
    }

    return `${real} - j${imag}`;
  }
}