import {
  defaultConnections,
} from "../data/defaultConnections";

console.log(
  "==== TESTE CONNECTIONS ===="
);

defaultConnections.forEach(
  (connection) => {
    console.log(
      `${connection.id}:`
    );

    console.log(
      `${connection.fromTerminalId} -> ${connection.toTerminalId}`
    );
  }
);