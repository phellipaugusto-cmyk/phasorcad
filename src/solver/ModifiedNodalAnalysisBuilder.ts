import type {
  CircuitGraph,
  CircuitGraphBranch,
} from "../core/CircuitGraph";

import {
  getSourcePhasor,
} from "../core/CircuitElement";

import type {
  CircuitElement,
} from "../core/CircuitElement";

import type {
  ComplexValue,
} from "../core/NodalAnalysis";

import type {
  MnaMatrixRow,
  MnaSourceStamp,
  MnaVariable,
  ModifiedNodalAnalysisStructure,
} from "../core/ModifiedNodalAnalysis";

import {
  AdmittanceMatrixBuilder,
} from "./AdmittanceMatrixBuilder";

function createComplexValue(
  real = 0,
  imaginary = 0
): ComplexValue {
  return {
    real,
    imaginary,
  };
}

function addRealValue(
  target: ComplexValue,
  value: number
): void {
  target.real += value;
}

function createVariables(
  graph: CircuitGraph,
  sourceBranches:
    CircuitGraphBranch[]
): MnaVariable[] {
  const nodeVoltageVariables:
    MnaVariable[] = graph.nodes
      .filter(
        (node) =>
          node.id !==
          graph.referenceNodeId
      )
      .map(
        (node) => ({
          id:
            `V(${node.id})`,

          kind:
            "node-voltage",

          nodeId:
            node.id,
        })
      );

  const sourceCurrentVariables:
    MnaVariable[] =
      sourceBranches.map(
        (branch) => ({
          id:
            `I(${branch.elementId})`,

          kind:
            "source-current",

          sourceElementId:
            branch.elementId,
        })
      );

  return [
    ...nodeVoltageVariables,
    ...sourceCurrentVariables,
  ];
}

function createVariableIndex(
  variables: MnaVariable[]
): Record<string, number> {
  const variableIndexById:
    Record<string, number> =
      {};

  variables.forEach(
    (variable, index) => {
      variableIndexById[
        variable.id
      ] = index;
    }
  );

  return variableIndexById;
}

function createEmptyMatrix(
  variables: MnaVariable[]
): MnaMatrixRow[] {
  return variables.map(
    (variable) => ({
      id:
        variable.id,

      values:
        variables.map(
          () =>
            createComplexValue()
        ),
    })
  );
}

function copyPassiveMatrix(
  matrix: MnaMatrixRow[],
  variables: MnaVariable[],
  graph: CircuitGraph,
  elements: CircuitElement[],
  frequency: number
): {
  passiveElementIds: string[];
  skippedBypassedElementIds:
    string[];
} {
  const passiveStructure =
    AdmittanceMatrixBuilder.build(
      graph,
      elements,
      frequency
    );

  passiveStructure.admittanceMatrix.forEach(
    (row) => {
      const matrixRowIndex =
        variables.findIndex(
          (variable) =>
            variable.kind ===
              "node-voltage" &&
            variable.nodeId ===
              row.nodeId
        );

      if (matrixRowIndex < 0) {
        return;
      }

      row.values.forEach(
        (value, columnIndex) => {
          const columnNodeId =
            passiveStructure
              .unknownNodeIds[
                columnIndex
              ];

          const matrixColumnIndex =
            variables.findIndex(
              (variable) =>
                variable.kind ===
                  "node-voltage" &&
                variable.nodeId ===
                  columnNodeId
            );

          if (
            matrixColumnIndex < 0
          ) {
            return;
          }

          matrix[
            matrixRowIndex
          ].values[
            matrixColumnIndex
          ] = {
            ...value,
          };
        }
      );
    }
  );

  return {
    passiveElementIds:
      passiveStructure
        .passiveBranchStamps
        .map(
          (stamp) =>
            stamp.elementId
        ),

    skippedBypassedElementIds:
      passiveStructure
        .skippedBypassedElementIds,
  };
}

function getNodeVoltageVariableId(
  nodeId: string
): string {
  return `V(${nodeId})`;
}

function stampVoltageSource(
  matrix: MnaMatrixRow[],
  rightHandSide:
    ComplexValue[],
  variableIndexById:
    Record<string, number>,
  referenceNodeId:
    string | null,
  branch: CircuitGraphBranch,
  source: CircuitElement
): MnaSourceStamp {
  const currentVariableId =
    `I(${source.id})`;

  const sourceRowIndex =
    variableIndexById[
      currentVariableId
    ];

  const fromIsReference =
    branch.fromNodeId ===
    referenceNodeId;

  const toIsReference =
    branch.toNodeId ===
    referenceNodeId;

  if (!fromIsReference) {
    const fromVariableId =
      getNodeVoltageVariableId(
        branch.fromNodeId
      );

    const fromIndex =
      variableIndexById[
        fromVariableId
      ];

    /*
     * Corrente da fonte orientada de
     * fromNodeId para toNodeId.
     */
    addRealValue(
      matrix[fromIndex]
        .values[sourceRowIndex],
      -1
    );

    addRealValue(
      matrix[sourceRowIndex]
        .values[fromIndex],
      -1
    );
  }

  if (!toIsReference) {
    const toVariableId =
      getNodeVoltageVariableId(
        branch.toNodeId
      );

    const toIndex =
      variableIndexById[
        toVariableId
      ];

    addRealValue(
      matrix[toIndex]
        .values[sourceRowIndex],
      1
    );

    addRealValue(
      matrix[sourceRowIndex]
        .values[toIndex],
      1
    );
  }

  /*
   * Convenção da fonte:
   * V(toNodeId) - V(fromNodeId) = Vs.
   *
   * Para V1:left = GND e V1:right = N0:
   * V(N0) = +Vs.
   */
  const phasor =
    getSourcePhasor(source);

  rightHandSide[sourceRowIndex] =
    createComplexValue(
      phasor.real,
      phasor.imaginary
    );

  return {
    sourceElementId:
      source.id,

    kind:
      "voltage",

    fromNodeId:
      branch.fromNodeId,

    toNodeId:
      branch.toNodeId,

    voltage:
      createComplexValue(
        phasor.real,
        phasor.imaginary
      ),

    current:
      createComplexValue(),

    currentVariableId,
  };
}

/*
 * Fonte de corrente ideal: entrega Is (fase 0) ao circuito,
 * saindo pelo nó toNodeId e retornando pelo nó fromNodeId.
 *
 * Em Y·V = J, J(to) += Is e J(from) -= Is. O nó de
 * referência não tem linha na matriz.
 */
function stampCurrentSource(
  rightHandSide:
    ComplexValue[],
  variableIndexById:
    Record<string, number>,
  referenceNodeId:
    string | null,
  branch: CircuitGraphBranch,
  source: CircuitElement
): MnaSourceStamp {
  const phasor =
    getSourcePhasor(source);

  if (branch.toNodeId !== referenceNodeId) {
    const toIndex =
      variableIndexById[
        getNodeVoltageVariableId(
          branch.toNodeId
        )
      ];

    rightHandSide[toIndex].real +=
      phasor.real;

    rightHandSide[toIndex].imaginary +=
      phasor.imaginary;
  }

  if (branch.fromNodeId !== referenceNodeId) {
    const fromIndex =
      variableIndexById[
        getNodeVoltageVariableId(
          branch.fromNodeId
        )
      ];

    rightHandSide[fromIndex].real -=
      phasor.real;

    rightHandSide[fromIndex].imaginary -=
      phasor.imaginary;
  }

  return {
    sourceElementId:
      source.id,

    kind:
      "current",

    fromNodeId:
      branch.fromNodeId,

    toNodeId:
      branch.toNodeId,

    voltage:
      createComplexValue(),

    current:
      createComplexValue(
        phasor.real,
        phasor.imaginary
      ),

    currentVariableId:
      null,
  };
}

export class ModifiedNodalAnalysisBuilder {
  static build(
    graph: CircuitGraph,
    elements:
      CircuitElement[],
    frequency: number
  ): ModifiedNodalAnalysisStructure {
    const elementById =
      new Map(
        elements.map(
          (element) => [
            element.id,
            element,
          ]
        )
      );

    const sourceBranches =
      graph.branches.filter(
        (branch) =>
          branch.elementType ===
            "source" &&
          !branch.isBypassed
      );

    const currentSourceBranches =
      graph.branches.filter(
        (branch) =>
          branch.elementType ===
            "currentSource" &&
          !branch.isBypassed
      );

    const variables =
      createVariables(
        graph,
        sourceBranches
      );

    const variableIndexById =
      createVariableIndex(
        variables
      );

    const matrix =
      createEmptyMatrix(
        variables
      );

    const rightHandSide =
      variables.map(
        () =>
          createComplexValue()
      );

    const {
      passiveElementIds,
      skippedBypassedElementIds,
    } = copyPassiveMatrix(
      matrix,
      variables,
      graph,
      elements,
      frequency
    );

    const sourceStamps:
      MnaSourceStamp[] = [];

    sourceBranches.forEach(
      (branch) => {
        const source =
          elementById.get(
            branch.elementId
          );

        if (
          !source ||
          source.type !==
            "source"
        ) {
          return;
        }

        sourceStamps.push(
          stampVoltageSource(
            matrix,
            rightHandSide,
            variableIndexById,
            graph.referenceNodeId,
            branch,
            source
          )
        );
      }
    );

    currentSourceBranches.forEach(
      (branch) => {
        const source =
          elementById.get(
            branch.elementId
          );

        if (
          !source ||
          source.type !==
            "currentSource"
        ) {
          return;
        }

        sourceStamps.push(
          stampCurrentSource(
            rightHandSide,
            variableIndexById,
            graph.referenceNodeId,
            branch,
            source
          )
        );
      }
    );

    return {
      referenceNodeId:
        graph.referenceNodeId,

      variables,
      variableIndexById,
      matrix,
      rightHandSide,
      sourceStamps,
      passiveElementIds,
      skippedBypassedElementIds,
    };
  }
}
