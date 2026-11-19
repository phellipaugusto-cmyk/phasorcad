export interface ComplexValue {
  real: number;
  imaginary: number;
}

export interface NodalMatrixRow {
  nodeId: string;
  values: ComplexValue[];
}

export interface NodalBranchStamp {
  elementId: string;
  elementType:
    | "resistor"
    | "capacitor"
    | "inductor"
    | "motor"
    | "lamp"
    | "switch"
    | "contactor";
  fromNodeId: string;
  toNodeId: string;
  admittance: ComplexValue;
}

export interface NodalAnalysisStructure {
  referenceNodeId: string | null;
  unknownNodeIds: string[];
  nodeIndexById: Record<string, number>;
  admittanceMatrix: NodalMatrixRow[];
  passiveBranchStamps: NodalBranchStamp[];
  skippedSourceElementIds: string[];
  skippedBypassedElementIds: string[];
}
