import type { CircuitElement, ThreePhaseRole } from "../core/CircuitElement";
import type { MnaElectricalResults } from "../core/MnaElectricalResults";
import {
  analyzeThreePhase,
  type ThreePhaseGroupAnalysis,
} from "../solver/threePhaseAnalysis";
import { getImpedanceAt } from "../core/impedanceModel";
import { getGroupMembers } from "../core/threePhase";
import { isSourceType } from "../core/CircuitElement";

/*
 * Memória de cálculo do relatório: as contas "de mão" com os
 * números do circuito substituídos (fórmula → substituição →
 * resultado). Só usa caracteres que as fontes padrão do PDF têm
 * (Helvetica + Symbol): nada de subscritos Unicode.
 */

export interface CalculationBlock {
  title: string;
  /* Linhas que começam com "# " saem em negrito (subtítulos). */
  lines: string[];
}

type C = { real: number; imaginary: number };

const ROLES: ThreePhaseRole[] = ["A", "B", "C"];
const PAIR: Record<ThreePhaseRole, string> = { A: "AB", B: "BC", C: "CA" };
const PREV: Record<ThreePhaseRole, ThreePhaseRole> = { A: "C", B: "A", C: "B" };

const c = (real: number, imaginary = 0): C => ({ real, imaginary });
const add = (a: C, b: C) => c(a.real + b.real, a.imaginary + b.imaginary);
const mul = (a: C, b: C) =>
  c(a.real * b.real - a.imaginary * b.imaginary, a.real * b.imaginary + a.imaginary * b.real);
const div = (a: C, b: C) => {
  const d = b.real ** 2 + b.imaginary ** 2;
  return d > 0
    ? c((a.real * b.real + a.imaginary * b.imaginary) / d, (a.imaginary * b.real - a.real * b.imaginary) / d)
    : c(0);
};
const conj = (a: C) => c(a.real, -a.imaginary);
const abs = (a: C) => Math.hypot(a.real, a.imaginary);
const arg = (a: C) => (abs(a) < 1e-12 ? 0 : (Math.atan2(a.imaginary, a.real) * 180) / Math.PI);

/* Número com vírgula e "−"; zero "limpo". */
export function n(value: number, digits = 2): string {
  const v = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return v.toFixed(digits).replace(".", ",").replace("-", "−");
}

/* Forma polar: 127,02∠−36,87° */
export function pol(z: C, unit = "", digits = 2): string {
  return `${n(abs(z), digits)}∠${n(arg(z), 2)}°${unit ? ` ${unit}` : ""}`;
}

/* Forma retangular: 10,16 − j7,62 */
export function rect(z: C, unit = "", digits = 2): string {
  const sign = z.imaginary < 0 ? "−" : "+";
  return `${n(z.real, digits)} ${sign} j${n(Math.abs(z.imaginary), digits)}${unit ? ` ${unit}` : ""}`;
}


function zOf(member: CircuitElement, frequency: number): C {
  const z = getImpedanceAt(member, frequency);
  return c(z.resistance, z.reactance);
}

function powerLines(g: ThreePhaseGroupAnalysis, isLoad: boolean): string[] {
  const lines: string[] = [];
  const label = isLoad ? "absorvida" : "entregue";
  const vName = g.connection === "Y" ? (r: ThreePhaseRole) => `V${r}N` : (r: ThreePhaseRole) => `V${PAIR[r]}`;
  const iName = g.connection === "Y" ? (r: ThreePhaseRole) => `I${r}` : (r: ThreePhaseRole) => `I${PAIR[r]}`;

  lines.push(`# Potência ${label} (S = V·I* por fase)`);

  if (g.balanced) {
    const s = g.phasePowers.A;
    lines.push(
      `S fase = ${vName("A")}·${iName("A")}* = ${pol(g.phaseVoltages.A, "V")} · ${pol(conj(g.phaseCurrents.A), "A")} = ${rect(s, "VA", 1)}`,
      `S total = 3·S fase = ${rect(c(g.activePower, g.reactivePower), "VA", 1)}  →  P = ${n(g.activePower, 1)} W, Q = ${n(g.reactivePower, 1)} var`,
      `|S| = √(P² + Q²) = ${n(g.apparentPower, 1)} VA;  FP = P/|S| = ${n(g.powerFactor, 3)}`,
      `Conferência: P = √3·VL·IL·FP = 1,732 · ${n(g.lineVoltage)} · ${n(g.lineCurrent, 3)} · ${n(g.powerFactor, 3)} = ${n(g.formulaPower, 1)} W`
    );
  } else {
    ROLES.forEach((r) => {
      const s = g.phasePowers[r];
      lines.push(
        `S ${g.connection === "Y" ? r : PAIR[r]} = ${vName(r)}·${iName(r)}* = ${pol(g.phaseVoltages[r], "V")} · ${pol(conj(g.phaseCurrents[r]), "A")} = ${rect(s, "VA", 1)}`
      );
    });
    lines.push(
      `S total = Σ S fase = ${rect(c(g.activePower, g.reactivePower), "VA", 1)}  →  P = ${n(g.activePower, 1)} W, Q = ${n(g.reactivePower, 1)} var, FP = ${n(g.powerFactor, 3)}`,
      "(desequilibrado: √3·VL·IL·FP não se aplica; soma-se fase a fase)"
    );
  }

  return lines;
}

function sequenceLines(g: ThreePhaseGroupAnalysis): string[] {
  const I = g.lineCurrents;
  return [
    "# Componentes simétricas das correntes de linha (a = 1∠120°)",
    `I0 = (IA + IB + IC)/3 = ${pol(g.sequenceCurrents.zero, "A", 3)}`,
    `I1 = (IA + a·IB + a²·IC)/3 = (${pol(I.A)} + 1∠120°·${pol(I.B)} + 1∠240°·${pol(I.C)})/3 = ${pol(g.sequenceCurrents.positive, "A", 3)}`,
    `I2 = (IA + a²·IB + a·IC)/3 = ${pol(g.sequenceCurrents.negative, "A", 3)}`,
    `Desequilíbrio = |I2|/|I1| = ${n(abs(g.sequenceCurrents.negative), 3)} / ${n(abs(g.sequenceCurrents.positive), 3)} = ${n(g.unbalanceFactor, 1)} %`,
  ];
}

function sourceBlock(g: ThreePhaseGroupAnalysis): CalculationBlock {
  const lines: string[] = [];
  const V = g.phaseVoltages;

  if (g.connection === "Y") {
    if (g.voltageUnbalance < 0.01) {
      lines.push(
        "# Tensões de fase e de linha (Y equilibrado)",
        `VF = VL/√3 = ${n(g.lineVoltage)}/1,732 = ${n(g.phaseVoltage)} V`,
        `VAN = ${pol(V.A, "V")};  VBN = ${pol(V.B, "V")};  VCN = ${pol(V.C, "V")}`,
        `VAB = VAN − VBN = √3·VAN∠${g.sequence === "ABC" ? "+" : "−"}30° = ${pol(g.lineVoltages.A, "V")}`
      );
    } else {
      lines.push(
        "# Tensões de linha a partir das de fase (Y desequilibrado)",
        ...ROLES.map((r) => {
          const next: ThreePhaseRole = r === "A" ? "B" : r === "B" ? "C" : "A";
          return `V${PAIR[r]} = V${r}N − V${next}N = ${pol(V[r])} − ${pol(V[next])} = ${pol(g.lineVoltages[r], "V")}`;
        })
      );
    }
  } else {
    lines.push(
      "# Tensões (Δ: cada fonte está entre duas linhas, VL = VF)",
      `VAB = ${pol(V.A, "V")};  VBC = ${pol(V.B, "V")};  VCA = ${pol(V.C, "V")}`,
      `LKT na malha: VAB + VBC + VCA = ${pol(add(add(V.A, V.B), V.C), "V")}`
    );
  }

  if (g.voltageUnbalance >= 0.01) {
    lines.push(
      "# Componentes simétricas das tensões",
      `V0 = ${pol(g.sequenceVoltages.zero, "V")};  V1 = ${pol(g.sequenceVoltages.positive, "V")};  V2 = ${pol(g.sequenceVoltages.negative, "V")}`,
      `Desequilíbrio de tensão = |V2|/|V1| = ${n(g.voltageUnbalance, 2)} %`
    );
  }

  lines.push(...powerLines(g, false));

  return {
    title: `${g.name} — ligação ${g.connection === "Y" ? "Y" : "Δ"}, ${g.voltageUnbalance < 0.01 ? "tensões equilibradas" : "tensões desequilibradas"}`,
    lines,
  };
}

function loadBlock(
  g: ThreePhaseGroupAnalysis,
  members: CircuitElement[],
  frequency: number,
  sourcePhase: Record<ThreePhaseRole, C> | null
): CalculationBlock {
  const lines: string[] = [];
  const Z = Object.fromEntries(
    members.map((m) => [m.group!.role, zOf(m, frequency)])
  ) as Record<ThreePhaseRole, C>;
  const V = g.phaseVoltages;
  const I = g.phaseCurrents;

  lines.push("# Impedâncias (forma retangular → polar)");
  if (g.balanced) {
    lines.push(`Z = ${rect(Z.A, "Ω")} = ${pol(Z.A, "Ω")}   (φ = ${n(arg(Z.A))}°, FP = cos φ = ${n(Math.cos((arg(Z.A) * Math.PI) / 180), 3)})`);
  } else {
    ROLES.forEach((r) =>
      lines.push(`Z${g.connection === "Y" ? r : PAIR[r]} = ${rect(Z[r], "Ω")} = ${pol(Z[r], "Ω")}`)
    );
  }

  if (g.connection === "Y") {
    const shift = g.neutralShift ? abs(g.neutralShift) : 0;

    if (shift > 1e-6 && sourcePhase) {
      const Y = Object.fromEntries(ROLES.map((r) => [r, div(c(1), Z[r])])) as Record<ThreePhaseRole, C>;
      const num = ROLES.reduce((s, r) => add(s, mul(sourcePhase[r], Y[r])), c(0));
      const den = ROLES.reduce((s, r) => add(s, Y[r]), c(0));
      lines.push(
        "# Deslocamento do neutro (sem fio de neutro): Millman",
        `YA = 1/ZA = ${rect(Y.A, "S", 4)};  YB = ${rect(Y.B, "S", 4)};  YC = ${rect(Y.C, "S", 4)}`,
        "VnN = (VAN·YA + VBN·YB + VCN·YC) / (YA + YB + YC)",
        `VnN = (${rect(num, "", 3)}) / (${rect(den, "", 4)}) = ${pol(div(num, den), "V")}`,
        "# Tensões nas fases da carga: Van = VAN − VnN",
        ...ROLES.map((r) => `V${r.toLowerCase()}n = ${pol(sourcePhase[r])} − ${pol(g.neutralShift!)} = ${pol(V[r], "V")}`)
      );
    } else if (g.balanced) {
      lines.push(
        "# Tensão de fase (Y: VF = VL/√3)",
        `VF = ${n(g.lineVoltage)}/1,732 = ${n(g.phaseVoltage)} V;  VAN = ${pol(V.A, "V")}`
      );
    } else {
      lines.push(
        sourcePhase
          ? "# Tensões de fase (com neutro, cada fase fica com a tensão do gerador)"
          : "# Tensões nas fases da carga (gerador em Δ: obtidas da solução nodal)",
        ...ROLES.map((r) => `V${r}N = ${pol(V[r], "V")}`)
      );
    }

    lines.push("# Correntes (Y: corrente de linha = corrente de fase)");
    if (g.balanced) {
      lines.push(
        `IA = VAN/Z = ${pol(V.A, "V")} / ${pol(Z.A, "Ω")} = ${pol(I.A, "A", 3)}`,
        `IB = IA∠${g.sequence === "ACB" ? "+" : "−"}120° = ${pol(I.B, "A", 3)};  IC = ${pol(I.C, "A", 3)}`
      );
    } else {
      const vn = shift > 1e-6 ? (r: string) => `V${r.toLowerCase()}n` : (r: string) => `V${r}N`;
      ROLES.forEach((r) =>
        lines.push(`I${r} = ${vn(r)}/Z${r} = ${pol(V[r], "V")} / ${pol(Z[r], "Ω")} = ${pol(I[r], "A", 3)}`)
      );
    }

    if (g.neutralCurrentPhasor) {
      lines.push(
        `IA + IB + IC = ${rect(I.A, "", 3)} + ${rect(I.B, "", 3)} + ${rect(I.C, "", 3)} = ${pol(g.neutralCurrentPhasor, "A", 3)}` +
          (abs(g.neutralCurrentPhasor) < 1e-6
            ? g.balanced
              ? "  (equilibrado: neutro sem corrente)"
              : "  (sem fio de neutro, a soma é zero)"
            : "  (= corrente no neutro)")
      );
    }
  } else {
    lines.push(
      "# Tensões (Δ: cada Z está entre duas linhas, VF = VL)",
      `VAB = ${pol(V.A, "V")};  VBC = ${pol(V.B, "V")};  VCA = ${pol(V.C, "V")}`,
      "# Correntes de fase"
    );
    ROLES.forEach((r) =>
      lines.push(`I${PAIR[r]} = V${PAIR[r]}/Z${PAIR[r]} = ${pol(V[r], "V")} / ${pol(Z[r], "Ω")} = ${pol(I[r], "A", 3)}`)
    );
    lines.push("# Correntes de linha (LKC nos nós do triângulo)");
    ROLES.forEach((r) =>
      lines.push(
        `I${r} = I${PAIR[r]} − I${PAIR[PREV[r]]} = ${pol(I[r])} − ${pol(I[PREV[r]])} = ${pol(g.lineCurrents[r], "A", 3)}`
      )
    );
    if (g.balanced) {
      lines.push(`Equilibrado: IL = √3·IF = 1,732 · ${n(g.phaseCurrent, 3)} = ${n(g.lineCurrent, 3)} A, defasada −30° (ABC)`);
    }
  }

  lines.push(...powerLines(g, true));

  if (!g.balanced) {
    lines.push(...sequenceLines(g));
  }

  if (g.impedances && g.equivalentImpedances) {
    const eq = g.equivalentImpedances;
    lines.push(`# Equivalente na outra ligação`);
    if (g.balanced) {
      lines.push(
        g.connection === "Y"
          ? `ZΔ = 3·ZY = 3·(${rect(Z.A)}) = ${rect(c(eq.A.resistance, eq.A.reactance), "Ω")}`
          : `ZY = ZΔ/3 = (${rect(Z.A)})/3 = ${rect(c(eq.A.resistance, eq.A.reactance), "Ω")}`
      );
    } else if (g.connection === "D") {
      lines.push(
        "Kennelly: ZA = ZAB·ZCA/ΣZ, ZB = ZAB·ZBC/ΣZ, ZC = ZBC·ZCA/ΣZ",
        `ΣZ = ZAB + ZBC + ZCA = ${rect(add(add(Z.A, Z.B), Z.C), "Ω")}`,
        ...ROLES.map((r) => `Z${r} = ${rect(c(eq[r].resistance, eq[r].reactance), "Ω")}`)
      );
    } else {
      const P = add(add(mul(Z.A, Z.B), mul(Z.B, Z.C)), mul(Z.C, Z.A));
      lines.push(
        "Kennelly: P = ZA·ZB + ZB·ZC + ZC·ZA;  ZAB = P/ZC, ZBC = P/ZA, ZCA = P/ZB",
        `P = ${rect(P, "Ω²", 1)}`,
        ...ROLES.map((r) => `Z${PAIR[r]} = ${rect(c(eq[r].resistance, eq[r].reactance), "Ω")}`)
      );
    }
  }

  return {
    title: `${g.name} — ligação ${g.connection === "Y" ? "Y" : "Δ"}, ${g.balanced ? "equilibrada" : "desequilibrada"}`,
    lines,
  };
}

/*
 * Circuitos sem blocos trifásicos: lei de Ohm fasorial em cada
 * componente e o balanço de potências.
 */
function genericBlocks(
  elements: CircuitElement[],
  results: MnaElectricalResults
): CalculationBlock[] {
  const lines: string[] = ["# Em cada componente: Z = V/I e S = V·I*"];
  let delivered = c(0);
  let absorbed = c(0);

  elements.forEach((element) => {
    const r = results.elementResults.find((x) => x.elementId === element.id);

    if (!r || r.isBypassed) {
      return;
    }

    const V = r.voltage as C;
    const I = r.current as C;
    const S = r.complexPower as C;

    if (isSourceType(element.type)) {
      /*
       * Fonte: tensão no terminal (+ = direito) e corrente que ela
       * entrega, de modo que S entregue = V·I*.
       */
      const sDel = c(-S.real, -S.imaginary);
      const vTerm = element.type === "source" ? c(-V.real, -V.imaginary) : V;
      const iOut = abs(vTerm) > 1e-12 ? conj(div(sDel, vTerm)) : I;
      delivered = add(delivered, sDel);
      lines.push(
        `${element.label}: V = ${pol(vTerm, "V")}, I entregue = ${pol(iOut, "A", 4)};  S = V·I* = ${rect(sDel, "VA", 3)}`
      );
      return;
    }

    absorbed = add(absorbed, S);

    if (abs(I) < 1e-12) {
      lines.push(`${element.label}: V = ${pol(V, "V")}, I = 0 (aberto)`);
      return;
    }

    lines.push(
      `${element.label}: Z = V/I = ${pol(V, "V")} / ${pol(I, "A", 4)} = ${pol(div(V, I), "Ω")};  S = V·I* = ${rect(S, "VA", 3)}`
    );
  });

  lines.push(
    "# Balanço de potências (Tellegen: o que as fontes entregam, as cargas absorvem)",
    `Σ S fontes = ${rect(delivered, "VA", 3)};  Σ S cargas = ${rect(absorbed, "VA", 3)}`
  );

  return [{ title: "Lei de Ohm fasorial e potências", lines }];
}

export function buildCalculationBlocks(
  elements: CircuitElement[],
  results: MnaElectricalResults,
  frequency: number
): CalculationBlock[] {
  if (!results.available) {
    return [];
  }

  const groups = analyzeThreePhase(elements, results, frequency);

  if (groups.length === 0) {
    return genericBlocks(elements, results);
  }

  /* Tensões de fase do primeiro gerador em Y (para Millman). */
  const ySource = groups.find((g) => g.kind === "source" && g.connection === "Y");
  const sourcePhase = ySource ? ySource.phaseVoltages : null;

  const blocks: CalculationBlock[] = [
    {
      title: "Dados e convenções",
      lines: [
        `f = ${n(frequency, 1)} Hz; fasores em valor eficaz; ângulos em graus.`,
        "Reatâncias informadas em 60 Hz: X(f) = X60·f/60 (indutiva) ou X60·60/f (capacitiva).",
        "Sequência ABC: VAN∠0°, VBN∠−120°, VCN∠+120°; VAB = VAN − VBN.",
      ],
    },
  ];

  groups
    .filter((g) => g.kind === "source")
    .forEach((g) => blocks.push(sourceBlock(g)));

  groups
    .filter((g) => g.kind === "load")
    .forEach((g) =>
      blocks.push(loadBlock(g, getGroupMembers(elements, g.groupId), frequency, sourcePhase))
    );

  return blocks;
}
