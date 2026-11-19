import type { CircuitElement, CircuitElementType } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import { createCircuitTerminals } from "../core/CircuitTerminal";
import { CircuitGraphBuilder } from "../solver/CircuitGraphBuilder";
import { ModifiedNodalAnalysisBuilder } from "../solver/ModifiedNodalAnalysisBuilder";
import { ComplexLinearSolver } from "../solver/ComplexLinearSolver";
import { MnaElectricalResultsExtractor } from "../solver/MnaElectricalResultsExtractor";
import { MnaCircuitResultBuilder } from "../solver/MnaCircuitResultBuilder";
import { getCircuitState } from "../solver/CircuitTopology";
import { buildCircuitReport } from "../report/circuitReport";

/*
 * Relatório PDF: gera o relatório de um RLC série fechado
 * (220 V, 100 Ω, 100 µF, 100 mH, 60 Hz) e confere a estrutura.
 * No Node, REPORT_OUT=/caminho.pdf grava o arquivo para inspeção.
 */

let failures = 0;

function expect(name: string, condition: boolean): void {
  if (!condition) {
    failures++;
  }

  console.log(`${condition ? "OK    " : "FALHOU"} ${name}`);
}

function element(
  id: string,
  type: CircuitElementType,
  value: number,
  x: number,
  y: number
): CircuitElement {
  return { id, type, label: id, value, x, y, terminals: createCircuitTerminals(id) };
}

function wire(a: string, b: string): CircuitConnection {
  return { id: `${a}~${b}`, fromTerminalId: a, toTerminalId: b };
}

async function run(closed: boolean) {
  const elements = [
    element("V1", "source", 220, 40, 120),
    element("R1", "resistor", 100, 160, 120),
    element("C1", "capacitor", 1e-4, 320, 120),
    element("L1", "inductor", 0.1, 480, 120),
  ];

  const connections = [
    wire("V1:right", "R1:left"),
    wire("R1:right", "C1:left"),
    wire("C1:right", "L1:left"),
    ...(closed ? [wire("L1:right", "V1:left")] : []),
  ];

  const graph = CircuitGraphBuilder.build(elements, connections);
  const mna = ModifiedNodalAnalysisBuilder.build(graph, elements, 60);
  const solution = ComplexLinearSolver.solve(
    mna.matrix.map((row) => row.values),
    mna.rightHandSide
  );
  const results = MnaElectricalResultsExtractor.extract(graph, elements, mna, solution, 60);
  const circuitState = getCircuitState(elements, connections);
  const result = MnaCircuitResultBuilder.build(circuitState, 220, results).result;

  return buildCircuitReport({
    elements,
    connections,
    frequency: 60,
    result,
    circuitState,
    graph,
    results,
    generatedAt: new Date("2026-11-19T12:30:00"),
    title: "Teste RLC série",
  });
}

(async () => {
console.log("Relatório PDF");

const pdf = await run(true);
const head = String.fromCharCode(...pdf.slice(0, 5));

expect("PDF começa com %PDF-", head === "%PDF-");
expect("PDF tem tamanho razoável (> 8 KB)", pdf.length > 8_000);

const open = await run(false);

expect("circuito aberto também gera PDF", open.length > 3_000 && open.length < pdf.length);

/* Só no Node (22+): REPORT_OUT grava os PDFs para inspeção visual. */
const nodeProcess = (globalThis as unknown as {
  process?: {
    env: Record<string, string | undefined>;
    getBuiltinModule?: (name: string) => {
      writeFileSync: (path: string, data: Uint8Array) => void;
    };
  };
}).process;

const out = nodeProcess?.env.REPORT_OUT;

if (out && nodeProcess?.getBuiltinModule) {
  const fs = nodeProcess.getBuiltinModule("node:fs");
  fs.writeFileSync(out, pdf);
  fs.writeFileSync(out.replace(/\.pdf$/, "-aberto.pdf"), open);
}

console.log(
  failures === 0
    ? "Relatório PDF: todos os testes passaram."
    : `Relatório PDF: ${failures} FALHA(S).`
);
})();
