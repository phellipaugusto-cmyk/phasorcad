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

const phasor = (p: { real: number; imaginary: number }, unit: string, digits = 2) =>
  `${fmt(magnitude(p), digits)} ${unit} ∠${fmt(angleDegrees(p), 1)}°`;

const CONNECTION = { Y: "Y (estrela)", D: "Δ (triângulo)" };
const PHASE_NAMES = {
  Y: { v: ["V_AN", "V_BN", "V_CN"], i: ["I_A", "I_B", "I_C"] },
  D: { v: ["V_AB", "V_BC", "V_CA"], i: ["I_AB", "I_BC", "I_CA"] },
};
const LINE_V = ["V_AB", "V_BC", "V_CA"];
const LINE_I = ["I_A", "I_B", "I_C"];

/* Cartão de cada bloco trifásico: fase × linha, potências, neutro. */
export function ThreePhasePanel({ groups }: ThreePhasePanelProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <details open style={{ marginBottom: "16px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Trifásico (equilibrado)
      </summary>

      {groups.map((g) => {
        const roles = ["A", "B", "C"] as const;
        const names = PHASE_NAMES[g.connection];
        const isLoad = g.kind === "load";

        return (
          <div
            key={g.groupId}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "8px 10px",
              marginTop: "8px",
              fontSize: "13px",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>
              {g.name} — {isLoad ? "carga" : "gerador"} em {CONNECTION[g.connection]}
              {isLoad ? "" : `, sequência ${g.sequence}`}
            </div>

            <table className="measure-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Fase</th>
                  <th>Linha</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Tensão (V)</td>
                  <td>{fmt(g.phaseVoltage)}</td>
                  <td>{fmt(g.lineVoltage)}</td>
                </tr>
                <tr>
                  <td>Corrente (A)</td>
                  <td>{fmt(g.phaseCurrent, 3)}</td>
                  <td>{fmt(g.lineCurrent, 3)}</td>
                </tr>
              </tbody>
            </table>

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
                {roles.map((role, i) => (
                  <tr key={role}>
                    <td>{role}</td>
                    <td title={names.v[i]}>{phasor(g.phaseVoltages[role], "V", 1)}</td>
                    <td title={names.i[i]}>{phasor(g.phaseCurrents[role], "A", 3)}</td>
                    <td title={LINE_V[i]}>{phasor(g.lineVoltages[role], "V", 1)}</td>
                    <td title={LINE_I[i]}>{phasor(g.lineCurrents[role], "A", 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ margin: "6px 0 0" }}>
              {isLoad ? "Absorve" : "Entrega"}: P = {fmt(g.activePower, 1)} W, Q ={" "}
              {fmt(g.reactivePower, 1)} var, S = {fmt(g.apparentPower, 1)} VA, FP ={" "}
              {fmt(g.powerFactor, 3)}.
              <br />
              Conferência: √3·V_L·I_L·FP = {fmt(g.formulaPower, 1)} W.
              {g.neutralCurrent !== null ? (
                <>
                  <br />
                  Soma das correntes de fase (neutro): {fmt(g.neutralCurrent, 4)} A
                  {g.neutralCurrent < 1e-3 ? " — equilibrado, o neutro não conduz." : "."}
                </>
              ) : null}
              {g.impedance && g.equivalentImpedance ? (
                <>
                  <br />
                  Z por fase = {formatImpedance(g.impedance, true)}; equivalente em{" "}
                  {g.connection === "Y" ? "Δ: Z_Δ = 3·Z_Y" : "Y: Z_Y = Z_Δ/3"} ={" "}
                  {formatImpedance(g.equivalentImpedance, true)}.
                </>
              ) : null}
            </p>
          </div>
        );
      })}
    </details>
  );
}
