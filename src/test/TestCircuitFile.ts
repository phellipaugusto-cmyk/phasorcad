import type {
  CircuitElement,
} from "../core/CircuitElement";

import {
  createCircuitTerminals,
} from "../core/CircuitTerminal";

import {
  parseCircuitFile,
  serializeCircuit,
} from "../storage/circuitFile";

let failures = 0;

function expect(
  name: string,
  condition: boolean
): void {
  if (!condition) {
    failures++;
  }

  console.log(
    `${condition ? "OK    " : "FALHOU"} ${name}`
  );
}

function element(
  id: string,
  type: CircuitElement["type"],
  value: number
): CircuitElement {
  return {
    id,
    type,
    label: id,
    value,
    x: 40,
    y: 120,
    terminals: createCircuitTerminals(id),
  };
}

const elements = [
  element("I1", "currentSource", 2),
  element("R1", "resistor", 50),
  element("L1", "inductor", 0.1),
];

const connections = [
  {
    id: "c1",
    fromTerminalId: "I1:right",
    toTerminalId: "R1:left",
  },
  {
    id: "c2",
    fromTerminalId: "R1:right",
    toTerminalId: "L1:left",
  },
];

console.log("Arquivo de circuito (.json)");

const text = serializeCircuit(
  elements,
  connections,
  50
);

const result = parseCircuitFile(text);

expect("ida e volta é válida", result.ok);

if (result.ok) {
  expect(
    "3 componentes",
    result.data.elements.length === 3
  );
  expect(
    "2 conexões",
    result.data.connections.length === 2
  );
  expect(
    "frequência 50 Hz",
    result.data.frequency === 50
  );
  expect(
    "valor do indutor preservado",
    result.data.elements[2].value === 0.1
  );
  expect(
    "terminais recriados",
    result.data.elements[0].terminals[1].id ===
      "I1:right"
  );
}

expect(
  "rejeita texto que não é JSON",
  !parseCircuitFile("{ não é json").ok
);

expect(
  "rejeita JSON de outro formato",
  !parseCircuitFile('{"foo":1}').ok
);

expect(
  "rejeita versão mais nova",
  !parseCircuitFile(
    text.replace('"version": 1', '"version": 99')
  ).ok
);

{
  const dup = serializeCircuit(
    [
      element("R1", "resistor", 10),
      element("R1", "resistor", 20),
    ],
    [],
    60
  );

  expect(
    "rejeita ids duplicados",
    !parseCircuitFile(dup).ok
  );
}

{
  const two = serializeCircuit(
    [
      { ...element("V1", "source", 220), phase: 0 },
      { ...element("V2", "source", 100), phase: 90 },
      element("I1", "currentSource", 1),
    ],
    [],
    60
  );

  const parsed = parseCircuitFile(two);

  expect("aceita várias fontes", parsed.ok);

  expect(
    "fase 0 não é gravada no arquivo",
    !two.includes('"phase": 0')
  );

  expect(
    "fase de 90° volta na leitura",
    parsed.ok &&
      parsed.data.elements[1].phase === 90
  );

  expect(
    "fonte sem fase continua sem campo",
    parsed.ok &&
      parsed.data.elements[0].phase === undefined
  );
}

{
  const orphan = serializeCircuit(
    [element("R1", "resistor", 10)],
    [
      {
        id: "x",
        fromTerminalId: "R1:right",
        toTerminalId: "R9:left",
      },
    ],
    60
  );

  expect(
    "rejeita conexão com terminal inexistente",
    !parseCircuitFile(orphan).ok
  );
}

{
  const bad = text.replace(
    '"frequency": 50',
    '"frequency": -3'
  );

  const parsed = parseCircuitFile(bad);

  expect(
    "frequência inválida volta a 60 Hz",
    parsed.ok &&
      parsed.data.frequency === 60
  );
}

console.log(
  failures === 0
    ? "Arquivo de circuito: todos os testes passaram."
    : `Arquivo de circuito: ${failures} FALHA(S).`
);
