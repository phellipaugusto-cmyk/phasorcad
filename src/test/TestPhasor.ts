import { Phasor } from "../phasors/Phasor";

const v1 =
  new Phasor(
    220,
    0
  );

const v2 =
  new Phasor(
    220,
    30
  );

console.log(
  "==== TESTE PHASOR ===="
);

console.log(
  "220∠0° =",
  v1.toComplex().toString()
);

console.log(
  "220∠30° =",
  v2.toComplex().toString()
);