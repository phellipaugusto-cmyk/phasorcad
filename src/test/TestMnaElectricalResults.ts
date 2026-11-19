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

import {
  ModifiedNodalAnalysisBuilder,
} from "../solver/ModifiedNodalAnalysisBuilder";

import {
  ComplexLinearSolver,
} from "../solver/ComplexLinearSolver";

import {
  MnaElectricalResultsExtractor,
} from "../solver/MnaElectricalResultsExtractor";

const frequency = 60;

const elements:
  CircuitElement[] = [
    {
      id: "V1",
      type: "source",
      label: "V1",
      value: 127,
      x: 0,
      y: 0,
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
      x: 100,
      y: 0,
      terminals:
        createCircuitTerminals(
          "R1"
        ),
    },

    {
      id: "C1",
      type: "capacitor",
      label: "C1",
      value:
        100 / 1_000_000,
      x: 200,
      y: 0,
      terminals:
        createCircuitTerminals(
          "C1"
        ),
    },
  ];

const connections:
  CircuitConnection[] = [
    {
      id: "connection-V1-R1",
      fromTerminalId:
        "V1:right",
      toTerminalId:
        "R1:left",
    },

    {
      id: "connection-R1-V1",
      fromTerminalId:
        "R1:right",
      toTerminalId:
        "V1:left",
    },

    {
      id: "connection-C1-left",
      fromTerminalId:
        "C1:left",
      toTerminalId:
        "V1:right",
    },

    {
      id: "connection-C1-right",
      fromTerminalId:
        "C1:right",
      toTerminalId:
        "R1:left",
    },
  ];

const graph =
  CircuitGraphBuilder.build(
    elements,
    connections
  );

const structure =
  ModifiedNodalAnalysisBuilder.build(
    graph,
    elements,
    frequency
  );

const solution =
  ComplexLinearSolver.solve(
    structure.matrix.map(
      (row) =>
        row.values
    ),
    structure.rightHandSide
  );

const results =
  MnaElectricalResultsExtractor.extract(
    graph,
    elements,
    structure,
    solution,
    frequency
  );

console.log(
  "==== RESULTADOS ELETRICOS MNA ===="
);

console.log(
  "Disponivel:",
  results.available
);

console.log(
  "Tensoes nodais:"
);

results.nodeVoltages.forEach(
  (node) => {
    console.log(
      node.nodeId,
      node.voltage,
      node.isReference
        ? "GND"
        : ""
    );
  }
);

console.log(
  "Resultados por componente:"
);

results.elementResults.forEach(
  (element) => {
    console.log({
      elementId:
        element.elementId,
      voltage:
        element.voltage,
      current:
        element.current,
      complexPower:
        element.complexPower,
      apparentPower:
        element.apparentPower,
      powerFactor:
        element.powerFactor,
      isBypassed:
        element.isBypassed,
    });
  }
);
