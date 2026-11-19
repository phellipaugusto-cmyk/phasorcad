import type { CircuitElement } from "../../core/CircuitElement";
import type { MnaElectricalResults } from "../../core/MnaElectricalResults";
import { compareMeasurements } from "../../solver/measurementComparison";

interface MeasurementComparisonPanelProps {
  elements: CircuitElement[];
  results: MnaElectricalResults;
}

const fmt = (value: number, digits: number) =>
  Number(value.toFixed(digits)).toString().replace(".", ",");

const QUANTITY_NAMES = {
  voltage: "V",
  current: "I",
  power: "P",
} as const;

/* Só aparece quando algum componente tem leitura de bancada. */
export function MeasurementComparisonPanel({
  elements,
  results,
}: MeasurementComparisonPanelProps) {
  const rows = compareMeasurements(elements, results);

  if (rows.length === 0) {
    return null;
  }

  return (
    <details open style={{ marginBottom: "16px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Medido × Simulado
      </summary>

      <table className="measure-table">
        <thead>
          <tr>
            <th>Componente</th>
            <th>Grandeza</th>
            <th>Medido</th>
            <th>Simulado</th>
            <th>Erro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const digits = row.quantity === "current" ? 3 : 1;
            const error = row.errorPercent;
            const color =
              error === null
                ? "#6b7280"
                : Math.abs(error) <= 5
                  ? "#15803d"
                  : Math.abs(error) <= 15
                    ? "#b45309"
                    : "#b91c1c";

            return (
              <tr key={`${row.elementId}-${row.quantity}`}>
                <td>{row.label}</td>
                <td>
                  {QUANTITY_NAMES[row.quantity]} ({row.unit})
                </td>
                <td>{fmt(row.measured, digits)}</td>
                <td>
                  {row.simulated === null ? "—" : fmt(row.simulated, digits)}
                </td>
                <td style={{ color }}>
                  {error === null ? "—" : `${fmt(error, 1)} %`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6b7280" }}>
        Potência em módulo (fontes entregam, cargas absorvem). Erro =
        (simulado − medido) / medido.
      </p>
    </details>
  );
}
