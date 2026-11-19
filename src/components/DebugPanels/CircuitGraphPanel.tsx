import type { CircuitGraph } from "../../core/CircuitGraph";

interface CircuitGraphPanelProps {
  circuitGraph: CircuitGraph;

  bypassedCount: number;
}

export function CircuitGraphPanel({
  circuitGraph,
  bypassedCount,
}: CircuitGraphPanelProps) {
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
        CircuitGraph
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
            Nós elétricos:
          </strong>{" "}
          {
            circuitGraph
              .nodes.length
          }
        </div>

        <div
          style={{
            marginTop:
              "4px",
          }}
        >
          <strong>
            Ramos:
          </strong>{" "}
          {
            circuitGraph
              .branches.length
          }
        </div>

        <div
          style={{
            marginTop:
              "4px",
          }}
        >
          <strong>
            Nó de referência (GND):
          </strong>{" "}
          {
            circuitGraph.referenceNodeId ??
            "não definido"
          }
        </div>

        {
          circuitGraph.referenceTerminalId ? (
            <div
              style={{
                marginTop:
                  "4px",

                color:
                  "#666",
              }}
            >
              Terminal de referência:{" "}
              {
                circuitGraph.referenceTerminalId
              }
            </div>
          ) : null
        }

        <div
          style={{
            marginTop:
              "12px",
          }}
        >
          <strong>
            Terminais por nó
          </strong>
        </div>

        {
          circuitGraph.nodes.length ===
          0 ? (
            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#666",
              }}
            >
              Nenhum nó elétrico identificado.
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
                circuitGraph.nodes.map(
                  (node) => (
                    <li
                      key={
                        node.id
                      }
                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      <strong>
                        {node.id}
                        {
                          node.id ===
                          circuitGraph.referenceNodeId
                            ? " (GND)"
                            : ""
                        }:
                      </strong>{" "}
                      {
                        node.terminalIds.join(
                          ", "
                        )
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
            Componentes desviados:
          </strong>{" "}
          {
            bypassedCount
          }
        </div>

        <div
          style={{
            marginTop:
              "12px",
          }}
        >
          <strong>
            Ramos do circuito
          </strong>
        </div>

        {
          circuitGraph.branches.length ===
          0 ? (
            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#666",
              }}
            >
              Nenhum ramo identificado.
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
                circuitGraph.branches.map(
                  (branch) => (
                    <li
                      key={
                        branch.id
                      }
                      style={{
                        marginBottom:
                          "6px",

                        color:
                          branch.isBypassed
                            ? "#b45309"
                            : "inherit",
                      }}
                    >
                      <strong>
                        {
                          branch.elementId
                        }
                      </strong>{" "}
                      ({
                        branch.elementType
                      }):{" "}
                      {
                        branch.fromNodeId
                      }
                      {" → "}
                      {
                        branch.toNodeId
                      }
                      {
                        branch.isBypassed
                          ? " — DESVIADO (mesmo nó)"
                          : ""
                      }
                    </li>
                  )
                )
              }
            </ul>
          )
        }
      </div>
    </details>
  );
}
