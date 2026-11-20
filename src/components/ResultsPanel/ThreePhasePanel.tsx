import type { ThreePhaseGroupAnalysis } from "../../solver/threePhaseAnalysis";
import { angleDegrees, magnitude } from "../../solver/threePhaseAnalysis";
import { formatImpedance } from "../../core/impedanceModel";

interface ThreePhasePanelProps {
  groups: ThreePhaseGroupAnalysis[];
}

const fmt = (value: number, digits = 2) =>
  Number(value.toFixed(digits))
    .toString()
    .replace(".", ",")
    .replace(/^-/, "−");

type P = { real: number; imaginary: number };

const phasor = (p: P, unit: string, digits = 2) =>
  `${fmt(magnitude(p), digits)} ${unit} ∠${fmt(angleDegrees(p), 1)}°`;

const CONNECTION = { Y: "Y (estrela)", D: "Δ (triângulo)" };
const PHASE_LABEL = {
  Y: { A: "A", B: "B", C: "C" },
  D: { A: "AB", B: "BC", C: "CA" },
};
const LINE_V = { A: "AB", B: "BC", C: "CA" };
const ROLES = ["A", "B", "C"] as const;

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "8px 10px",
  marginTop: "8px",
  fontSize: "13px",
};

/* Cartão de cada bloco trifásico: fase × linha, potências, neutro. */
export function ThreePhasePanel({ groups }: ThreePhasePanelProps) {
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
        const labels = PHASE_LABEL[g.connection];

        return (
          <div key={g.groupId} style={card}>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>
              {g.name} — {isLoad ? "carga" : "gerador"} em {CONNECTION[g.connection]}
              {isLoad
                ? g.balanced
                  ? ", equilibrada"
                  : ", desequilibrada"
                : `, sequência ${g.sequence}${g.balanced ? "" : " (alimentando carga desequilibrada)"}`}
            </div>

            <table className="measure-table">
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>V fase</th>
                  <th>I fase</th>
                  <th>V linha</th>
                  <th>I linha</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => (
                  <tr key={role}>
                    <td>{labels[role]}</td>
                    <td>{phasor(g.phaseVoltages[role], "V", 1)}</td>
                    <td>{phasor(g.phaseCurrents[role], "A", 3)}</td>
                    <td title={`V_${LINE_V[role]}`}>{phasor(g.lineVoltages[role], "V", 1)}</td>
                    <td title={`I_${role}`}>{phasor(g.lineCurrents[role], "A", 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {g.balanced ? (
              <p style={{ margin: "6px 0" }}>
                {g.connection === "Y" ? (
                  <>
                    Em Y: I_L = I_F e{" "}
                    <strong>
                      V_AB / V_AN = {g.voltageRatio ? fmt(g.voltageRatio.magnitude, 3) : "—"} ∠
                      {g.voltageRatio ? fmt(g.voltageRatio.angle, 1) : "—"}°
                    </strong>{" "}
                    (√3 = 1,732; +30° em ABC, −30° em ACB).
                  </>
                ) : (
                  <>
                    Em Δ: V_L = V_F e{" "}
                    <strong>
                      I_A / I_AB = {g.currentRatio ? fmt(g.currentRatio.magnitude, 3) : "—"} ∠
                      {g.currentRatio ? fmt(g.currentRatio.angle, 1) : "—"}°
                    </strong>{" "}
                    (√3 = 1,732; −30° em ABC, +30° em ACB).
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
                    <th>Q (var)</th>
                    <th>FP</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role) => {
                    const s = g.phasePowers[role];
                    const sMag = magnitude(s);
                    return (
                      <tr key={role}>
                        <td>{labels[role]}</td>
                        {isLoad && g.impedances ? (
                          <td>{formatImpedance(g.impedances[role], true)}</td>
                        ) : null}
                        <td>{fmt(s.real, 1)}</td>
                        <td>{fmt(s.imaginary, 1)}</td>
                        <td>{sMag > 0 ? fmt(s.real / sMag, 3) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <p style={{ margin: "6px 0 0" }}>
              {isLoad ? "Absorve" : "Entrega"} no total: P = {fmt(g.activePower, 1)} W, Q ={" "}
              {fmt(g.reactivePower, 1)} var, S = {fmt(g.apparentPower, 1)} VA, FP ={" "}
              {fmt(g.powerFactor, 3)}.
              <br />
              {g.balanced
                ? `Conferência: √3·V_L·I_L·FP = ${fmt(g.formulaPower, 1)} W.`
                : "Desequilibrado: a potência total é a soma das fases (√3·V_L·I_L·FP não vale)."}

              {g.neutralCurrentPhasor ? (
                <>
                  <br />
                  I_A + I_B + I_C ={" "}
                  {magnitude(g.neutralCurrentPhasor) < 1e-6 ? "0 A" : phasor(g.neutralCurrentPhasor, "A", 4)}
                  {g.neutralCurrent !== null && g.neutralCurrent < 1e-3
                    ? g.balanced
                      ? " — equilibrado, o neutro não conduz."
                      : " — sem fio de neutro, a soma é zero."
                    : " — corrente no fio de neutro."}
                </>
              ) : null}

              {g.neutralShift ? (
                <>
                  <br />
                  Deslocamento do neutro V_nN = {phasor(g.neutralShift, "V", 2)}
                  {magnitude(g.neutralShift) > 1e-3
                    ? " — as fases da carga não ficam com V_L/√3."
                    : "."}
                </>
              ) : null}

              {!g.balanced ? (
                <>
                  <br />
                  Componentes simétricas de I_L: I₀ = {fmt(magnitude(g.sequenceCurrents.zero), 3)} A,
                  I₁ = {fmt(magnitude(g.sequenceCurrents.positive), 3)} A, I₂ ={" "}
                  {fmt(magnitude(g.sequenceCurrents.negative), 3)} A; desequilíbrio I₂/I₁ ={" "}
                  {fmt(g.unbalanceFactor, 1)} %.
                </>
              ) : null}

              {g.impedances && g.equivalentImpedances ? (
                <>
                  <br />
                  Equivalente em {g.connection === "Y" ? "Δ" : "Y"}
                  {g.balanced ? (g.connection === "Y" ? " (3·Z_Y)" : " (Z_Δ/3)") : " (Kennelly)"}:{" "}
                  {g.balanced
                    ? formatImpedance(g.equivalentImpedances.A, true)
                    : ROLES.map(
                        (role) =>
                          `${g.connection === "Y" ? `Z${LINE_V[role]}` : `Z${role}`} = ${formatImpedance(g.equivalentImpedances![role], true)}`
                      ).join("; ")}
                  {g.balanced ? ` (Z por fase = ${formatImpedance(g.impedances.A, true)})` : ""}.
                </>
              ) : null}
            </p>
          </div>
        );
      })}
    </details>
  );
}
