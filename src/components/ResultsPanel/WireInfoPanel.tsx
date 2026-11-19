import type { CircuitConnection } from "../../core/CircuitConnection";
import type { CircuitGraph } from "../../core/CircuitGraph";
import type { AnimationModel } from "../Canvas/circuitAnimation";

interface WireInfoPanelProps {
  connection: CircuitConnection;
  graph: CircuitGraph;
  model: AnimationModel | null;
}

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

function format(peak: number, angle: number, unit: string) {
  const rms = peak / Math.SQRT2;

  if (rms < 1e-9) {
    return `0 ${unit}`;
  }

  return `${rms.toFixed(3)} ${unit} ∠ ${toDegrees(angle).toFixed(2)}°`;
}

/* Informações elétricas do fio selecionado. */
export function WireInfoPanel({ connection, graph, model }: WireInfoPanelProps) {
  const nodeId = graph.terminalToNodeId[connection.fromTerminalId];
  const node = graph.nodes.find((item) => item.id === nodeId);
  const terminals = node?.terminalIds ?? [];

  const current = model?.connectionCurrent[connection.id];
  const voltage = model?.terminalVoltage[connection.fromTerminalId];
  const isReference = nodeId !== undefined && nodeId === graph.referenceNodeId;

  const rows: [string, string][] = [];

  rows.push([
    "Nó elétrico",
    `${nodeId ?? "—"}${isReference ? " (referência, GND)" : ""}`,
  ]);

  if (!model) {
    rows.push(["Cálculo", "indisponível (circuito aberto ou em curto)"]);
  } else {
    rows.push([
      "Tensão do nó",
      voltage
        ? isReference
          ? "0 V (referência)"
          : format(voltage.peak, voltage.angle, "V")
        : "—",
    ]);

    rows.push([
      "Corrente no fio",
      current ? format(current.peak, current.angle, "A") : "—",
    ]);

    if (current) {
      rows.push([
        "Corrente de pico",
        `${current.peak.toFixed(3)} A`,
      ]);

      rows.push([
        "Sentido de referência",
        `${connection.fromTerminalId} → ${connection.toTerminalId}`,
      ]);
    }
  }

  rows.push([
    "Terminais no nó",
    `${terminals.length}${terminals.length > 2 ? " (junção)" : ""}: ${terminals.join(", ")}`,
  ]);

  const zero =
    model && current && current.peak / Math.SQRT2 < 1e-9;

  return (
    <div className="wire-info">
      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {zero ? (
        <p className="wire-note">
          Sem corrente neste fio: o ramo está aberto ou o fio só liga
          pontos de mesmo potencial dentro da rede.
        </p>
      ) : null}
    </div>
  );
}
