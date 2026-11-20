import type { CircuitResult } from "../../core/CircuitResult";
import { Phasor } from "../../phasors/Phasor";

interface ResultsPanelProps {
  result: CircuitResult;
  /* Nome exibido de cada componente (id → rótulo). */
  labels?: ReadonlyMap<string, string>;
}

export function ResultsPanel({
  result,
  labels,
}: ResultsPanelProps) {

  const currentPhasor =
    Phasor.fromComplex(
      result.current
    );

  const zeqPhasor =
    Phasor.fromComplex(
      result.zeq
    );

  const hasSeveralSources =
    (result.sourceCount ?? 1) > 1;

  return (
    <div>
      <h2>Resultados</h2>

      {hasSeveralSources ? (
        <>
          <p
            style={{
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Várias fontes ({result.sourceCount}): não existe uma
            Zeq nem uma corrente total únicas. Veja os fasores e a
            potência entregue por cada fonte.
          </p>

          {(result.sourcePowers ?? []).map(
            (source) => (
              <p
                key={source.elementId}
                style={{ margin: "2px 0" }}
              >
                {labels?.get(source.elementId) ?? source.elementId} entrega:{" "}
                {source.activePower.toFixed(2)} W /{" "}
                {source.reactivePower.toFixed(2)} var
              </p>
            )
          )}
        </>
      ) : (
        <>

      <p>
        Zeq: {result.zeq.toFormattedString()} Ω
      </p>

      <p>
        Zeq Fasorial: {zeqPhasor.toString()} Ω
      </p>

      <p>
        Corrente: {result.current.toFormattedString()} A
      </p>

      <p>
        Corrente Fasorial: {currentPhasor.toString()} A
      </p>
        </>
      )}

      <p>
        P: {result.activePower.toFixed(2)} W
      </p>

      <p>
        Q: {result.reactivePower.toFixed(2)} var
      </p>

      <p>
        S: {result.apparentPower.toFixed(2)} VA
      </p>

      <p>
        FP: {result.powerFactor.toFixed(3)}
      </p>
    </div>
  );
}