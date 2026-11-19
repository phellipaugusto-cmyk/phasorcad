import { Complex } from "../math/Complex";
import { Phasor } from "../phasors/Phasor";

const current =
  new Complex(
    2.178273335480803,
    -0.2427813955274132
  );

const phasor =
  Phasor.fromComplex(
    current
  );

console.log(
  "==== TESTE PHASOR REVERSE ===="
);

console.log(
  "Magnitude =",
  phasor.magnitude
);

console.log(
  "Fasor =",
  phasor.toString()
);