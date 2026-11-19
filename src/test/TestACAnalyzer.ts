import { ACAnalyzer } from "../solver/ACAnalyzer";
import { Complex } from "../math/Complex";

const result =
  ACAnalyzer.analyzeSeriesCircuit(
    220,
    [
      new Complex(100, 0),
      new Complex(0, -26.525823848649225),
      new Complex(0, 37.69911184307752)
    ]
  );

console.log(
  "==== TESTE AC ANALYZER ===="
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