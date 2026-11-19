import { Complex } from "../math/Complex";
import { PowerCalculator } from "../solver/PowerCalculator";

const voltage =
  new Complex(
    220,
    0
  );

const current =
  new Complex(
    2.178273335480803,
    -0.2427813955274132
  );

const power =
  PowerCalculator.calculateComplexPower(
    voltage,
    current
  );

console.log(
  "==== TESTE POWER DETAILS ===="
);

console.log(
  "P =",
  PowerCalculator.calculateActivePower(
    power
  )
);

console.log(
  "Q =",
  PowerCalculator.calculateReactivePower(
    power
  )
);

console.log(
  "S =",
  PowerCalculator.calculateApparentPower(
    power
  )
);

console.log(
  "FP =",
  PowerCalculator.calculatePowerFactor(
    power
  )
);