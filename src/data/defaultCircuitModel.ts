import type { Circuit } from "../core/Circuit";

import { defaultCircuit } from "./defaultCircuit";
import { defaultConnections } from "./defaultConnections";

export const defaultCircuitModel: Circuit = {
  frequency: 60,

  elements: defaultCircuit,

  connections: defaultConnections,
};