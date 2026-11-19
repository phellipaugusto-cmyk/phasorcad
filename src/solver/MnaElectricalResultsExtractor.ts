import { getMotorAdmittance } from "../core/motorModel";
import { getLampAdmittance } from "../core/lampModel";
import { getSwitchAdmittance } from "../core/switchModel";
import { getContactorAdmittance } from "../core/contactorModel";
import type {
  CircuitGraph,
} from "../core/CircuitGraph";

import {
  getSourcePhasor,
  isSourceType,
} from "../core/CircuitElement";

import type {
  CircuitElement,
} from "../core/CircuitElement";

import type {
  MnaElectricalResults,
  MnaElementElectricalResult,
  MnaNodeVoltageResult,
} from "../core/MnaElectricalResults";

import type {
  ModifiedNodalAnalysisStructure,
} from "../core/ModifiedNodalAnalysis";

import type {
  ComplexValue,
} from "../core/NodalAnalysis";

import type {
  ComplexLinearSystemSolution,
} from "../core/ComplexLinearSystem";

function createComplex(
  real = 0,
  imaginary = 0
): ComplexValue {
  return {
    real,
    imaginary,
  };
}

function subtract(
  first: ComplexValue,
  second: ComplexValue
): ComplexValue {
  return createComplex(
    first.real - second.real,
    first.imaginary - second.imaginary
  );
}

function multiply(
  first: ComplexValue,
  second: ComplexValue
): ComplexValue {
  return createComplex(
    first.real * second.real -
      first.imaginary * second.imaginary,

    first.real * second.imaginary +
      first.imaginary * second.real
  );
}

function conjugate(
  value: ComplexValue
): ComplexValue {
  return createComplex(
    value.real,
    -value.imaginary
  );
}

function magnitude(
  value: ComplexValue
): number {
  return Math.hypot(
    value.real,
    value.imaginary
  );
}

function getPassiveAdmittance(
  element: CircuitElement,
  frequency: number
): ComplexValue | null {
  const angularFrequency =
    2 * Math.PI * frequency;

  switch (element.type) {
    case "resistor":
      if (element.value <= 0) {
        return null;
      }

      return createComplex(
        1 / element.value,
        0
      );

    case "capacitor":
      if (
        element.value <= 0 ||
        angularFrequency <= 0
      ) {
        return null;
      }

      return createComplex(
        0,
        angularFrequency *
          element.value
      );

    case "inductor":
      if (
        element.value <= 0 ||
        angularFrequency <= 0
      ) {
        return null;
      }

      return createComplex(
        0,
        -1 /
          (
            angularFrequency *
            element.value
          )
      );


    case "motor": {
      const admittance = getMotorAdmittance(element, frequency);

      return admittance
        ? createComplex(admittance.real, admittance.imaginary)
        : null;
    }

    case "lamp": {
      const admittance = getLampAdmittance(element);

      return admittance
        ? createComplex(admittance.real, admittance.imaginary)
        : null;
    }

    case "switch": {
      const admittance = getSwitchAdmittance(element);

      return admittance
        ? createComplex(admittance.real, admittance.imaginary)
        : null;
    }

    case "contactor": {
      const admittance = getContactorAdmittance(element, frequency);

      return admittance
        ? createComplex(admittance.real, admittance.imaginary)
        : null;
    }

    case "source":
    case "currentSource":
      return null;

    default:
      return null;
  }
}

function getNodeVoltage(
  nodeId: string,
  graph: CircuitGraph,
  structure:
    ModifiedNodalAnalysisStructure,
  solution:
    ComplexLinearSystemSolution
): ComplexValue {
  if (
    nodeId ===
    graph.referenceNodeId
  ) {
    return createComplex();
  }

  const variableId =
    `V(${nodeId})`;

  const index =
    structure.variableIndexById[
      variableId
    ];

  if (
    index === undefined ||
    !solution.values[index]
  ) {
    return createComplex();
  }

  return {
    ...solution.values[index],
  };
}

function getSourceCurrent(
  elementId: string,
  structure:
    ModifiedNodalAnalysisStructure,
  solution:
    ComplexLinearSystemSolution
): ComplexValue {
  const variableId =
    `I(${elementId})`;

  const index =
    structure.variableIndexById[
      variableId
    ];

  if (
    index === undefined ||
    !solution.values[index]
  ) {
    return createComplex();
  }

  return {
    ...solution.values[index],
  };
}

function createPowerData(
  voltage: ComplexValue,
  current: ComplexValue
): {
  complexPower: ComplexValue;
  apparentPower: number;
  powerFactor: number;
} {
  const complexPower =
    multiply(
      voltage,
      conjugate(
        current
      )
    );

  const apparentPower =
    magnitude(
      complexPower
    );

  const powerFactor =
    apparentPower > 1e-12
      ? Math.abs(
          complexPower.real
        ) /
        apparentPower
      : 0;

  return {
    complexPower,
    apparentPower,
    powerFactor,
  };
}

function createElementResult(
  element: CircuitElement,
  graph: CircuitGraph,
  structure:
    ModifiedNodalAnalysisStructure,
  solution:
    ComplexLinearSystemSolution,
  frequency: number
): MnaElementElectricalResult | null {
  const branch =
    graph.branches.find(
      (item) =>
        item.elementId ===
        element.id
    );

  if (!branch) {
    return null;
  }

  const fromVoltage =
    getNodeVoltage(
      branch.fromNodeId,
      graph,
      structure,
      solution
    );

  const toVoltage =
    getNodeVoltage(
      branch.toNodeId,
      graph,
      structure,
      solution
    );

  /*
   * Convenção passiva do ramo:
   * Vbranch = V(from) - V(to).
   * Ibranch é positivo de from para to.
   */
  const voltage =
    subtract(
      fromVoltage,
      toVoltage
    );

  let current =
    createComplex();

  if (branch.isBypassed) {
    current =
      createComplex();
  } else if (
    element.type ===
    "source"
  ) {
    current =
      getSourceCurrent(
        element.id,
        structure,
        solution
      );
  } else if (
    element.type ===
    "currentSource"
  ) {
    /*
     * Mesma convenção da fonte de tensão: a corrente do ramo
     * (from → to) é o oposto da corrente entregue ao circuito.
     */
    const phasor =
      getSourcePhasor(element);

    current = {
      real: -phasor.real,
      imaginary: -phasor.imaginary,
    };
  } else {
    const admittance =
      getPassiveAdmittance(
        element,
        frequency
      );

    if (admittance) {
      current =
        multiply(
          admittance,
          voltage
        );
    }
  }

  const passivePowerData =
    createPowerData(
      voltage,
      current
    );

  /*
   * Para componentes passivos, potência positiva
   * significa potência absorvida. Para a fonte,
   * mostramos potência entregue com sinal negativo.
   */
  const complexPower =
    isSourceType(element.type)
      ? {
          real:
            -passivePowerData.complexPower.real,

          imaginary:
            -passivePowerData.complexPower.imaginary,
        }
      : passivePowerData.complexPower;

  const apparentPower =
    passivePowerData.apparentPower;

  const powerFactor =
    passivePowerData.powerFactor;

  return {
    elementId:
      element.id,

    elementType:
      element.type,

    fromNodeId:
      branch.fromNodeId,

    toNodeId:
      branch.toNodeId,

    voltage,
    current,
    complexPower,
    apparentPower,
    powerFactor,

    isBypassed:
      branch.isBypassed,

    isSource:
      isSourceType(element.type),
  };
}

export class MnaElectricalResultsExtractor {
  static extract(
    graph: CircuitGraph,
    elements: CircuitElement[],
    structure:
      ModifiedNodalAnalysisStructure,
    solution:
      ComplexLinearSystemSolution,
    frequency: number
  ): MnaElectricalResults {
    if (!solution.success) {
      return {
        available:
          false,

        errorMessage:
          solution.errorMessage ??
          "A solução MNA não está disponível.",

        nodeVoltages:
          [],

        elementResults:
          [],
      };
    }

    const nodeVoltages:
      MnaNodeVoltageResult[] =
        graph.nodes.map(
          (node) => ({
            nodeId:
              node.id,

            voltage:
              getNodeVoltage(
                node.id,
                graph,
                structure,
                solution
              ),

            isReference:
              node.id ===
              graph.referenceNodeId,
          })
        );

    const elementResults =
      elements
        .map(
          (element) =>
            createElementResult(
              element,
              graph,
              structure,
              solution,
              frequency
            )
        )
        .filter(
          (
            result
          ): result is MnaElementElectricalResult =>
            result !== null
        );

    return {
      available:
        true,

      errorMessage:
        null,

      nodeVoltages,
      elementResults,
    };
  }
}
