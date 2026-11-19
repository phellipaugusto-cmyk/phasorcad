import type { CircuitElement } from "../core/CircuitElement";
import type { MnaElectricalResults } from "../core/MnaElectricalResults";

/*
 * Medido × simulado: para cada componente com leituras de bancada,
 * compara |V|, |I| e a potência ativa simulada (em módulo, para que
 * fontes e cargas fiquem com o mesmo sinal da leitura do medidor).
 */

export type MeasuredQuantity = "voltage" | "current" | "power";

export interface MeasurementComparisonRow {
  elementId: string;
  label: string;
  quantity: MeasuredQuantity;
  unit: string;
  measured: number;
  simulated: number | null;
  /* (simulado − medido) / medido, em %; null se não der para calcular. */
  errorPercent: number | null;
}

const UNITS: Record<MeasuredQuantity, string> = {
  voltage: "V",
  current: "A",
  power: "W",
};

const ORDER: MeasuredQuantity[] = ["voltage", "current", "power"];

export function compareMeasurements(
  elements: CircuitElement[],
  results: MnaElectricalResults
): MeasurementComparisonRow[] {
  const rows: MeasurementComparisonRow[] = [];

  elements.forEach((element) => {
    const measured = element.measured;

    if (!measured) {
      return;
    }

    const result = results.available
      ? results.elementResults.find((r) => r.elementId === element.id)
      : undefined;

    ORDER.forEach((quantity) => {
      const value = measured[quantity];

      if (value === undefined || !Number.isFinite(value)) {
        return;
      }

      let simulated: number | null = null;

      if (result) {
        if (quantity === "voltage") {
          simulated = Math.hypot(result.voltage.real, result.voltage.imaginary);
        } else if (quantity === "current") {
          simulated = Math.hypot(result.current.real, result.current.imaginary);
        } else {
          simulated = Math.abs(result.complexPower.real);
        }
      }

      rows.push({
        elementId: element.id,
        label: element.label,
        quantity,
        unit: UNITS[quantity],
        measured: value,
        simulated,
        errorPercent:
          simulated !== null && value !== 0
            ? ((simulated - value) / Math.abs(value)) * 100
            : null,
      });
    });
  });

  return rows;
}
