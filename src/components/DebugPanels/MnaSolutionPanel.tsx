import type { ModifiedNodalAnalysisStructure } from "../../core/ModifiedNodalAnalysis";
import type { ComplexLinearSystemSolution } from "../../core/ComplexLinearSystem";
import { formatComplexValue } from "../Canvas/formatComplexValue";

interface MnaSolutionPanelProps {
  modifiedNodalAnalysis: ModifiedNodalAnalysisStructure;

  mnaSolution: ComplexLinearSystemSolution;
}

export function MnaSolutionPanel({
  modifiedNodalAnalysis,
  mnaSolution,
}: MnaSolutionPanelProps) {
  return (
    <details
      open
      style={{
        marginBottom:
          "16px",
      }}
    >
      <summary
        style={{
          cursor:
            "pointer",

          fontWeight:
            700,
        }}
      >
        Solução MNA Complexa
      </summary>

      <div
        style={{
          marginTop:
            "10px",

          fontSize:
            "13px",
        }}
      >
        <div>
          <strong>
            Estado do resolvedor:
          </strong>{" "}
          <span
            style={{
              color:
                mnaSolution.success
                  ? "#15803d"
                  : "#b91c1c",

              fontWeight:
                700,
            }}
          >
            {
              mnaSolution.success
                ? "RESOLVIDO"
                : "FALHA"
            }
          </span>
        </div>

        {
          mnaSolution.errorMessage ? (
            <p
              style={{
                margin:
                  "8px 0 0",

                color:
                  "#b91c1c",
              }}
            >
              {
                mnaSolution.errorMessage
              }
            </p>
          ) : null
        }

        {
          mnaSolution.success ? (
            <>
              <div
                style={{
                  marginTop:
                    "12px",
                }}
              >
                <strong>
                  Variáveis resolvidas
                </strong>
              </div>

              {
                modifiedNodalAnalysis.variables.length ===
                0 ? (
                  <p
                    style={{
                      margin:
                        "6px 0 0",

                      color:
                        "#666",
                    }}
                  >
                    Nenhuma variável foi criada.
                  </p>
                ) : (
                  <ul
                    style={{
                      margin:
                        "6px 0 0",

                      paddingLeft:
                        "18px",
                    }}
                  >
                    {
                      modifiedNodalAnalysis.variables.map(
                        (variable, index) => (
                          <li
                            key={
                              variable.id
                            }
                            style={{
                              marginBottom:
                                "6px",
                            }}
                          >
                            <strong>
                              {variable.id}:
                            </strong>{" "}
                            {
                              formatComplexValue(
                                mnaSolution.values[
                                  index
                                ]
                              )
                            }
                            {
                              variable.kind ===
                              "node-voltage"
                                ? " V"
                                : " A"
                            }
                          </li>
                        )
                      )
                    }
                  </ul>
                )
              }

              <div
                style={{
                  marginTop:
                    "12px",
                }}
              >
                <strong>
                  Resíduo máximo |A·x - z|:
                </strong>{" "}
                {
                  mnaSolution.maximumResidualMagnitude.toExponential(
                    3
                  )
                }
              </div>

              <div
                style={{
                  marginTop:
                    "12px",
                }}
              >
                <strong>
                  Resíduos por equação
                </strong>
              </div>

              <ul
                style={{
                  margin:
                    "6px 0 0",

                  paddingLeft:
                    "18px",
                }}
              >
                {
                  modifiedNodalAnalysis.variables.map(
                    (variable, index) => (
                      <li
                        key={
                          `residual-${variable.id}`
                        }
                        style={{
                          marginBottom:
                            "6px",
                        }}
                      >
                        <strong>
                          {variable.id}:
                        </strong>{" "}
                        {
                          formatComplexValue(
                            mnaSolution.residuals[
                              index
                            ]
                          )
                        }
                      </li>
                    )
                  )
                }
              </ul>
            </>
          ) : null
        }
      </div>
    </details>
  );
}
