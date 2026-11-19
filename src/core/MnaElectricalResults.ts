import type {
  CircuitElementType,
} from "./CircuitElement";

import type {
  ComplexValue,
} from "./NodalAnalysis";

export interface MnaNodeVoltageResult {
  nodeId: string;

  voltage: ComplexValue;

  isReference: boolean;
}

export interface MnaElementElectricalResult {
  elementId: string;

  elementType: CircuitElementType;

  fromNodeId: string;

  toNodeId: string;

  voltage: ComplexValue;

  current: ComplexValue;

  complexPower: ComplexValue;

  apparentPower: number;

  powerFactor: number;

  isBypassed: boolean;

  isSource: boolean;
}

export interface MnaElectricalResults {
  available: boolean;

  errorMessage: string | null;

  nodeVoltages:
    MnaNodeVoltageResult[];

  elementResults:
    MnaElementElectricalResult[];
}
