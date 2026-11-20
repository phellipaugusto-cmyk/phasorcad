import type { CircuitElement, ThreePhaseRole } from "../core/CircuitElement";
import type { MnaElectricalResults } from "../core/MnaElectricalResults";
import {
  analyzeThreePhase,
  correctPowerFactor,
  type ThreePhaseGroupAnalysis,
} from "../solver/threePhaseAnalysis";
import {
  impedanceSymbol,
  lineCurrentSymbol,
  lineVoltageSymbol,
  phaseCurrentSymbol,
  phaseVoltageSymbol,
  plain,
  powerFactorText,
} from "../core/threePhaseNotation";
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

/* Nomes da apostila em texto corrido: EAN, Van, IAa, Ian, Z1… */
const nm = {
  ev: (g: ThreePhaseGroupAnalysis, r: ThreePhaseRole) => plain(phaseVoltageSymbol(g, r)),
  el: (g: ThreePhaseGroupAnalysis, r: ThreePhaseRole) => plain(lineVoltageSymbol(g, r)),
  ip: (g: ThreePhaseGroupAnalysis, r: ThreePhaseRole) => plain(phaseCurrentSymbol(g, r)),
  il: (r: ThreePhaseRole) => plain(lineCurrentSymbol(r)),
  z: (r: ThreePhaseRole) => plain(impedanceSymbol(r)),
};

function powerLines(g: ThreePhaseGroupAnalysis, isLoad: boolean): string[] {
  const lines: string[] = [];
  const label = isLoad ? "absorvida" : "entregue";

  lines.push(`# Potência ${label} (Sφ = Vφ·Iφ* em cada fase)`);

  if (g.balanced) {
    const s = g.phasePowers.A;
    lines.push(
      `Sφ = ${nm.ev(g, "A")}·${nm.ip(g, "A")}* = ${pol(g.phaseVoltages.A, "V")} · ${pol(conj(g.phaseCurrents.A), "A")} = ${rect(s, "VA", 1)}`,
      `PT = 3·Pφ = ${n(g.activePower, 1)} W;  QT = 3·Qφ = ${n(g.reactivePower, 1)} VAR;  ST = √(PT² + QT²) = ${n(g.apparentPower, 1)} VA`,
      `Fp = PT/ST = ${powerFactorText(g.powerFactor, g.reactivePower)}`,
      `Conferência: PT = √3·EL·IL·cos θ = 1,732 · ${n(g.lineVoltage)} · ${n(g.lineCurrent, 3)} · ${n(g.powerFactor, 3)} = ${n(g.formulaPower, 1)} W`
    );
  } else {
    ROLES.forEach((r) => {
      const s = g.phasePowers[r];
      lines.push(
        `S${isLoad ? nm.z(r).slice(1) : r} = ${nm.ev(g, r)}·${nm.ip(g, r)}* = ${pol(g.phaseVoltages[r], "V")} · ${pol(conj(g.phaseCurrents[r]), "A")} = ${rect(s, "VA", 1)}`
      );
    });
    lines.push(
      `ST = S1 + S2 + S3 = ${rect(c(g.activePower, g.reactivePower), "VA", 1)}  →  PT = ${n(g.activePower, 1)} W, QT = ${n(g.reactivePower, 1)} VAR, Fp = ${powerFactorText(g.powerFactor, g.reactivePower)}`,
      "(desequilibrado: soma-se fase a fase; √3·EL·IL·cos θ não se aplica)"
    );
  }

  return lines;
}

function sequenceLines(g: ThreePhaseGroupAnalysis): string[] {
  const I = g.lineCurrents;
  return [
    "# Componentes simétricas das correntes de linha (a = 1∠120°)",
    `I0 = (IAa + IBb + ICc)/3 = ${pol(g.sequenceCurrents.zero, "A", 3)}`,
    `I1 = (IAa + a·IBb + a²·ICc)/3 = (${pol(I.A)} + 1∠120°·${pol(I.B)} + 1∠240°·${pol(I.C)})/3 = ${pol(g.sequenceCurrents.positive, "A", 3)}`,
    `I2 = (IAa + a²·IBb + a·ICc)/3 = ${pol(g.sequenceCurrents.negative, "A", 3)}`,
    `Desequilíbrio = |I2|/|I1| = ${n(abs(g.sequenceCurrents.negative), 3)} / ${n(abs(g.sequenceCurrents.positive), 3)} = ${n(g.unbalanceFactor, 1)} %`,
  ];
}

function sourceBlock(g: ThreePhaseGroupAnalysis): CalculationBlock {
  const lines: string[] = [];
  const V = g.phaseVoltages;

  if (g.connection === "Y") {
    if (g.voltageUnbalance < 0.01) {
      lines.push(
        "# Tensões de fase e de linha (gerador em Y)",
        `Eφ = EL/√3 = ${n(g.lineVoltage)}/1,732 = ${n(g.phaseVoltage)} V`,
        `EAN = ${pol(V.A, "V")} (referência);  EBN = ${pol(V.B, "V")};  ECN = ${pol(V.C, "V")}`,
        `EAB = EAN − EBN = √3·EAN∠${g.sequence === "ABC" ? "+" : "−"}30° = ${pol(g.lineVoltages.A, "V")}`,
        `EBC = ${pol(g.lineVoltages.B, "V")};  ECA = ${pol(g.lineVoltages.C, "V")};  EAB + EBC + ECA = 0`
      );
    } else {
      lines.push(
        "# Tensões de linha a partir das de fase (Y desequilibrado)",
        ...ROLES.map((r) => {
          const next: ThreePhaseRole = r === "A" ? "B" : r === "B" ? "C" : "A";
          return `E${PAIR[r]} = E${r}N − E${next}N = ${pol(V[r])} − ${pol(V[next])} = ${pol(g.lineVoltages[r], "V")}`;
        })
      );
    }
  } else {
    lines.push(
      "# Tensões (gerador em Δ: EL = Eφ, cada enrolamento entre duas linhas)",
      `EAB = ${pol(V.A, "V")} (referência);  EBC = ${pol(V.B, "V")};  ECA = ${pol(V.C, "V")}`,
      `Malha do triângulo: EAB + EBC + ECA = ${pol(add(add(V.A, V.B), V.C), "V")}`
    );
    if (g.balanced) {
      lines.push(
        "# Correntes nos enrolamentos e nas linhas (Δ: IAa = IBA − IAC)",
        `IBA = ${pol(g.phaseCurrents.A, "A", 3)};  IAa = √3·IBA∠−30° = ${pol(g.lineCurrents.A, "A", 3)}`
      );
    }
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
  hasYSource: boolean
): CalculationBlock {
  const lines: string[] = [];
  const Z = Object.fromEntries(
    members.map((m) => [m.group!.role, zOf(m, frequency)])
  ) as Record<ThreePhaseRole, C>;
  const V = g.phaseVoltages;
  const I = g.phaseCurrents;
  const L = g.lineVoltages;

  lines.push("# Impedâncias (retangular → polar)");
  if (g.balanced) {
    lines.push(`Z1 = Z2 = Z3 = ${rect(Z.A, "Ω")} = ${pol(Z.A, "Ω")}   (θ = ${n(arg(Z.A))}°, cos θ = ${n(Math.cos((arg(Z.A) * Math.PI) / 180), 3)})`);
  } else {
    ROLES.forEach((r) => lines.push(`${nm.z(r)} = ${rect(Z[r], "Ω")} = ${pol(Z[r], "Ω")}`));
  }

  if (g.connection === "Y") {
    const shift = g.neutralShift ? abs(g.neutralShift) : 0;

    if (shift > 1e-6) {
      /* Apostila, eqs. 23.38 a 23.40 (carga em Y a três fios). */
      const D = add(add(mul(Z.A, Z.B), mul(Z.A, Z.C)), mul(Z.B, Z.C));
      lines.push(
        "# Carga em Y a três fios, desequilibrada (apostila, eqs. 23.38 a 23.40)",
        `Linhas: EAB = ${pol(L.A, "V")};  EBC = ${pol(L.B, "V")};  ECA = ${pol(L.C, "V")}`,
        `Denominador: Z1Z2 + Z1Z3 + Z2Z3 = ${pol(D, "Ω²")}`,
        `Ian = (EAB·Z3 − ECA·Z2)/(Z1Z2 + Z1Z3 + Z2Z3) = ${pol(I.A, "A", 3)}`,
        `Ibn = (EBC·Z1 − EAB·Z3)/(Z1Z2 + Z1Z3 + Z2Z3) = ${pol(I.B, "A", 3)}`,
        `Icn = (ECA·Z2 − EBC·Z1)/(Z1Z2 + Z1Z3 + Z2Z3) = ${pol(I.C, "A", 3)}`,
        "# Tensões de fase na carga: Van = Ian·Z1, Vbn = Ibn·Z2, Vcn = Icn·Z3",
        ...ROLES.map((r) => `${nm.ev(g, r)} = ${pol(I[r])} · ${pol(Z[r])} = ${pol(V[r], "V")}`),
        hasYSource
          ? `Deslocamento do neutro (n em relação a N): VnN = ${pol(g.neutralShift!, "V")} — sem o neutro, as tensões de fase deixam de ser iguais às do gerador.`
          : "As tensões de fase da carga ficam diferentes entre si: o ponto n não está preso a um neutro."
      );
    } else {
      lines.push(
        g.balanced
          ? "# Tensões de fase (Y: Vφ = Eφ = EL/√3)"
          : "# Tensões de fase (Y a quatro fios: Vφ = Eφ em cada fase, eq. 23.34)",
        g.balanced
          ? `Vφ = ${n(g.lineVoltage)}/1,732 = ${n(g.phaseVoltage)} V;  Van = ${pol(V.A, "V")}`
          : ROLES.map((r) => `${nm.ev(g, r)} = ${pol(V[r], "V")}`).join(";  "),
        "# Correntes (Y: IL = Iφ;  Iφ = Vφ/Zφ, eq. 23.35)"
      );
      if (g.balanced) {
        lines.push(
          `Ian = Van/Z1 = ${pol(V.A, "V")} / ${pol(Z.A, "Ω")} = ${pol(I.A, "A", 3)}`,
          `Ibn = ${pol(I.B, "A", 3)};  Icn = ${pol(I.C, "A", 3)}  (mesmo módulo, defasadas de 120°)`
        );
      } else {
        ROLES.forEach((r) =>
          lines.push(`${nm.ip(g, r)} = ${nm.ev(g, r)}/${nm.z(r)} = ${pol(V[r], "V")} / ${pol(Z[r], "Ω")} = ${pol(I[r], "A", 3)} = ${rect(I[r], "A", 2)}`)
        );
      }
    }

    if (g.neutralCurrentPhasor) {
      lines.push(
        `IN = Ian + Ibn + Icn = ${pol(g.neutralCurrentPhasor, "A", 3)}` +
          (abs(g.neutralCurrentPhasor) < 1e-6
            ? g.balanced
              ? "  (carga equilibrada: IN = 0)"
              : "  (sem neutro, a soma é zero)"
            : "  (eq. 23.36: corrente no neutro)")
      );
    }
  } else {
    lines.push(
      "# Tensões (carga em Δ: Vφ = EL)",
      `Vab = ${pol(V.A, "V")};  Vbc = ${pol(V.B, "V")};  Vca = ${pol(V.C, "V")}`,
      "# Correntes de fase (Iφ = Vφ/Zφ)"
    );
    ROLES.forEach((r) =>
      lines.push(`${nm.ip(g, r)} = ${nm.ev(g, r)}/${nm.z(r)} = ${pol(V[r], "V")} / ${pol(Z[r], "Ω")} = ${pol(I[r], "A", 3)}`)
    );
    lines.push("# Correntes de linha (lei de Kirchhoff para correntes nos nós a, b, c)");
    ROLES.forEach((r) =>
      lines.push(
        `${nm.il(r)} = ${nm.ip(g, r)} − ${nm.ip(g, PREV[r])} = ${pol(I[r])} − ${pol(I[PREV[r]])} = ${pol(g.lineCurrents[r], "A", 3)}`
      )
    );
    if (g.balanced) {
      lines.push(`Carga equilibrada: IL = √3·Iφ = 1,732 · ${n(g.phaseCurrent, 3)} = ${n(g.lineCurrent, 3)} A, atrasada 30° da corrente de fase (ABC)`);
    }
  }

  lines.push(...powerLines(g, true));

  /* Método dos dois wattímetros (linha C comum). */
  lines.push(
    "# Método dos dois wattímetros (bobinas de corrente nas linhas A e B, linha C comum)",
    `W1 = Re{Vac·IAa*} = ${n(g.wattmeters.w1, 1)} W;  W2 = Re{Vbc·IBb*} = ${n(g.wattmeters.w2, 1)} W`,
    g.wattmeters.valid
      ? `W1 + W2 = ${n(g.wattmeters.sum, 1)} W = PT`
      : `W1 + W2 = ${n(g.wattmeters.sum, 1)} W ≠ PT (há corrente no neutro: o método vale para sistemas a três fios)`
  );

  if (!g.balanced) {
    lines.push(...sequenceLines(g));
  }

  /* Correção do FP para 0,92 (apostila 8.11), se a carga for indutiva abaixo disso. */
  const correction = correctPowerFactor(g.activePower, g.reactivePower, g.lineVoltage, frequency, 0.92);
  if (correction && correction.needed) {
    const theta = Math.acos(g.powerFactor);
    const thetaNew = Math.acos(0.92);
    lines.push(
      "# Correção do fator de potência para 0,92 (apostila, seção 8.11)",
      `θ = arccos ${n(g.powerFactor, 3)} = ${n((theta * 180) / Math.PI)}°;  θ′ = arccos 0,92 = ${n((thetaNew * 180) / Math.PI)}°`,
      `QC = PT·(tan θ − tan θ′) = ${n(g.activePower, 1)}·(${n(Math.tan(theta), 4)} − ${n(Math.tan(thetaNew), 4)}) = ${n(correction.capacitorReactive, 1)} VAR;  QCφ = QC/3 = ${n(correction.perPhaseReactive, 1)} VAR`,
      `CΔ = QCφ/(ω·EL²) = ${n(correction.perPhaseReactive, 1)}/(${n(2 * Math.PI * frequency, 1)}·${n(g.lineVoltage)}²) = ${n(correction.deltaCapacitance * 1e6, 2)} µF por fase;  CY = 3·CΔ = ${n(correction.starCapacitance * 1e6, 2)} µF`,
      `IL = ST/(√3·EL): antes ${n(correction.lineCurrentBefore, 2)} A, depois ${n(correction.lineCurrentAfter, 2)} A`
    );
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
        "Kennelly (Δ → Y): Za = Z1·Z3/ΣZ, Zb = Z1·Z2/ΣZ, Zc = Z2·Z3/ΣZ",
        `ΣZ = Z1 + Z2 + Z3 = ${rect(add(add(Z.A, Z.B), Z.C), "Ω")}`,
        ...ROLES.map((r) => `Z${r.toLowerCase()} = ${rect(c(eq[r].resistance, eq[r].reactance), "Ω")}`)
      );
    } else {
      const P = add(add(mul(Z.A, Z.B), mul(Z.B, Z.C)), mul(Z.C, Z.A));
      lines.push(
        "Kennelly (Y → Δ): P = Z1·Z2 + Z2·Z3 + Z3·Z1;  Zab = P/Z3, Zbc = P/Z1, Zca = P/Z2",
        `P = ${rect(P, "Ω²", 1)}`,
        ...ROLES.map((r) => `Z${PAIR[r].toLowerCase()} = ${rect(c(eq[r].resistance, eq[r].reactance), "Ω")}`)
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

  const hasYSource = groups.some((g) => g.kind === "source" && g.connection === "Y");

  const blocks: CalculationBlock[] = [
    {
      title: "Dados e convenções",
      lines: [
        `f = ${n(frequency, 1)} Hz; fasores em valor eficaz; ângulos em graus.`,
        "Reatâncias informadas em 60 Hz: X(f) = X60·f/60 (indutiva) ou X60·60/f (capacitiva).",
        "Notação da apostila: gerador com nós A, B, C, N e tensões E; carga com nós a, b, c, n, tensões V e impedâncias Z1, Z2, Z3.",
        "Correntes de linha IAa, IBb, ICc; de fase Ian (Y) ou Iab (Δ); Fp atrasado = indutivo, adiantado = capacitivo.",
        "Sequência ABC: gerador Y com EAN∠0° (referência); gerador Δ com EAB∠0° (referência).",
      ],
    },
  ];

  groups
    .filter((g) => g.kind === "source")
    .forEach((g) => blocks.push(sourceBlock(g)));

  groups
    .filter((g) => g.kind === "load")
    .forEach((g) =>
      blocks.push(loadBlock(g, getGroupMembers(elements, g.groupId), frequency, hasYSource))
    );

  return blocks;
}
