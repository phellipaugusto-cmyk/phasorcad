import type { CircuitElement } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import { CircuitGraphBuilder } from "../solver/CircuitGraphBuilder";
import { ModifiedNodalAnalysisBuilder } from "../solver/ModifiedNodalAnalysisBuilder";
import { ComplexLinearSolver } from "../solver/ComplexLinearSolver";
import { MnaElectricalResultsExtractor } from "../solver/MnaElectricalResultsExtractor";
import { getCircuitState } from "../solver/CircuitTopology";
import { analyzeThreePhase, angleDegrees } from "../solver/threePhaseAnalysis";
import { createThreePhasePreset, type ThreePhasePresetKind } from "../data/threePhasePresets";
import { enforceBalance, rebuildGroup, getGroupMembers } from "../core/threePhase";
import { serializeCircuit, parseCircuitFile } from "../storage/circuitFile";

/*
 * Trifásico equilibrado: 220/127 V, Z = 8 + j6 Ω por fase.
 * Valores esperados calculados à mão.
 */
let failures = 0;
function near(name: string, got: number, want: number, tol: number) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "OK    " : "FALHOU"} ${name}: ${got.toFixed(4)} (esperado ${want})`);
}
function expect(name: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? "OK    " : "FALHOU"} ${name}`);
}

function analyze(elements: CircuitElement[], connections: CircuitConnection[], f = 60) {
  const graph = CircuitGraphBuilder.build(elements, connections);
  const mna = ModifiedNodalAnalysisBuilder.build(graph, elements, f);
  const sol = ComplexLinearSolver.solve(mna.matrix.map((r) => r.values), mna.rightHandSide);
  const results = MnaElectricalResultsExtractor.extract(graph, elements, mna, sol, f);
  const groups = analyzeThreePhase(elements, results, f);
  return {
    state: getCircuitState(elements, connections),
    results,
    gen: groups.find((g) => g.kind === "source")!,
    load: groups.find((g) => g.kind === "load")!,
  };
}

const VF = 220 / Math.sqrt(3);
const Z = 10;
const PF = 0.8;

const expected: Record<ThreePhasePresetKind, { vfLoad: number; ifLoad: number; il: number; p: number }> = {
  YY: { vfLoad: VF, ifLoad: VF / Z, il: VF / Z, p: 3 * (VF ** 2) * PF / Z },
  DY: { vfLoad: VF, ifLoad: VF / Z, il: VF / Z, p: 3 * (VF ** 2) * PF / Z },
  YD: { vfLoad: 220, ifLoad: 22, il: 22 * Math.sqrt(3), p: 3 * 220 ** 2 * PF / Z },
  DD: { vfLoad: 220, ifLoad: 22, il: 22 * Math.sqrt(3), p: 3 * 220 ** 2 * PF / Z },
};

(Object.keys(expected) as ThreePhasePresetKind[]).forEach((kind) => {
  console.log(`\n${kind}`);
  const preset = createThreePhasePreset(kind);
  const r = analyze(preset.elements, preset.connections);
  const e = expected[kind];
  expect("circuito fechado e resolvido", r.state === "closed" && r.results.available);
  near("V_L do gerador (V)", r.gen.lineVoltage, 220, 0.01);
  near("V_L na carga (V)", r.load.lineVoltage, 220, 0.01);
  near("V_F na carga (V)", r.load.phaseVoltage, e.vfLoad, 0.01);
  near("I_F na carga (A)", r.load.phaseCurrent, e.ifLoad, 0.01);
  near("I_L (A)", r.load.lineCurrent, e.il, 0.01);
  near("I_L gerador = I_L carga (A)", r.gen.lineCurrent, e.il, 0.02);
  near("P total da carga (W)", r.load.activePower, e.p, 0.5);
  near("Q total da carga (var)", r.load.reactivePower, e.p * 0.75, 0.5);
  near("FP", r.load.powerFactor, 0.8, 1e-6);
  near("P = √3·V_L·I_L·FP (W)", r.load.formulaPower, e.p, 0.5);
  near("gerador entrega P (W)", r.gen.activePower, e.p, 1.5);
  if (kind[1] === "Y") {
    near("V_L/V_F = √3", r.load.voltageRatio!.magnitude, Math.sqrt(3), 1e-6);
    near("∠(V_AB/V_AN) = +30°", r.load.voltageRatio!.angle, 30, 1e-6);
    near("corrente de neutro (A)", r.load.neutralCurrent!, 0, 1e-6);
  } else {
    near("I_L/I_F = √3", r.load.currentRatio!.magnitude, Math.sqrt(3), 1e-6);
    near("∠(I_A/I_AB) = −30°", r.load.currentRatio!.angle, -30, 1e-6);
  }
  near("∠V_AB do gerador (°)", angleDegrees(r.gen.lineVoltages.A), 30, 0.01);
});

console.log("\nEquivalente Y ↔ Δ");
{
  const yd = analyze(createThreePhasePreset("YD").elements, createThreePhasePreset("YD").connections);
  near("Z_Y equivalente de 8+j6 Δ: R", yd.load.equivalentImpedance!.resistance, 8 / 3, 1e-9);
  // Carga Y com Z_Δ/3 absorve o mesmo que a Δ.
  const yy = createThreePhasePreset("YY");
  const els = yy.elements.map((e) => (e.type === "impedance" ? { ...e, impedance: { resistance: 8 / 3, reactance: 2 } } : e));
  const eq = analyze(els, yy.connections);
  near("Y com Z/3 absorve o mesmo P que Δ (W)", eq.load.activePower, yd.load.activePower, 0.5);
}

console.log("\nSequência ACB");
{
  const p = createThreePhasePreset("YY");
  const re = rebuildGroup(p.elements, p.connections, "G", { sequence: "ACB" });
  const r = analyze(re.elements, re.connections);
  near("∠V_AB = −30° em ACB", angleDegrees(r.gen.lineVoltages.A), -30, 0.01);
  near("P igual (W)", r.load.activePower, expected.YY.p, 0.5);
}

console.log("\nConverter a carga Y → Δ (mantém os fios das linhas)");
{
  const p = createThreePhasePreset("YY");
  const re = rebuildGroup(p.elements, p.connections, "C", { connection: "D" });
  expect("fio de neutro removido", !re.connections.some((c) => c.id === "linha-N"));
  expect("3 fios de linha mantidos", ["A", "B", "C"].every((r) => re.connections.some((c) => c.id === `linha-${r}`)));
  const r = analyze(re.elements, re.connections);
  near("agora I_L = 38,1 A", r.load.lineCurrent, 22 * Math.sqrt(3), 0.01);
  const back = rebuildGroup(re.elements, re.connections, "G", { connection: "D" });
  const r2 = analyze(back.elements, back.connections);
  near("gerador também em Δ: mesma I_L", r2.load.lineCurrent, 22 * Math.sqrt(3), 0.02);
  near("V_L do gerador Δ continua 220 V", r2.gen.lineVoltage, 220, 0.05);
}

console.log("\nEquilíbrio forçado na edição");
{
  const p = createThreePhasePreset("YY");
  const edited = p.elements.map((e) => (e.id === "GVBN" ? { ...e, value: 230 } : e));
  const balanced = enforceBalance(p.elements, edited);
  expect("as 3 fontes passam a 230 V", getGroupMembers(balanced, "G").every((m) => m.value === 230));
  const z = p.elements.map((e) => (e.id === "CZC" ? { ...e, impedance: { resistance: 3, reactance: 4 } } : e));
  const bz = enforceBalance(p.elements, z);
  expect("as 3 impedâncias passam a 3+j4", getGroupMembers(bz, "C").every((m) => m.impedance?.resistance === 3 && m.impedance.reactance === 4 && m.value === 5));
  const ph = p.elements.map((e) => (e.id === "GVCN" ? { ...e, phase: 0 } : e));
  expect("ângulo da fase C volta a +120°", enforceBalance(p.elements, ph).find((e) => e.id === "GVCN")!.phase === 120);
}

console.log("\nFrequência");
{
  const p = createThreePhasePreset("YY");
  const r = analyze(p.elements, p.connections, 120);
  near("120 Hz: X = 12 Ω → I = 127/√(8²+12²) (A)", r.load.lineCurrent, VF / Math.hypot(8, 12), 0.01);
}

console.log("\nArquivo");
{
  const p = createThreePhasePreset("DD");
  const parsed = parseCircuitFile(serializeCircuit(p.elements, p.connections, 60));
  expect("abre", parsed.ok);
  if (parsed.ok) {
    const els = parsed.data.elements;
    expect("mantém grupos", els.filter((e) => e.group?.id === "G").length === 3 && els.find((e) => e.id === "GVAB")?.group?.connection === "D");
    expect("mantém Z", els.find((e) => e.id === "CZAB")?.impedance?.reactance === 6);
    expect("mantém Rint", (els.find((e) => e.id === "GVAB")?.internalResistance ?? 0) > 0);
    const r = analyze(els, parsed.data.connections);
    near("mesmo resultado", r.load.lineCurrent, 22 * Math.sqrt(3), 0.02);
  }
}

console.log(failures === 0 ? "\nTrifásico: todos os testes passaram." : `\nTrifásico: ${failures} FALHA(S).`);
