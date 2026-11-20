import { useState } from "react";
import type { ThreePhaseGroupAnalysis } from "../../solver/threePhaseAnalysis";
import { angleDegrees, correctPowerFactor, magnitude } from "../../solver/threePhaseAnalysis";
import { formatImpedance } from "../../core/impedanceModel";
import {
  impedanceSymbol,
  lineCurrentSymbol,
  lineVoltageSymbol,
  phaseCurrentSymbol,
  phaseVoltageSymbol,
  powerFactorText,
  type Symbol,
} from "../../core/threePhaseNotation";

interface ThreePhasePanelProps {
  groups: ThreePhaseGroupAnalysis[];
  frequency: number;
}

const fmt = (value: number, digits = 2) =>
  Number(value.toFixed(digits))
    .toString()
    .replace(".", ",")
    .replace(/^-/, "−");

type P = { real: number; imaginary: number };

const phasor = (p: P, unit: string, digits = 2) =>
  magnitude(p) < 1e-9 ? `0 ${unit}` : `${fmt(magnitude(p), digits)} ${unit} ∠${fmt(angleDegrees(p), 2)}°`;

/* Símbolo com índice subscrito, como na apostila: E_AN, V_an, I_Aa. */
function S({ s }: { s: Symbol }) {
  return (
    <span style={{ fontStyle: "italic", whiteSpace: "nowrap" }}>
      <strong>{s.base}</strong>
      <sub>{s.sub}</sub>
    </span>
  );
}

const CONNECTION = { Y: "Y (estrela)", D: "Δ (triângulo)" };
const ROLES = ["A", "B", "C"] as const;

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "8px 10px",
  marginTop: "8px",
  fontSize: "13px",
};

/* Correção do FP de uma carga (apostila 8.11), com o FP desejado editável. */
function PowerFactorBox({ g, frequency }: { g: ThreePhaseGroupAnalysis; frequency: number }) {
  const [target, setTarget] = useState(0.92);
  const c = correctPowerFactor(g.activePower, g.reactivePower, g.lineVoltage, frequency, target);

  if (!c) {
    return null;
  }

  return (
    <div style={{ marginTop: "6px", padding: "6px 8px", background: "#f8fafc", borderRadius: "6px" }}>
      <strong>Correção do fator de potência</strong> (banco de capacitores) — FP desejado{" "}
      <input
        type="number"
        min={0.5}
        max={1}
        step={0.01}
        value={target}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (value > 0 && value <= 1) setTarget(value);
        }}
        style={{ width: "4.5em" }}
      />
      <br />
      {c.needed ? (
        <>
          Q<sub>C</sub> = P<sub>T</sub>·(tan θ − tan θ′) = {fmt(c.capacitorReactive, 1)} VAR; Q<sub>Cφ</sub> = Q<sub>C</sub>/3 ={" "}
          {fmt(c.perPhaseReactive, 1)} VAR.
          <br />
          Banco em Δ: C<sub>Δ</sub> = Q<sub>Cφ</sub>/(ω·E<sub>L</sub>²) = <strong>{fmt(c.deltaCapacitance * 1e6, 2)} µF</strong> por
          fase; em Y: C<sub>Y</sub> = 3·C<sub>Δ</sub> = <strong>{fmt(c.starCapacitance * 1e6, 2)} µF</strong>.
          <br />
          Corrente de linha: {fmt(c.lineCurrentBefore, 2)} A → {fmt(c.lineCurrentAfter, 2)} A (
          {fmt((1 - c.lineCurrentAfter / c.lineCurrentBefore) * 100, 1)} % menor).
        </>
      ) : (
        <>O FP já é {fmt(g.powerFactor, 3)} — não precisa de capacitores para chegar a {fmt(target, 2)}.</>
      )}
    </div>
  );
}

/* Cartão de cada bloco trifásico, na notação da apostila. */
export function ThreePhasePanel({ groups, frequency }: ThreePhasePanelProps) {
  if (groups.length === 0) {
    return null;
  }

  const anyUnbalanced = groups.some((g) => !g.balanced);

  return (
    <details open style={{ marginBottom: "16px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Trifásico {anyUnbalanced ? "(desequilibrado)" : "(equilibrado)"}
      </summary>

      {groups.map((g) => {
        const isLoad = g.kind === "load";

        return (
          <div key={g.groupId} style={card}>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>
              {g.name} — {isLoad ? "carga" : "gerador"} em {CONNECTION[g.connection]}
              {isLoad
                ? g.balanced
                  ? ", equilibrada"
                  : ", desequilibrada"
                : g.voltageUnbalance > 0.01
                  ? ", desequilibrado"
                  : `, sequência ${g.sequence}`}
            </div>

            <table className="measure-table">
              <thead>
                <tr>
                  <th>Tensão de fase</th>
                  <th>Corrente de fase</th>
                  <th>Tensão de linha</th>
                  <th>Corrente de linha</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => (
                  <tr key={role}>
                    <td>
                      <S s={phaseVoltageSymbol(g, role)} /> = {phasor(g.phaseVoltages[role], "V", 1)}
                    </td>
                    <td>
                      <S s={phaseCurrentSymbol(g, role)} /> = {phasor(g.phaseCurrents[role], "A", 3)}
                    </td>
                    <td>
                      <S s={lineVoltageSymbol(g, role)} /> = {phasor(g.lineVoltages[role], "V", 1)}
                    </td>
                    <td>
                      <S s={lineCurrentSymbol(role)} /> = {phasor(g.lineCurrents[role], "A", 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {g.balanced ? (
              <p style={{ margin: "6px 0" }}>
                {g.connection === "Y" ? (
                  <>
                    Em Y: I<sub>L</sub> = I<sub>φ</sub> e <strong>E<sub>L</sub> = √3·E<sub>φ</sub></strong> —{" "}
                    {g.voltageRatio ? `${fmt(g.voltageRatio.magnitude, 3)} ∠${fmt(g.voltageRatio.angle, 1)}°` : "—"} (√3 = 1,732;
                    a tensão de linha adianta 30° da de fase em ABC).
                  </>
                ) : (
                  <>
                    Em Δ: E<sub>L</sub> = E<sub>φ</sub> e <strong>I<sub>L</sub> = √3·I<sub>φ</sub></strong> —{" "}
                    {g.currentRatio ? `${fmt(g.currentRatio.magnitude, 3)} ∠${fmt(g.currentRatio.angle, 1)}°` : "—"} (√3 = 1,732;
                    a corrente de linha atrasa 30° da de fase em ABC).
                  </>
                )}
              </p>
            ) : (
              <table className="measure-table" style={{ marginTop: "6px" }}>
                <thead>
                  <tr>
                    <th>Fase</th>
                    {isLoad ? <th>Z</th> : null}
                    <th>P (W)</th>
                    <th>Q (VAR)</th>
                    <th>FP</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role) => {
                    const s = g.phasePowers[role];
                    const sMag = magnitude(s);
                    return (
                      <tr key={role}>
                        <td>{isLoad ? <S s={impedanceSymbol(role)} /> : <S s={phaseVoltageSymbol(g, role)} />}</td>
                        {isLoad && g.impedances ? <td>{formatImpedance(g.impedances[role], true)}</td> : null}
                        <td>{fmt(s.real, 1)}</td>
                        <td>{fmt(s.imaginary, 1)}</td>
                        <td>{sMag > 0 ? powerFactorText(s.real / sMag, s.imaginary) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <p style={{ margin: "6px 0 0" }}>
              {isLoad ? "Absorve" : "Entrega"}: P<sub>T</sub> = {fmt(g.activePower, 1)} W, Q<sub>T</sub> = {fmt(g.reactivePower, 1)} VAR,
              S<sub>T</sub> = {fmt(g.apparentPower, 1)} VA, F<sub>p</sub> = {powerFactorText(g.powerFactor, g.reactivePower)}.
              <br />
              {g.balanced
                ? `Conferência: PT = √3·EL·IL·cos θ = ${fmt(g.formulaPower, 1)} W.`
                : "Desequilibrado: PT é a soma das fases (√3·EL·IL·cos θ não se aplica)."}
              {g.neutralCurrentPhasor ? (
                <>
                  <br />
                  I<sub>N</sub> = I<sub>an</sub> + I<sub>bn</sub> + I<sub>cn</sub> = {phasor(g.neutralCurrentPhasor, "A", 3)}
                  {g.neutralCurrent !== null && g.neutralCurrent < 1e-3
                    ? g.balanced
                      ? " — carga equilibrada: o neutro não conduz."
                      : " — sem condutor neutro, a soma é zero."
                    : " — corrente no condutor neutro."}
                </>
              ) : null}
              {g.neutralShift && magnitude(g.neutralShift) > 1e-3 ? (
                <>
                  <br />
                  Deslocamento do neutro V<sub>nN</sub> = {phasor(g.neutralShift, "V", 2)} — sem o neutro, as tensões de fase da
                  carga deixam de ser iguais às do gerador.
                </>
              ) : null}
              {!g.balanced ? (
                <>
                  <br />
                  Componentes simétricas: I₀ = {fmt(magnitude(g.sequenceCurrents.zero), 3)} A, I₁ ={" "}
                  {fmt(magnitude(g.sequenceCurrents.positive), 3)} A, I₂ = {fmt(magnitude(g.sequenceCurrents.negative), 3)} A
                  (desequilíbrio {fmt(g.unbalanceFactor, 1)} %); V₁ = {fmt(magnitude(g.sequenceVoltages.positive), 2)} V, V₂ ={" "}
                  {fmt(magnitude(g.sequenceVoltages.negative), 2)} V ({fmt(g.voltageUnbalance, 2)} %).
                </>
              ) : null}
              {isLoad ? (
                <>
                  <br />
                  Dois wattímetros (linha C comum): W<sub>1</sub> = {fmt(g.wattmeters.w1, 1)} W, W<sub>2</sub> ={" "}
                  {fmt(g.wattmeters.w2, 1)} W, W<sub>1</sub> + W<sub>2</sub> = {fmt(g.wattmeters.sum, 1)} W
                  {g.wattmeters.valid ? " = PT." : " (≠ PT: há corrente no neutro; o método vale para 3 fios)."}
                </>
              ) : null}
              {g.impedances && g.equivalentImpedances ? (
                <>
                  <br />
                  Equivalente em {g.connection === "Y" ? "Δ" : "Y"}
                  {g.balanced ? (g.connection === "Y" ? " (Z_Δ = 3·Z_Y)" : " (Z_Y = Z_Δ/3)") : " (Kennelly)"}:{" "}
                  {g.balanced
                    ? formatImpedance(g.equivalentImpedances.A, true)
                    : ROLES.map((role) => formatImpedance(g.equivalentImpedances![role], true)).join("; ")}
                  .
                </>
              ) : null}
            </p>

            {isLoad && g.activePower > 0 ? <PowerFactorBox g={g} frequency={frequency} /> : null}
          </div>
        );
      })}
    </details>
  );
}
