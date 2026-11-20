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

const expected: Record<Extract<ThreePhasePresetKind, "YY" | "YD" | "DY" | "DD">, { vfLoad: number; ifLoad: number; il: number; p: number }> = {
  YY: { vfLoad: VF, ifLoad: VF / Z, il: VF / Z, p: 3 * (VF ** 2) * PF / Z },
  DY: { vfLoad: VF, ifLoad: VF / Z, il: VF / Z, p: 3 * (VF ** 2) * PF / Z },
  YD: { vfLoad: 220, ifLoad: 22, il: 22 * Math.sqrt(3), p: 3 * 220 ** 2 * PF / Z },
  DD: { vfLoad: 220, ifLoad: 22, il: 22 * Math.sqrt(3), p: 3 * 220 ** 2 * PF / Z },
};

(Object.keys(expected) as (keyof typeof expected)[]).forEach((kind) => {
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
  near("Z_Y equivalente de 8+j6 Δ: R", yd.load.equivalentImpedances!.A.resistance, 8 / 3, 1e-9);
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

console.log("\nDesequilibrado (Z_A = 10, Z_B = 6 + j8, Z_C = 5 − j5 Ω)");
{
  type C = { re: number; im: number };
  const c = (re: number, im = 0): C => ({ re, im });
  const polar = (m: number, deg: number): C => c(m * Math.cos((deg * Math.PI) / 180), m * Math.sin((deg * Math.PI) / 180));
  const addc = (a: C, b: C): C => c(a.re + b.re, a.im + b.im);
  const subc = (a: C, b: C): C => c(a.re - b.re, a.im - b.im);
  const mulc = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const divc = (a: C, b: C): C => { const d = b.re ** 2 + b.im ** 2; return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const abs = (a: C) => Math.hypot(a.re, a.im);
  const V = [polar(VF, 0), polar(VF, -120), polar(VF, 120)];
  const Zs = [c(10), c(6, 8), c(5, -5)];
  const one = c(1);

  // Com neutro: cada fase com V_F.
  const I = V.map((v, k) => divc(v, Zs[k]));
  const IN = I.reduce(addc);
  const pWith = I.reduce((sum, i, k) => sum + abs(i) ** 2 * Zs[k].re, 0);
  const r1 = analyze(createThreePhasePreset("YYn-u").elements, createThreePhasePreset("YYn-u").connections);
  expect("marcada como desequilibrada", r1.load.balanced === false);
  near("I_A com neutro (A)", r1.load.lineCurrents.A ? Math.hypot(r1.load.lineCurrents.A.real, r1.load.lineCurrents.A.imaginary) : 0, abs(I[0]), 1e-6);
  near("I_C com neutro (A)", Math.hypot(r1.load.lineCurrents.C.real, r1.load.lineCurrents.C.imaginary), abs(I[2]), 1e-6);
  near("I_N = I_A + I_B + I_C (A)", r1.load.neutralCurrent!, abs(IN), 1e-6);
  near("deslocamento do neutro = 0 com fio de neutro (V)", Math.hypot(r1.load.neutralShift!.real, r1.load.neutralShift!.imaginary), 0, 1e-6);
  near("P total = Σ I²R (W)", r1.load.activePower, pWith, 1e-3);
  near("P_A = V²/10 (W)", r1.load.phasePowers.A.real, VF ** 2 / 10, 1e-3);
  near("Q_C capacitiva (var)", r1.load.phasePowers.C.imaginary, -(abs(I[2]) ** 2) * 5, 1e-3);
  expect("fator de desequilíbrio > 0", r1.load.unbalanceFactor > 1);
  near("I₀ = I_N/3 (A)", Math.hypot(r1.load.sequenceCurrents.zero.real, r1.load.sequenceCurrents.zero.imaginary), abs(IN) / 3, 1e-6);

  // Sem neutro: Millman.
  const Y = Zs.map((z) => divc(one, z));
  const VnN = divc(V.map((v, k) => mulc(v, Y[k])).reduce(addc), Y.reduce(addc));
  const In = V.map((v, k) => mulc(subc(v, VnN), Y[k]));
  const r2 = analyze(createThreePhasePreset("YY-u").elements, createThreePhasePreset("YY-u").connections);
  expect("sem neutro: circuito resolvido", r2.results.available);
  near("V_nN (Millman) (V)", Math.hypot(r2.load.neutralShift!.real, r2.load.neutralShift!.imaginary), abs(VnN), 1e-6);
  near("I_A sem neutro (A)", Math.hypot(r2.load.lineCurrents.A.real, r2.load.lineCurrents.A.imaginary), abs(In[0]), 1e-6);
  near("I_B sem neutro (A)", Math.hypot(r2.load.lineCurrents.B.real, r2.load.lineCurrents.B.imaginary), abs(In[1]), 1e-6);
  near("Σ correntes = 0 sem neutro (A)", r2.load.neutralCurrent!, 0, 1e-6);
  near("V na fase A da carga = |V_AN − V_nN| (V)", Math.hypot(r2.load.phaseVoltages.A.real, r2.load.phaseVoltages.A.imaginary), abs(subc(V[0], VnN)), 1e-6);
  near("I₀ = 0 sem neutro (A)", Math.hypot(r2.load.sequenceCurrents.zero.real, r2.load.sequenceCurrents.zero.imaginary), 0, 1e-6);

  // Y-Δ: Z_AB, Z_BC, Z_CA.
  const VL = [polar(220, 30), polar(220, -90), polar(220, 150)];
  const Iph = VL.map((v, k) => divc(v, Zs[k]));
  const IA = subc(Iph[0], Iph[2]);
  const r3 = analyze(createThreePhasePreset("YD-u").elements, createThreePhasePreset("YD-u").connections);
  near("I_AB (A)", Math.hypot(r3.load.phaseCurrents.A.real, r3.load.phaseCurrents.A.imaginary), abs(Iph[0]), 1e-6);
  near("I_A = I_AB − I_CA (A)", Math.hypot(r3.load.lineCurrents.A.real, r3.load.lineCurrents.A.imaginary), abs(IA), 1e-6);
  near("gerador entrega o que a carga absorve (W)", r3.gen.activePower, r3.load.activePower, 0.05);

  // Kennelly: Δ desequilibrado → Y equivalente absorve igual.
  const eq = r3.load.equivalentImpedances!;
  const yy = createThreePhasePreset("YY-u");
  const els = yy.elements.map((e) => (e.group?.kind === "load" ? { ...e, impedance: { ...eq[e.group.role] } } : e));
  const r4 = analyze(els, yy.connections);
  near("Y equivalente (Kennelly) absorve o mesmo P (W)", r4.load.activePower, r3.load.activePower, 1e-3);
  near("e a mesma I_A (A)", Math.hypot(r4.load.lineCurrents.A.real, r4.load.lineCurrents.A.imaginary), abs(IA), 1e-6);

  // Editar uma fase não mexe nas outras; Y→Δ preserva cada Z.
  const p = createThreePhasePreset("YYn-u");
  const edited = p.elements.map((e) => (e.id === "CZB" ? { ...e, impedance: { resistance: 1, reactance: 1 } } : e));
  const kept = enforceBalance(p.elements, edited);
  expect("desequilibrada: só Z_B muda", kept.find((e) => e.id === "CZA")!.impedance!.resistance === 10 && kept.find((e) => e.id === "CZB")!.impedance!.resistance === 1);
  const re = rebuildGroup(p.elements, p.connections, "C", { connection: "D" });
  expect("Y→Δ: Z_AB = antiga Z_A, Z_CA = antiga Z_C", re.elements.find((e) => e.id === "CZAB")!.impedance!.resistance === 10 && re.elements.find((e) => e.id === "CZCA")!.impedance!.reactance === -5);
  expect("continua desequilibrada", re.elements.find((e) => e.id === "CZBC")!.group!.balanced === false);
  const parsed = parseCircuitFile(serializeCircuit(p.elements, p.connections, 60));
  expect("arquivo mantém 'desequilibrada'", parsed.ok && parsed.data.elements.find((e) => e.id === "CZA")!.group!.balanced === false);
}

console.log("\nGerador desequilibrado (127∠0°, 115∠−125°, 135∠118°; carga 8 + j6 Y com neutro)");
{
  type C = { re: number; im: number };
  const c = (re: number, im = 0): C => ({ re, im });
  const polar = (m: number, deg: number): C => c(m * Math.cos((deg * Math.PI) / 180), m * Math.sin((deg * Math.PI) / 180));
  const addc = (a: C, b: C): C => c(a.re + b.re, a.im + b.im);
  const subc = (a: C, b: C): C => c(a.re - b.re, a.im - b.im);
  const mulc = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const divc = (a: C, b: C): C => { const d = b.re ** 2 + b.im ** 2; return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const abs = (a: C) => Math.hypot(a.re, a.im);
  const a1 = polar(1, 120), a2 = polar(1, -120);
  const V = [polar(127, 0), polar(115, -125), polar(135, 118)];
  const Z = c(8, 6);
  const I = V.map((v) => divc(v, Z));
  const IN = I.reduce(addc);
  const V1 = divc(addc(addc(V[0], mulc(a1, V[1])), mulc(a2, V[2])), c(3));
  const V2 = divc(addc(addc(V[0], mulc(a2, V[1])), mulc(a1, V[2])), c(3));
  const V0 = divc(addc(addc(V[0], V[1]), V[2]), c(3));

  const preset = createThreePhasePreset("YYn-us");
  const r = analyze(preset.elements, preset.connections);
  const m = (p: { real: number; imaginary: number }) => Math.hypot(p.real, p.imaginary);
  expect("gerador marcado como desequilibrado", !r.gen.balanced);
  near("I_B = V_BN/Z (A)", m(r.load.lineCurrents.B), abs(I[1]), 1e-6);
  near("I_N (A)", r.load.neutralCurrent!, abs(IN), 1e-6);
  near("V1 (V)", m(r.gen.sequenceVoltages.positive), abs(V1), 1e-6);
  near("V2 (V)", m(r.gen.sequenceVoltages.negative), abs(V2), 1e-6);
  near("V0 (V)", m(r.gen.sequenceVoltages.zero), abs(V0), 1e-6);
  near("desequilíbrio V2/V1 (%)", r.gen.voltageUnbalance, (abs(V2) / abs(V1)) * 100, 1e-6);
  near("V_AB = V_AN − V_BN (V)", m(r.gen.lineVoltages.A), abs(subc(V[0], V[1])), 1e-6);

  // Editar uma fonte não mexe nas outras.
  const edited = enforceBalance(preset.elements, preset.elements.map((e) => (e.id === "GVBN" ? { ...e, value: 100, phase: -100 } : e)));
  expect("Y desequilibrado: só V_BN muda", edited.find((e) => e.id === "GVAN")!.value === 127 && edited.find((e) => e.id === "GVBN")!.phase === -100 && edited.find((e) => e.id === "GVCN")!.phase === 118);

  // Y → Δ mantém as tensões de linha; Δ força V_CA pela LKT.
  const delta = rebuildGroup(preset.elements, preset.connections, "G", { connection: "D" });
  const rd = analyze(delta.elements, delta.connections);
  expect("continua desequilibrado", delta.elements.find((e) => e.id === "GVAB")!.group!.balanced === false);
  near("Δ: V_AB igual ao do Y (V)", m(rd.gen.lineVoltages.A), abs(subc(V[0], V[1])), 1e-4);
  near("Δ: V_CA igual ao do Y (V)", m(rd.gen.lineVoltages.C), abs(subc(V[2], V[0])), 1e-4);
  const changed = enforceBalance(delta.elements, delta.elements.map((e) => (e.id === "GVAB" ? { ...e, value: 230 } : e)));
  const ab = changed.find((e) => e.id === "GVAB")!, bc = changed.find((e) => e.id === "GVBC")!, ca = changed.find((e) => e.id === "GVCA")!;
  const loop = addc(addc(polar(ab.value, ab.phase ?? 0), polar(bc.value, bc.phase ?? 0)), polar(ca.value, ca.phase ?? 0));
  near("Δ: V_AB + V_BC + V_CA = 0 depois de editar V_AB (V)", abs(loop), 0, 1e-6);
  const rc = analyze(changed, delta.connections);
  expect("Δ desequilibrado resolve sem corrente absurda", rc.results.available && rc.gen.lineCurrent < 100);

  // Volta para Y: estrela sem sequência zero, mesmas tensões de linha.
  const back = rebuildGroup(delta.elements, delta.connections, "G", { connection: "Y" });
  const rb = analyze(back.elements, back.connections);
  near("Δ → Y: V_BC preservada (V)", m(rb.gen.lineVoltages.B), abs(subc(V[1], V[2])), 1e-4);
  near("Δ → Y: V0 = 0", m(rb.gen.sequenceVoltages.zero), 0, 1e-6);
}

console.log(failures === 0 ? "\nTrifásico: todos os testes passaram." : `\nTrifásico: ${failures} FALHA(S).`);
