import type {
  CircuitConnection,
} from "../../core/CircuitConnection";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

import type {
  AnimationModel,
} from "./circuitAnimation";

export interface CanvasProps {
  /* Dados da animação (null se o circuito não tem solução). */
  animationModel: AnimationModel | null;

  frequency: number;

  setFrequency: (
    frequency: number
  ) => void;

  sourceVoltage: number;

  setSourceVoltage: (
    voltage: number
  ) => void;

  elements: CircuitElement[];

  setElements: (
    elements: CircuitElement[]
  ) => void;

  connections: CircuitConnection[];

  setConnections: (
    connections: CircuitConnection[]
  ) => void;

  selectedElementId: string | null;

  setSelectedElementId: (
    id: string | null
  ) => void;

  selectedConnectionId: string | null;

  setSelectedConnectionId: (
    id: string | null
  ) => void;

  editingElementId: string | null;

  setEditingElementId: (
    id: string | null
  ) => void;
}