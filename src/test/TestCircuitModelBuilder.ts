import { defaultCircuitModel } from "../data/defaultCircuitModel";

import { CircuitBuilder } from "../solver/CircuitBuilder";

const impedances =
  CircuitBuilder.buildImpedances(
    defaultCircuitModel,
    60
  );

console.log(
  "==== TESTE CIRCUIT BUILDER ===="
);

impedances.forEach(
  (impedance, index) => {

    console.log(
      `Z${index + 1} =`,
      impedance.toString()
    );

  }
);