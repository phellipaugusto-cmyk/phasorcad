import type {
  CircuitResult,
} from "../../core/CircuitResult";

interface SolverComparisonPanelProps {
  legacyResult: CircuitResult;

  mnaResult: CircuitResult;

  mnaAvailable: boolean;

  mnaErrorMessage: string | null;
}

function formatDifference(
  first: number,
  second: number,
  unit: string
): string {
  const difference =
    second - first;

  const sign =
    difference >= 0
      ? "+"
      : "";

  return `${sign}${difference.toFixed(6)} ${unit}`;
}

export function SolverComparisonPanel({
  legacyResult,
  mnaResult,
  mnaAvailable,
  mnaErrorMessage,
}: SolverComparisonPanelProps) {
  return (
    <details
      style={{
        marginTop: "12px",
        marginBottom: "12px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Comparação temporária: série × MNA
      </summary>

      <div
        style={{
          marginTop: "8px",
          fontSize: "12px",
        }}
      >
        {!mnaAvailable ? (
          <p
            style={{
              margin: 0,
              color: "#b45309",
            }}
          >
            O resultado MNA não está disponível: {mnaErrorMessage ?? "motivo não informado"}.
          </p>
        ) : (
          <>
            <div>
              <strong>P:</strong>{" "}
              série {legacyResult.activePower.toFixed(6)} W; MNA {mnaResult.activePower.toFixed(6)} W; diferença {formatDifference(
                legacyResult.activePower,
                mnaResult.activePower,
                "W"
              )}
            </div>

            <div>
              <strong>Q:</strong>{" "}
              série {legacyResult.reactivePower.toFixed(6)} var; MNA {mnaResult.reactivePower.toFixed(6)} var; diferença {formatDifference(
                legacyResult.reactivePower,
                mnaResult.reactivePower,
                "var"
              )}
            </div>

            <div>
              <strong>S:</strong>{" "}
              série {legacyResult.apparentPower.toFixed(6)} VA; MNA {mnaResult.apparentPower.toFixed(6)} VA; diferença {formatDifference(
                legacyResult.apparentPower,
                mnaResult.apparentPower,
                "VA"
              )}
            </div>

            <div>
              <strong>FP:</strong>{" "}
              série {legacyResult.powerFactor.toFixed(6)}; MNA {mnaResult.powerFactor.toFixed(6)}; diferença {formatDifference(
                legacyResult.powerFactor,
                mnaResult.powerFactor,
                ""
              )}
            </div>

            <p
              style={{
                margin: "8px 0 0",
                color: "#666",
              }}
            >
              Diferenças grandes são esperadas em circuitos paralelos e mistos, pois o método antigo soma impedâncias como série.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
