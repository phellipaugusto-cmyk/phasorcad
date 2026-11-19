import { defaultCircuitModel } from "../data/defaultCircuitModel";

const source =
  defaultCircuitModel.elements.find(
    element =>
      element.type === "source"
  );

console.log(
  "==== TESTE SOURCE VOLTAGE ===="
);

console.log(
  "Fonte encontrada:",
  source
);

console.log(
  "Tensão:",
  source?.value
);