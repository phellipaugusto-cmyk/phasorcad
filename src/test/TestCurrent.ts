import { Complex } from "../math/Complex";

const voltage =
  new Complex(220, 0);

const zeq =
  new Complex(
    100,
    11.173287994428293
  );

const current =
  voltage.divide(zeq);

console.log(
  "==== TESTE CURRENT ===="
);

console.log(
  "I =",
  current.toString()
);

console.log(
  "|I| =",
  current.magnitude()
);

console.log(
  "Ângulo =",
  current.angle()
);