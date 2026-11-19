import type { CircuitElement } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import { createCircuitTerminals } from "../core/CircuitTerminal";
import { getMotorEquivalent } from "../core/motorModel";
import { CircuitGraphBuilder } from "../solver/CircuitGraphBuilder";
import { ModifiedNodalAnalysisBuilder } from "../solver/ModifiedNodalAnalysisBuilder";
import { ComplexLinearSolver } from "../solver/ComplexLinearSolver";
import { MnaElectricalResultsExtractor } from "../solver/MnaElectricalResultsExtractor";
import { serializeCircuit, parseCircuitFile } from "../storage/circuitFile";

/* Motor: dados de placa -> impedância; corrente MNA = corrente nominal. */
let failures = 0;
function near(name: string, got: number, want: number, tol: number) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "OK    " : "FALHOU"} ${name}: ${got.toFixed(3)} (esperado ${want})`);
}
function expect(name: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? "OK    " : "FALHOU"} ${name}`);
}
function el(id: string, type: CircuitElement["type"], value: number, x: number): CircuitElement {
  return { id, type, label: id, value, x, y: 120, terminals: createCircuitTerminals(id) };
}
const wire = (a: string, b: string): CircuitConnection => ({ id: `${a}~${b}`, fromTerminalId: a, toTerminalId: b });

console.log("Motor");
const motor = el("M1", "motor", 1, 200);
const eq = getMotorEquivalent(motor)!;
near("P elétrica (W)", eq.activePower, 1176.47, 0.1);
near("S (VA)", eq.apparentPower, 1384.08, 0.5);
near("Q (var)", eq.reactivePower, 729.1, 1);
near("I nominal (A)", eq.ratedCurrent, 6.29, 0.01);
near("R (ohm)", eq.resistance, 29.7, 0.2);
near("X (ohm)", eq.reactance, 18.42, 0.05);

const elements = [el("V1", "source", 220, 40), motor];
const connections = [wire("V1:right", "M1:left"), wire("M1:right", "V1:left")];
const graph = CircuitGraphBuilder.build(elements, connections);
const mna = ModifiedNodalAnalysisBuilder.build(graph, elements, 60);
const sol = ComplexLinearSolver.solve(mna.matrix.map((r) => r.values), mna.rightHandSide);
const res = MnaElectricalResultsExtractor.extract(graph, elements, mna, sol, 60);
const m = res.elementResults.find((r) => r.elementId === "M1")!;
const c = m.current as unknown as { real: number; imaginary: number };
near("|I| MNA a 220 V (A)", Math.hypot(c.real, c.imaginary), eq.ratedCurrent, 0.01);
near("P MNA (W)", (m.complexPower as unknown as { real: number }).real, eq.activePower, 1);
near("FP MNA", m.powerFactor, 0.85, 0.001);

const text = serializeCircuit(elements, connections, 60);
const parsed = parseCircuitFile(text);
expect("round trip mantém motor", parsed.ok && parsed.data.elements[1].motor?.powerFactor === 0.85);
const legacy = JSON.parse(text);
delete legacy.elements[1].motor;
const old = parseCircuitFile(JSON.stringify(legacy));
expect("arquivo sem dados de placa usa padrões", old.ok && old.data.elements[1].motor?.ratedVoltage === 220);

console.log(failures === 0 ? "Motor: todos os testes passaram." : `Motor: ${failures} FALHA(S).`);
