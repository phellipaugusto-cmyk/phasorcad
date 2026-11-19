import type { CircuitResult } from "../../core/CircuitResult";
import { Phasor } from "../../phasors/Phasor";

interface ResultsStripProps {
  result: CircuitResult;
  open: boolean;
  onToggle: () => void;
}

/* Faixa de resultados do celular: o essencial numa linha. */
export function ResultsStrip({ result, open, onToggle }: ResultsStripProps) {
  const several = (result.sourceCount ?? 1) > 1;
  const current = Phasor.fromComplex(result.current);

  return (
    <button
      type="button"
      className="results-strip"
      onClick={onToggle}
      aria-expanded={open}
      aria-label="Resultados. Toque para ver o diagrama e as formas de onda."
    >
      <span className="rs-items">
        {several ? null : (
          <span>
            <b>I</b> {current.magnitude.toFixed(2)}∠{current.angle.toFixed(1)}° A
          </span>
        )}
        <span>
          <b>P</b> {result.activePower.toFixed(1)} W
        </span>
        <span>
          <b>Q</b> {result.reactivePower.toFixed(1)} var
        </span>
        <span>
          <b>FP</b> {result.powerFactor.toFixed(2)}
        </span>
      </span>
      <span className="rs-chevron" aria-hidden="true">
        {open ? "▼" : "▲"}
      </span>
    </button>
  );
}
