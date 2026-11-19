import { defaultCircuitModel } from "../data/defaultCircuitModel";

import { CircuitBuilder } from "../solver/CircuitBuilder";

import { ACAnalyzer } from "../solver/ACAnalyzer";

const impedances =
  CircuitBuilder.buildImpedances(
    defaultCircuitModel,
    60
  );

const result =
  ACAnalyzer.analyzeSeriesCircuit(
    220,
    impedances
  );

console.log(
  "==== TESTE CIRCUIT ANALYZER ===="
);

console.log(
  "Zeq =",
  result.zeq.toString()
);

console.log(
  "I =",
  result.current.toString()
);

console.log(
  "P =",
  result.activePower
);

console.log(
  "Q =",
  result.reactivePower
);

console.log(
  "S =",
  result.apparentPower
);

console.log(
  "FP =",
  result.powerFactor
);