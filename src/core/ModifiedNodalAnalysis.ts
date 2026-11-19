import type {
  ComplexValue,
} from "./NodalAnalysis";

export interface MnaVariable {
  id: string;

  kind:
    | "node-voltage"
    | "source-current";

  nodeId?: string;

  sourceElementId?: string;
}

export interface MnaMatrixRow {
  id: string;

  values: ComplexValue[];
}

export interface MnaSourceStamp {
  sourceElementId: string;

  /*
   * "voltage": fonte de tensão (variável extra de corrente).
   * "current": fonte de corrente (injeção direta no vetor
   * de termos independentes, sem variável extra).
   */
  kind: "voltage" | "current";

  fromNodeId: string;

  toNodeId: string;

  /* Tensão imposta (zero para fonte de corrente). */
  voltage: ComplexValue;

  /* Corrente imposta (zero para fonte de tensão). */
  current: ComplexValue;

  /* Variável MNA da corrente; nula para fonte de corrente. */
  currentVariableId: string | null;
}

export interface ModifiedNodalAnalysisStructure {
  referenceNodeId: string | null;

  variables: MnaVariable[];

  variableIndexById:
    Record<string, number>;

  matrix: MnaMatrixRow[];

  rightHandSide:
    ComplexValue[];

  sourceStamps:
    MnaSourceStamp[];

  passiveElementIds:
    string[];

  skippedBypassedElementIds:
    string[];
}
