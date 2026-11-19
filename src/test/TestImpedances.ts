import { Node } from "../core/Node";

import { Resistor } from "../elements/Resistor";
import { Capacitor } from "../elements/Capacitor";
import { Inductor } from "../elements/Inductor";

const n1 = new Node("N1");
const n2 = new Node("N2");

const resistor =
  new Resistor(
    "R1",
    n1,
    n2,
    100
  );

const capacitor =
  new Capacitor(
    "C1",
    n1,
    n2,
    0.0001
  );

const indutor =
  new Inductor(
    "L1",
    n1,
    n2,
    0.1
  );

const f = 60;

console.log("==========");

console.log(
  "ZR =",
  resistor
    .getImpedance(f)
    .toString()
);

console.log(
  "ZC =",
  capacitor
    .getImpedance(f)
    .toString()
);

console.log(
  "ZL =",
  indutor
    .getImpedance(f)
    .toString()
);

console.log("==========");
