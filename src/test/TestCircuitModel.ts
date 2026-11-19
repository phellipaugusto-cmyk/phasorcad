import { defaultCircuitModel } from "../data/defaultCircuitModel";

console.log(
  "==== TESTE CIRCUIT MODEL ===="
);

console.log(
  "Elementos:",
  defaultCircuitModel.elements.length
);

console.log(
  "Conexões:",
  defaultCircuitModel.connections.length
);

defaultCircuitModel.elements.forEach(
  (element) => {

    console.log(
      `${element.id} (${element.type})`
    );

  }
);

defaultCircuitModel.connections.forEach(
  (connection) => {

    console.log(
      `${connection.fromTerminalId} -> ${connection.toTerminalId}`
    );

  }
);