import { getMotorAdmittance } from "../core/motorModel";
import { getLampAdmittance } from "../core/lampModel";
import { getSwitchAdmittance } from "../core/switchModel";
import type {
  CircuitGraph,
  CircuitGraphBranch,
} from "../core/CircuitGraph";
import { isSourceType } from "../core/CircuitElement";
import type { CircuitElement } from "../core/CircuitElement";
import type {
  ComplexValue,
  NodalAnalysisStructure,
  NodalBranchStamp,
  NodalMatrixRow,
} from "../core/NodalAnalysis";

function createComplexValue(
  real = 0,
  imaginary = 0
): ComplexValue {
  return {
    real,
    imaginary,
  };
}

function addComplexValue(
  target: ComplexValue,
  value: ComplexValue
): void {
  target.real += value.real;
  target.imaginary += value.imaginary;
}

function subtractComplexValue(
  target: ComplexValue,
  value: ComplexValue
): void {
  target.real -= value.real;
  target.imaginary -= value.imaginary;
}

function getPassiveAdmittance(
  element: CircuitElement,
  frequency: number
): ComplexValue | null {
  const angularFrequency =
    2 *
    Math.PI *
    frequency;

  switch (element.type) {
    case "resistor": {
      if (element.value <= 0) {
        return null;
      }

      return createComplexValue(
        1 / element.value,
        0
      );
    }

    case "capacitor": {
      if (
        element.value <= 0 ||
        angularFrequency <= 0
      ) {
        return null;
      }

      return createComplexValue(
        0,
        angularFrequency *
          element.value
      );
    }

    case "inductor": {
      if (
        element.value <= 0 ||
        angularFrequency <= 0
      ) {
        return null;
      }

      return createComplexValue(
        0,
        -1 /
          (
            angularFrequency *
            element.value
          )
      );
    }
    case "motor": {
      const admittance = getMotorAdmittance(element, frequency);

      return admittance
        ? createComplexValue(admittance.real, admittance.imaginary)
        : null;
    }

    case "lamp": {
      const admittance = getLampAdmittance(element);

      return admittance
        ? createComplexValue(admittance.real, admittance.imaginary)
        : null;
    }

    case "switch": {
      const admittance = getSwitchAdmittance(element);

      return admittance
        ? createComplexValue(admittance.real, admittance.imaginary)
        : null;
    }

    case "source":
      return null;

    default:
      return null;
  }
}

function createEmptyMatrix(
  unknownNodeIds: string[]
): NodalMatrixRow[] {
  return unknownNodeIds.map(
    (nodeId) => ({
      nodeId,
      values:
        unknownNodeIds.map(
          () =>
            createComplexValue()
        ),
    })
  );
}

function stampPassiveBranch(
  matrix: NodalMatrixRow[],
  nodeIndexById:
    Record<string, number>,
  referenceNodeId: string | null,
  branch: CircuitGraphBranch,
  admittance: ComplexValue
): void {
  const fromIsReference =
    branch.fromNodeId ===
    referenceNodeId;

  const toIsReference =
    branch.toNodeId ===
    referenceNodeId;

  const fromIndex =
    nodeIndexById[
      branch.fromNodeId
    ];

  const toIndex =
    nodeIndexById[
      branch.toNodeId
    ];

  if (!fromIsReference) {
    addComplexValue(
      matrix[fromIndex]
        .values[fromIndex],
      admittance
    );
  }

  if (!toIsReference) {
    addComplexValue(
      matrix[toIndex]
        .values[toIndex],
      admittance
    );
  }

  if (
    !fromIsReference &&
    !toIsReference
  ) {
    subtractComplexValue(
      matrix[fromIndex]
        .values[toIndex],
      admittance
    );

    subtractComplexValue(
      matrix[toIndex]
        .values[fromIndex],
      admittance
    );
  }
}

export class AdmittanceMatrixBuilder {
  static build(
    graph: CircuitGraph,
    elements: CircuitElement[],
    frequency: number
  ): NodalAnalysisStructure {
    const referenceNodeId =
      graph.referenceNodeId;

    const unknownNodeIds =
      graph.nodes
        .map(
          (node) =>
            node.id
        )
        .filter(
          (nodeId) =>
            nodeId !==
            referenceNodeId
        );

    const nodeIndexById:
      Record<string, number> =
        {};

    unknownNodeIds.forEach(
      (nodeId, index) => {
        nodeIndexById[
          nodeId
        ] = index;
      }
    );

    const admittanceMatrix =
      createEmptyMatrix(
        unknownNodeIds
      );

    const elementById =
      new Map(
        elements.map(
          (element) => [
            element.id,
            element,
          ]
        )
      );

    const passiveBranchStamps:
      NodalBranchStamp[] =
        [];

    const skippedSourceElementIds:
      string[] = [];

    const skippedBypassedElementIds:
      string[] = [];

    graph.branches.forEach(
      (branch) => {
        const element =
          elementById.get(
            branch.elementId
          );

        if (!element) {
          return;
        }

        if (branch.isBypassed) {
          skippedBypassedElementIds.push(
            element.id
          );
          return;
        }

        if (
          isSourceType(element.type)
        ) {
          skippedSourceElementIds.push(
            element.id
          );
          return;
        }

        const admittance =
          getPassiveAdmittance(
            element,
            frequency
          );

        if (!admittance) {
          return;
        }

        stampPassiveBranch(
          admittanceMatrix,
          nodeIndexById,
          referenceNodeId,
          branch,
          admittance
        );

        passiveBranchStamps.push({
          elementId:
            element.id,
          elementType:
            element.type,
          fromNodeId:
            branch.fromNodeId,
          toNodeId:
            branch.toNodeId,
          admittance: {
            ...admittance,
          },
        });
      }
    );

    return {
      referenceNodeId,
      unknownNodeIds,
      nodeIndexById,
      admittanceMatrix,
      passiveBranchStamps,
      skippedSourceElementIds,
      skippedBypassedElementIds,
    };
  }
}
