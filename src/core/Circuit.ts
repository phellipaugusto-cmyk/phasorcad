import type { CircuitElement } from "./CircuitElement";
import type { CircuitConnection } from "./CircuitConnection";

export interface Circuit {
  frequency: number;

  elements: CircuitElement[];

  connections: CircuitConnection[];
}