import type { NodalAnalysisStructure } from "../../core/NodalAnalysis";
import { formatComplexValue } from "../Canvas/formatComplexValue";

interface AdmittanceMatrixPanelProps {
  nodalAnalysis: NodalAnalysisStructure;
}

export function AdmittanceMatrixPanel({
  nodalAnalysis,
}: AdmittanceMatrixPanelProps) {
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
        Matriz de Admitâncias Y
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
            Nó de referência:
          </strong>{" "}
          {
            nodalAnalysis.referenceNodeId ??
            "não definido"
          }
        </div>

        <div
          style={{
            marginTop:
              "4px",
          }}
        >
          <strong>
            Nós desconhecidos:
          </strong>{" "}
          {
            nodalAnalysis.unknownNodeIds.length >
            0
              ? nodalAnalysis.unknownNodeIds.join(
                  ", "
                )
              : "nenhum"
          }
        </div>

        <div
          style={{
            marginTop:
              "4px",
          }}
        >
          <strong>
            Dimensão de Y:
          </strong>{" "}
          {
            nodalAnalysis.unknownNodeIds.length
          }
          {" × "}
          {
            nodalAnalysis.unknownNodeIds.length
          }
        </div>

        <div
          style={{
            marginTop:
              "12px",
          }}
        >
          <strong>
            Matriz Y (siemens)
          </strong>
        </div>

        {
          nodalAnalysis.admittanceMatrix.length ===
          0 ? (
            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#666",
              }}
            >
              Não existem nós desconhecidos para montar a matriz.
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
                      Y
                    </th>

                    {
                      nodalAnalysis.unknownNodeIds.map(
                        (nodeId) => (
                          <th
                            key={
                              nodeId
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
                            {nodeId}
                          </th>
                        )
                      )
                    }
                  </tr>
                </thead>

                <tbody>
                  {
                    nodalAnalysis.admittanceMatrix.map(
                      (row) => (
                        <tr
                          key={
                            row.nodeId
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
                            {row.nodeId}
                          </th>

                          {
                            row.values.map(
                              (value, columnIndex) => (
                                <td
                                  key={
                                    `${row.nodeId}-${columnIndex}`
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
            Estampas passivas
          </strong>
        </div>

        {
          nodalAnalysis.passiveBranchStamps.length ===
          0 ? (
            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#666",
              }}
            >
              Nenhum ramo passivo válido foi estampado.
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
                nodalAnalysis.passiveBranchStamps.map(
                  (stamp) => (
                    <li
                      key={
                        stamp.elementId
                      }
                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      <strong>
                        {stamp.elementId}
                      </strong>{" "}
                      ({stamp.fromNodeId} → {stamp.toNodeId}):{" "}
                      {
                        formatComplexValue(
                          stamp.admittance
                        )
                      }
                      {" S"}
                    </li>
                  )
                )
              }
            </ul>
          )
        }

        {
          nodalAnalysis.skippedBypassedElementIds.length >
          0 ? (
            <p
              style={{
                margin:
                  "10px 0 0",

                color:
                  "#b45309",
              }}
            >
              Desviados fora de Y:{" "}
              {
                nodalAnalysis.skippedBypassedElementIds.join(
                  ", "
                )
              }
            </p>
          ) : null
        }

        {
          nodalAnalysis.skippedSourceElementIds.length >
          0 ? (
            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#666",
              }}
            >
              Fontes reservadas para MNA:{" "}
              {
                nodalAnalysis.skippedSourceElementIds.join(
                  ", "
                )
              }
            </p>
          ) : null
        }
      </div>
    </details>
  );
}
