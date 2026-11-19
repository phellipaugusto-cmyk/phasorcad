import type {
  CircuitElementType,
} from "./CircuitElement";

export interface CircuitGraphNode {
  id: string;
  terminalIds: string[];
}

export interface CircuitGraphBranch {
  id: string;
  elementId: string;
  elementType: CircuitElementType;
  fromNodeId: string;
  toNodeId: string;

  isBypassed: boolean;
}

export interface CircuitGraph {
  nodes: CircuitGraphNode[];
  branches: CircuitGraphBranch[];
  terminalToNodeId: Record<string, string>;
  referenceNodeId: string | null;
  referenceTerminalId: string | null;
}
