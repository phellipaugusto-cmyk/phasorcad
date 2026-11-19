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
import { resolveContactors } from "../solver/contactorResolver";
import { getContactorAdmittance } from "../core/contactorModel";
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

function solve(input: CircuitElement[], connections: CircuitConnection[]) {
  const resolved = resolveContactors(input, connections, 60);
  const elements = resolved.elements;
  const graph = CircuitGraphBuilder.build(elements, connections);
  const mna = ModifiedNodalAnalysisBuilder.build(graph, elements, 60);
  const sol = ComplexLinearSolver.solve(mna.matrix.map((r) => r.values), mna.rightHandSide);
  const results = MnaElectricalResultsExtractor.extract(graph, elements, mna, sol, 60);
  const get = (id: string) => results.elementResults.find((r) => r.elementId === id)!;
  const mag = (v: { real: number; imaginary: number }) => Math.hypot(v.real, v.imaginary);
  return { results, get, mag, state: getCircuitState(elements, connections), resolved, elements };
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
const coilY = getContactorAdmittance({ value: 8, contactor: { ratedVoltage: 127, powerFactor: 0.35 } }, 60)!;
const coilP = 125.8 ** 2 * coilY.real;
near("P bobina a 125,8 V (W)", coilP, 8 * 0.35 * (125.8 / 127) ** 2, 1e-9);
near("P fase A = touch + bobina (W)", Math.abs(all.get("VA").complexPower.real), 125.8 ** 2 / 3165 + coilP, 1e-6);
expect("bobina K1 energizada", all.resolved.coilStates.K1?.energized === true);
expect("contato K1 fechado automaticamente", all.elements.find((e) => e.id === "K1A")!.closed === true);
expect("convergiu", all.resolved.converged);
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

/* Toque na botoeira: pressiona, resolve, solta, resolve (com memória). */
function pulse(elements: CircuitElement[], id: string) {
  const pressed = solve(withChange(elements, id, { pressed: true }), preset.connections);
  const released = solve(
    withChange(pressed.elements, id, { pressed: false }),
    preset.connections
  );
  return { pressed, released };
}
const coilOn = (r: ReturnType<typeof solve>) => r.resolved.coilStates.K1?.energized === true;

console.log("Partida com selo");
expect("abre selado (K1 energizada)", coilOn(all));
const stop = pulse(preset.elements, "B0");
expect("B0 pressionada: bobina cai", !coilOn(stop.pressed));
expect("B0 solta: continua desligado (selo aberto)", !coilOn(stop.released));
const noCoil = stop.released;
expect("bobina desenergizada", noCoil.resolved.coilStates.K1?.energized === false);
expect("contato K1 abriu", noCoil.elements.find((e) => e.id === "K1A")!.closed === false);
near("|I| motor (A)", noCoil.mag(noCoil.get("M1").current), 0, 1e-6);
near("P fase B = só lâmpadas (W)", Math.abs(noCoil.get("VB").complexPower.real), lampPower, 0.01);
const start = pulse(noCoil.elements, "B1");
expect("B1 pressionada: bobina arma", coilOn(start.pressed));
expect("B1 solta: selo mantém ligado", coilOn(start.released));
expect("selo fechado", start.released.elements.find((e) => e.id === "K1S")!.closed === true);
expect("B1 voltou a abrir", start.released.elements.find((e) => e.id === "B1")!.closed === false);
near("motor voltou (P fase B, W)", Math.abs(start.released.get("VB").complexPower.real), 167.18, 0.01);
const noSeal = pulse(
  withChange(noCoil.elements, "K1S", { controlledBy: undefined, closed: false }),
  "B1"
);
expect("sem selo: solta B1 e o motor para (comando por pulso)", coilOn(noSeal.pressed) && !coilOn(noSeal.released));

console.log("Tudo desligado (como no início do vídeo)");
let dark = withChange(preset.elements, "S1", { closed: false });
dark = withChange(dark, "S2", { closed: false });
dark = withChange(dark, "K1", { energized: false });
const d = solve(dark, preset.connections);
expect("fase B sem carga não bloqueia o cálculo", d.state === "closed");
near("P fase A = só o touch ≈ 5 W medido", Math.abs(d.get("VA").complexPower.real), 5, 0.05);
near("P fase B (W)", Math.abs(d.get("VB").complexPower.real), 0, 1e-3);

console.log("Contato NF e tensão baixa");
const nf = solve(withChange(preset.elements, "K1A", { normallyClosed: true }), preset.connections);
expect("NF abre com bobina energizada", nf.elements.find((e) => e.id === "K1A")!.closed === false);
const weak = solve(withChange(preset.elements, "VA", { value: 80 }), preset.connections);
expect("80 V < 70 % de 127 V: bobina não arma", weak.resolved.coilStates.K1?.energized === false);

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
  expect("mantém contato comandado", byId("K1A").controlledBy === "K1");
  expect("mantém bobina", byId("K1").contactor?.powerFactor === 0.35);
  expect("mantém carga do motor", byId("M1").motor?.loadFactor === 0);
  expect("mantém leituras", byId("VB").measured?.power === 167);
  const reopened = solve(els, parsed.data.connections);
  near("mesmo resultado após abrir", Math.abs(reopened.get("VB").complexPower.real), Math.abs(all.get("VB").complexPower.real), 1e-9);
}

console.log(failures === 0 ? "Bancada: todos os testes passaram." : `Bancada: ${failures} FALHA(S).`);

