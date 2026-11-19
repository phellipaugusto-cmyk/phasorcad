import type {
  CircuitConnection,
} from "../core/CircuitConnection";

import type {
  CircuitElement,
} from "../core/CircuitElement";

import {
  createCircuitTerminals,
} from "../core/CircuitTerminal";

import {
  CircuitGraphBuilder,
} from "../solver/CircuitGraphBuilder";

const elements:
  CircuitElement[] = [
    {
      id:
        "V1",

      type:
        "source",

      label:
        "V1",

      value:
        220,

      x:
        0,

      y:
        0,

      terminals:
        createCircuitTerminals(
          "V1"
        ),
    },

    {
      id:
        "R1",

      type:
        "resistor",

      label:
        "R1",

      value:
        100,

      x:
        100,

      y:
        0,

      terminals:
        createCircuitTerminals(
          "R1"
        ),
    },

    {
      id:
        "C1",

      type:
        "capacitor",

      label:
        "C1",

      value:
        100 / 1_000_000,

      x:
        200,

      y:
        0,

      terminals:
        createCircuitTerminals(
          "C1"
        ),
    },
  ];

const connections:
  CircuitConnection[] = [
    {
      id:
        "connection-V1-R1",

      fromTerminalId:
        "V1:right",

      toTerminalId:
        "R1:left",
    },

    {
      id:
        "connection-R1-C1",

      fromTerminalId:
        "R1:right",

      toTerminalId:
        "C1:left",
    },
  ];

const graph =
  CircuitGraphBuilder.build(
    elements,
    connections
  );

console.log(
  "==== TESTE CIRCUIT GRAPH ===="
);

console.log(
  "Nós:"
);

graph.nodes.forEach(
  (node) => {
    console.log(
      node.id,
      node.terminalIds
    );
  }
);

console.log(
  "Ramos:"
);

graph.branches.forEach(
  (branch) => {
    console.log(
      `${branch.elementId}: ` +
      `${branch.fromNodeId} -> ` +
      `${branch.toNodeId}`
    );
  }
);

console.log(
  "Terminais por nó:"
);

console.log(
  graph.terminalToNodeId
);