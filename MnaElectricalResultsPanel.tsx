import type {
  MnaElectricalResults,
} from "../../core/MnaElectricalResults";

import {
  formatComplexValue,
} from "../Canvas/formatComplexValue";

interface MnaElectricalResultsPanelProps {
  results: MnaElectricalResults;
}

export function MnaElectricalResultsPanel({
  results,
}: MnaElectricalResultsPanelProps) {
  return (
    <details
      open
      style={{
        marginBottom: "16px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Resultados Elétricos MNA
      </summary>

      <div
        style={{
          marginTop: "10px",
          fontSize: "13px",
        }}
      >
        {!results.available ? (
          <p
            style={{
              margin: 0,
              color: "#b91c1c",
            }}
          >
            {results.errorMessage ??
              "Resultados elétricos indisponíveis."}
          </p>
        ) : (
          <>
            <div>
              <strong>
                Tensões nodais
              </strong>
            </div>

            <ul
              style={{
                margin: "6px 0 0",
                paddingLeft: "18px",
              }}
            >
              {results.nodeVoltages.map(
                (nodeResult) => (
                  <li
                    key={nodeResult.nodeId}
                    style={{
                      marginBottom: "6px",
                    }}
                  >
                    <strong>
                      {nodeResult.nodeId}
                      {nodeResult.isReference
                        ? " (GND)"
                        : ""}:
                    </strong>{" "}
                    {formatComplexValue(
                      nodeResult.voltage
                    )}{" V"}
                  </li>
                )
              )}
            </ul>

            <div
              style={{
                marginTop: "12px",
              }}
            >
              <strong>
                Resultados por componente
              </strong>
            </div>

            {results.elementResults.map(
              (elementResult) => (
                <div
                  key={elementResult.elementId}
                  style={{
                    marginTop: "8px",
                    padding: "8px",
                    border: elementResult.isBypassed
                      ? "1px solid #f59e0b"
                      : elementResult.isSource
                        ? "1px solid #2563eb"
                        : "1px solid #d1d5db",
                    borderRadius: "6px",
                    backgroundColor: elementResult.isBypassed
                      ? "#fffbeb"
                      : elementResult.isSource
                        ? "#eff6ff"
                        : "#ffffff",
                  }}
                >
                  <div>
                    <strong>
                      {elementResult.elementId}
                    </strong>{" "}
                    ({elementResult.elementType})
                    {elementResult.isBypassed
                      ? " — DESVIADO"
                      : ""}
                  </div>

                  <div style={{ marginTop: "4px" }}>
                    Nós: {elementResult.fromNodeId}
                    {" → "}
                    {elementResult.toNodeId}
                  </div>

                  <div>
                    Tensão: {formatComplexValue(
                      elementResult.voltage
                    )}{" V"}
                  </div>

                  <div>
                    Corrente: {formatComplexValue(
                      elementResult.current
                    )}{" A"}
                  </div>

                  <div>
                    P: {elementResult.complexPower.real.toFixed(6)} W
                  </div>

                  <div>
                    Q: {elementResult.complexPower.imaginary.toFixed(6)} var
                  </div>

                  <div>
                    S: {elementResult.apparentPower.toFixed(6)} VA
                  </div>

                  <div>
                    FP: {elementResult.powerFactor.toFixed(6)}
                  </div>

                  {elementResult.isSource ? (
                    <div
                      style={{
                        marginTop: "4px",
                        color: "#666",
                      }}
                    >
                      Corrente positiva no sentido matemático from → to.
                    </div>
                  ) : null}
                </div>
              )
            )}
          </>
        )}
      </div>
    </details>
  );
}
