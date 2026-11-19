import type {
  CircuitConnection,
} from "../core/CircuitConnection";

export const defaultConnections:
  CircuitConnection[] = [
    {
      id: "connection-V1-R1",

      fromTerminalId:
        "V1:right",

      toTerminalId:
        "R1:left",
    },

    {
      id: "connection-R1-C1",

      fromTerminalId:
        "R1:right",

      toTerminalId:
        "C1:left",
    },

    {
      id: "connection-C1-L1",

      fromTerminalId:
        "C1:right",

      toTerminalId:
        "L1:left",
    },
  ];