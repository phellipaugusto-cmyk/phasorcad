import type {
  CircuitElement,
} from "../core/CircuitElement";

import {
  createCircuitTerminals,
} from "../core/CircuitTerminal";

export const defaultCircuit: CircuitElement[] = [
  {
    id: "V1",
    type: "source",
    label: "V1",
    value: 220,
    x: 20,
    y: 100,
    terminals:
      createCircuitTerminals(
        "V1"
      ),
  },

  {
    id: "R1",
    type: "resistor",
    label: "R1",
    value: 100,
    x: 120,
    y: 100,
    terminals:
      createCircuitTerminals(
        "R1"
      ),
  },

  {
    id: "C1",
    type: "capacitor",
    label: "C1",
    value: 0.0001,
    x: 270,
    y: 100,
    terminals:
      createCircuitTerminals(
        "C1"
      ),
  },

  {
    id: "L1",
    type: "inductor",
    label: "L1",
    value: 0.1,
    x: 420,
    y: 100,
    terminals:
      createCircuitTerminals(
        "L1"
      ),
  },
];