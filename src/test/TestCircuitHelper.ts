import { defaultCircuitModel } from "../data/defaultCircuitModel";

import { CircuitHelper } from "../solver/CircuitHelper";

console.log(
  "==== TESTE CIRCUIT HELPER ===="
);

const voltage =
  CircuitHelper.getSourceVoltage(
    defaultCircuitModel
  );

console.log(
  "Tensão da fonte:",
  voltage
);