import type { CircuitElement } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import { createCircuitTerminals } from "../core/CircuitTerminal";
import { getMotorEquivalent } from "../core/motorModel";
import { getLampResistance } from "../core/lampModel";
import { CircuitGraphBuilder } from "../solver/CircuitGraphBuilder";
import { ModifiedNodalAnalysisBuilder } from "../solver/ModifiedNodalAnalysisBuilder";
import { ComplexLinearSolver } from "../solver/ComplexLinearSolver";
import { MnaElectricalResultsExtractor } from "../solver/MnaElectricalResultsExtractor";
import { getCircuitState } from "../solver/CircuitTopology";
import { compareMeasurements } from "../solver/measurementComparison";
import { createBenchPreset } from "../data/benchPreset";
import { serializeCircuit, parseCircuitFile } from "../storage/circuitFile";

/*
 * Bancada do vídeo: duas fases + neutro, lâmpadas com interruptor,
 * motor via contator e carga variável no eixo.
 */
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

function solve(elements: CircuitElement[], connections: CircuitConnection[]) {
  const graph = CircuitGraphBuilder.build(elements, connections);
  const mna = ModifiedNodalAnalysisBuilder.build(graph, elements, 60);
  const sol = ComplexLinearSolver.solve(mna.matrix.map((r) => r.values), mna.rightHandSide);
  const results = MnaElectricalResultsExtractor.extract(graph, elements, mna, sol, 60);
  const get = (id: string) => results.elementResults.find((r) => r.elementId === id)!;
  const mag = (v: { real: number; imaginary: number }) => Math.hypot(v.real, v.imaginary);
  return { results, get, mag, state: getCircuitState(elements, connections) };
}

function withChange(
  elements: CircuitElement[],
  id: string,
  change: Partial<CircuitElement>
): CircuitElement[] {
  return elements.map((e) => (e.id === id ? { ...e, ...change } : e));
}

console.log("Lâmpada");
near("R de 60 W / 127 V (Ω)", getLampResistance({ value: 60, lamp: { ratedVoltage: 127 } })!, 268.82, 0.01);

console.log("Motor com carga no eixo");
const fan = { value: 0.045, motor: { efficiency: 0.35, powerFactor: 0.95, ratedVoltage: 127, loadFactor: 1 } };
const nominal = getMotorEquivalent(fan)!;
near("x = 1: P = P_mec/η (W)", nominal.activePower, 45 / 0.35, 0.01);
near("x = 1: FP de placa", nominal.powerFactor, 0.95, 1e-9);
const empty = getMotorEquivalent({ ...fan, motor: { ...fan.motor, loadFactor: 0 } })!;
near("x = 0: P = perdas fixas (W)", empty.activePower, 0.5 * (45 / 0.35 - 45), 0.01);
expect("x = 0: FP cai", empty.powerFactor < nominal.powerFactor);
expect("x = 0: rendimento = 0", empty.efficiency === 0);
const over = getMotorEquivalent({ ...fan, motor: { ...fan.motor, loadFactor: 1.5 } })!;
expect("x = 1,5: corrente maior que a nominal", over.ratedCurrent > nominal.ratedCurrent);

console.log("Bancada do vídeo (tudo ligado)");
const preset = createBenchPreset();
const all = solve(preset.elements, preset.connections);
expect("circuito fechado", all.state === "closed");
expect("MNA resolvido", all.results.available);
near("P fase A (W)", Math.abs(all.get("VA").complexPower.real), 125.8 ** 2 / 2000, 0.01);
near("P fase B (W) ≈ 167 medido", Math.abs(all.get("VB").complexPower.real), 167, 2);
const lampPower = 2 * (129.1 ** 2 / getLampResistance({ value: 60, lamp: { ratedVoltage: 127 } })!);
const motorPower = empty.activePower * (129.1 / 127) ** 2;
near("P fase B = 2 lâmpadas + motor (W)", Math.abs(all.get("VB").complexPower.real), lampPower + motorPower, 1e-6);
near("|I| no interruptor fechado (bypass) (A)", all.mag(all.get("S1").current), 0, 1e-12);

const rows = compareMeasurements(preset.elements, all.results);
expect("4 leituras comparadas", rows.length === 4);
expect("erro de P na fase B < 2 %", Math.abs(rows.find((r) => r.elementId === "VB" && r.quantity === "power")!.errorPercent!) < 2);

console.log("Desligando a lâmpada 1 (S1 aberto)");
const off = solve(withChange(preset.elements, "S1", { closed: false }), preset.connections);
expect("continua fechado (outras cargas)", off.state === "closed");
near("|I| lâmpada 1 (A)", off.mag(off.get("LP1").current), 0, 1e-6);
near("P fase B cai 1 lâmpada (W)", Math.abs(off.get("VB").complexPower.real), lampPower / 2 + motorPower, 0.01);
near("tensão sobre S1 aberto (V)", off.mag(off.get("S1").voltage), 129.1, 0.01);

console.log("Tudo da fase B desligado");
let dark = withChange(preset.elements, "S1", { closed: false });
dark = withChange(dark, "S2", { closed: false });
dark = withChange(dark, "K1", { closed: false });
expect("fase B aberta → estado ABERTO", getCircuitState(dark, preset.connections) === "open");

console.log("Carga no motor");
const loaded = withChange(preset.elements, "M1", {
  motor: { efficiency: 0.35, powerFactor: 0.95, ratedVoltage: 127, loadFactor: 1 },
});
const l = solve(loaded, preset.connections);
expect("com carga a fase B absorve mais", Math.abs(l.get("VB").complexPower.real) > Math.abs(all.get("VB").complexPower.real));

console.log("Curto por interruptor");
const shortEls: CircuitElement[] = [
  { ...preset.elements[0] },
  { id: "SX", type: "switch", label: "SX", value: 0, x: 0, y: 0, closed: true, terminals: createCircuitTerminals("SX") },
];
expect(
  "interruptor fechado direto na fonte = curto",
  getCircuitState(shortEls, [
    { id: "a", fromTerminalId: "VA:right", toTerminalId: "SX:left" },
    { id: "b", fromTerminalId: "SX:right", toTerminalId: "VA:left" },
  ]) === "short"
);

console.log("Arquivo");
const text = serializeCircuit(preset.elements, preset.connections, 60);
const parsed = parseCircuitFile(text);
expect("arquivo abre", parsed.ok);
if (parsed.ok) {
  const els = parsed.data.elements;
  const byId = (id: string) => els.find((e) => e.id === id)!;
  expect("mantém lâmpada", byId("LP1").lamp?.ratedVoltage === 127);
  expect("mantém interruptor", byId("S1").closed === true);
  expect("mantém carga do motor", byId("M1").motor?.loadFactor === 0);
  expect("mantém leituras", byId("VB").measured?.power === 167);
  const reopened = solve(els, parsed.data.connections);
  near("mesmo resultado após abrir", Math.abs(reopened.get("VB").complexPower.real), Math.abs(all.get("VB").complexPower.real), 1e-9);
}

console.log(failures === 0 ? "Bancada: todos os testes passaram." : `Bancada: ${failures} FALHA(S).`);

