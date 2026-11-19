import type { ModifiedNodalAnalysisStructure } from "../../core/ModifiedNodalAnalysis";
import { formatComplexValue } from "../Canvas/formatComplexValue";

interface MnaMatrixPanelProps {
  modifiedNodalAnalysis: ModifiedNodalAnalysisStructure;
}

export function MnaMatrixPanel({
  modifiedNodalAnalysis,
}: MnaMatrixPanelProps) {
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
        Matriz MNA Completa
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
            Variáveis:
          </strong>{" "}
          {
            modifiedNodalAnalysis.variables.length >
            0
              ? modifiedNodalAnalysis.variables
                  .map(
                    (variable) =>
                      variable.id
                  )
                  .join(
                    ", "
                  )
              : "nenhuma"
          }
        </div>

        <div
          style={{
            marginTop:
              "4px",
          }}
        >
          <strong>
            Dimensão de A:
          </strong>{" "}
          {
            modifiedNodalAnalysis.variables.length
          }
          {" × "}
          {
            modifiedNodalAnalysis.variables.length
          }
        </div>

        <div
          style={{
            marginTop:
              "12px",
          }}
        >
          <strong>
            Sistema A · x = z
          </strong>
        </div>

        {
          modifiedNodalAnalysis.matrix.length ===
          0 ? (
            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#666",
              }}
            >
              Não existem variáveis para montar o sistema MNA.
            </p>
          ) : (
            <div
              style={{
                marginTop:
                  "6px",

                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  borderCollapse:
                    "collapse",

                  fontSize:
                    "12px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        border:
                          "1px solid #d1d5db",

                        padding:
                          "4px 6px",

                        backgroundColor:
                          "#f3f4f6",
                      }}
                    >
                      A
                    </th>

                    {
                      modifiedNodalAnalysis.variables.map(
                        (variable) => (
                          <th
                            key={
                              variable.id
                            }
                            style={{
                              border:
                                "1px solid #d1d5db",

                              padding:
                                "4px 6px",

                              backgroundColor:
                                "#f3f4f6",
                            }}
                          >
                            {variable.id}
                          </th>
                        )
                      )
                    }

                    <th
                      style={{
                        border:
                          "1px solid #d1d5db",

                        padding:
                          "4px 6px",

                        backgroundColor:
                          "#ecfdf5",
                      }}
                    >
                      z
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {
                    modifiedNodalAnalysis.matrix.map(
                      (row, rowIndex) => (
                        <tr
                          key={
                            row.id
                          }
                        >
                          <th
                            style={{
                              border:
                                "1px solid #d1d5db",

                              padding:
                                "4px 6px",

                              backgroundColor:
                                "#f9fafb",
                            }}
                          >
                            {row.id}
                          </th>

                          {
                            row.values.map(
                              (value, columnIndex) => (
                                <td
                                  key={
                                    `${row.id}-${columnIndex}`
                                  }
                                  style={{
                                    border:
                                      "1px solid #d1d5db",

                                    padding:
                                      "4px 6px",

                                    whiteSpace:
                                      "nowrap",
                                  }}
                                >
                                  {
                                    formatComplexValue(
                                      value
                                    )
                                  }
                                </td>
                              )
                            )
                          }

                          <td
                            style={{
                              border:
                                "1px solid #d1d5db",

                              padding:
                                "4px 6px",

                              backgroundColor:
                                "#f0fdf4",

                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              formatComplexValue(
                                modifiedNodalAnalysis
                                  .rightHandSide[
                                    rowIndex
                                  ]
                              )
                            }
                          </td>
                        </tr>
                      )
                    )
                  }
                </tbody>
              </table>
            </div>
          )
        }

        <div
          style={{
            marginTop:
              "12px",
          }}
        >
          <strong>
            Fontes estampadas
          </strong>
        </div>

        {
          modifiedNodalAnalysis.sourceStamps.length ===
          0 ? (
            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#666",
              }}
            >
              Nenhuma fonte ideal foi estampada.
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
                modifiedNodalAnalysis.sourceStamps.map(
                  (stamp) => (
                    <li
                      key={
                        stamp.sourceElementId
                      }
                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      <strong>
                        {stamp.sourceElementId}
                      </strong>{" "}
                      ({stamp.fromNodeId} → {stamp.toNodeId}):{" "}
                      {
                        stamp.kind === "current"
                          ? `${formatComplexValue(
                              stamp.current
                            )} A (fonte de corrente, sem variável extra)`
                          : `${formatComplexValue(
                              stamp.voltage
                            )} V; variável ${
                              stamp.currentVariableId
                            }`
                      }
                    </li>
                  )
                )
              }
            </ul>
          )
        }

        <p
          style={{
            margin:
              "10px 0 0",

            color:
              "#666",
          }}
        >
          Convenção: V(to) - V(from) = Vs. A corrente da fonte é positiva de from para to.
        </p>
      </div>
    </details>
  );
}
