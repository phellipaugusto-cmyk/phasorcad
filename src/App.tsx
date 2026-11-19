import { useState } from "react";
import { isSourceType } from "./core/CircuitElement";
import { useCircuitAnalysis } from "./hooks/useCircuitAnalysis";
import { useCircuitEditor } from "./hooks/useCircuitEditor";
import { TopBar } from "./components/TopBar/TopBar";
import { ResultsStrip } from "./components/ResultsPanel/ResultsStrip";
import { WireInfoPanel } from "./components/ResultsPanel/WireInfoPanel";
import { MotorFields } from "./components/Properties/MotorFields";
import { Toolbox } from "./components/Toolbox/Toolbox";
import { Canvas } from "./components/Canvas/Canvas";
import { ResultsPanel } from "./components/ResultsPanel/ResultsPanel";
import { SolverComparisonPanel } from "./components/ResultsPanel/SolverComparisonPanel";
import { MnaElectricalResultsPanel } from "./components/ResultsPanel/MnaElectricalResultsPanel";
import { MeasurementComparisonPanel } from "./components/ResultsPanel/MeasurementComparisonPanel";
import { LampFields } from "./components/Properties/LampFields";
import { MeasuredFields } from "./components/Properties/MeasuredFields";
import { PhasorDiagram } from "./components/PhasorDiagram/PhasorDiagram";
import { FrequencySweepPanel } from "./components/FrequencySweep/FrequencySweepPanel";
import { WaveformPanel } from "./components/Waveform/WaveformPanel";
import { CircuitGraphPanel } from "./components/DebugPanels/CircuitGraphPanel";
import { AdmittanceMatrixPanel } from "./components/DebugPanels/AdmittanceMatrixPanel";
import { MnaMatrixPanel } from "./components/DebugPanels/MnaMatrixPanel";
import { MnaSolutionPanel } from "./components/DebugPanels/MnaSolutionPanel";

function App() {
  const {
    elements,
    setElements,
    connections,
    setConnections,
    frequency,
    setFrequency,
    sourceVoltage,
    setSourceVoltage,
    selectedElementId,
    setSelectedElementId,
    selectedConnectionId,
    setSelectedConnectionId,
    editingElementId,
    setEditingElementId,
    showDebugPanels,
    setShowDebugPanels,
    selectedElement,
    selectedConnection,
    selectedElementIsProtected,
    newCircuit,
    saveCircuitToFile,
    openCircuitFile,
    addSource,
    addCurrentSource,
    addResistor,
    addCapacitor,
    addInductor,
    addMotor,
    addLamp,
    addSwitch,
    loadBenchPreset,
    toggleSelectedSwitch,
    updateSelectedLampVoltage,
    updateSelectedMeasured,
    removeSelectedElement,
    removeSelectedConnection,
    getDisplayValue,
    getUnit,
    updateSelectedElement,
    getSelectedPhase,
    updateSelectedPhase,
    updateSelectedMotor,
  } = useCircuitEditor();

  const {
    animationModel,
    circuitState,
    circuitStatusStyle,
    circuitGraph,
    nodalAnalysis,
    modifiedNodalAnalysis,
    mnaSolution,
    mnaElectricalResults,
    mnaPrimaryResult,
    legacyResult,
    result,
    bypassedElementIds,
  } = useCircuitAnalysis(
    elements,
    connections,
    frequency,
    sourceVoltage
  );

  const [view, setView] = useState<"circuit" | "analysis">("circuit");
  const [resultsOpen, setResultsOpen] = useState(false);

  const [reportBusy, setReportBusy] = useState(false);

  const exportReport = async () => {
    if (reportBusy) {
      return;
    }

    setReportBusy(true);

    try {
      const { downloadCircuitReport } = await import("./report/downloadReport");

      await downloadCircuitReport({
        elements,
        connections,
        frequency,
        result,
        circuitState,
        graph: circuitGraph,
        results: mnaElectricalResults,
      });
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o relatório em PDF.");
    } finally {
      setReportBusy(false);
    }
  };

  const closeSelection = () => {
    setSelectedElementId(null);
    setSelectedConnectionId(null);
  };

  const stepValue = (factor: number) => {
    const current = Number(getDisplayValue());
    const next = current === 0 ? 1 : Number((current * factor).toPrecision(3));
    updateSelectedElement(next);
  };

  const hasSelection = Boolean(selectedElement || selectedConnection);

  const selectionPanel = (
    <>
      {selectedConnection ? (
          <div>
            <h3>
              Conexão Selecionada
              <button type="button" className="sheet-close" aria-label="Fechar" onClick={closeSelection}>×</button>
            </h3>

            <div>
              <strong>
                Origem:
              </strong>{" "}
              {
                selectedConnection
                  .fromTerminalId
              }
            </div>

            <div
              style={{
                marginTop:
                  "6px",
              }}
            >
              <strong>
                Destino:
              </strong>{" "}
              {
                selectedConnection
                  .toTerminalId
              }
            </div>

            <WireInfoPanel
              connection={selectedConnection}
              graph={circuitGraph}
              model={animationModel}
            />
            <div
              style={{
                marginTop:
                  "16px",
              }}
            >
              <button
                type="button"
                onClick={
                  removeSelectedConnection
                }
                style={{
                  color:
                    "#b91c1c",

                  cursor:
                    "pointer",
                }}
              >
                Remover conexão
              </button>
            </div>

            <p
              style={{
                marginTop:
                  "8px",

                color:
                  "#666",

                fontSize:
                  "12px",
              }}
            >
              A remoção do fio não remove os componentes.
            </p>
          </div>
        ) : selectedElement ? (
          <div>
            <h3>
              Componente Selecionado
              <button type="button" className="sheet-close" aria-label="Fechar" onClick={closeSelection}>×</button>
            </h3>

            <div>
              <strong>
                ID:
              </strong>{" "}
              {
                selectedElement.id
              }
            </div>

            <div>
              <strong>
                Tipo:
              </strong>{" "}
              {
                selectedElement.type
              }
            </div>

            {selectedElement.type === "switch" ? (
              <div style={{ marginTop: "10px" }}>
                <strong>Estado:</strong>{" "}
                {selectedElement.closed === false ? "aberto (desligado)" : "fechado (ligado)"}
                <br />
                <button
                  type="button"
                  onClick={toggleSelectedSwitch}
                  style={{ marginTop: "6px", cursor: "pointer" }}
                >
                  {selectedElement.closed === false ? "Ligar" : "Desligar"}
                </button>
              </div>
            ) : (
            <div
              style={{
                marginTop:
                  "10px",
              }}
            >
              <label>
                <strong>
                  Valor:
                </strong>
              </label>

              <br />

              <button
                type="button"
                className="step-btn"
                aria-label="Diminuir valor"
                onClick={() => stepValue(0.9)}
              >
                −
              </button>
              <input
                type="number"
                inputMode="decimal"
                value={
                  getDisplayValue()
                }
                onChange={(
                  event
                ) =>
                  updateSelectedElement(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={{
                  width:
                    "100px",

                  marginTop:
                    "4px",
                }}
              />

              <button
                type="button"
                className="step-btn"
                aria-label="Aumentar valor"
                onClick={() => stepValue(1.1)}
              >
                +
              </button>
              {" "}
              {getUnit()}
            </div>
            )}
            {selectedElement.type === "lamp" ? (
              <LampFields
                element={selectedElement}
                onVoltageChange={updateSelectedLampVoltage}
              />
            ) : null}
            {selectedElement.type === "motor" ? (
              <MotorFields
                element={selectedElement}
                onChange={updateSelectedMotor}
                onPowerChange={updateSelectedElement}
              />
            ) : null}
            <MeasuredFields
              element={selectedElement}
              onChange={updateSelectedMeasured}
            />
            {isSourceType(
              selectedElement.type
            ) ? (
              <div
                style={{
                  marginTop:
                    "10px",
                }}
              >
                <label>
                  <strong>
                    Fase:
                  </strong>
                </label>
                <br />
                <input
                  type="number"
                  step="any"
                  value={
                    getSelectedPhase()
                  }
                  onChange={(
                    event
                  ) =>
                    updateSelectedPhase(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  style={{
                    width:
                      "100px",
                    marginTop:
                      "4px",
                  }}
                />
                {" "}°
                <div
                  style={{
                    color: "#666",
                    fontSize:
                      "12px",
                    marginTop:
                      "4px",
                  }}
                >
                  Padrão: 0°
                  (referência).
                </div>
              </div>
            ) : null}

            <div
              style={{
                marginTop:
                  "16px",
              }}
            >
              <button
                type="button"
                onClick={
                  removeSelectedElement
                }
                disabled={
                  selectedElementIsProtected
                }
                title={
                  selectedElementIsProtected
                    ? "Este componente possui conexão e não pode ser removido."
                    : "Remover componente selecionado."
                }
                style={{
                  color:
                    selectedElementIsProtected
                      ? "#777"
                      : "#b91c1c",

                  cursor:
                    selectedElementIsProtected
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Remover componente
              </button>
            </div>

            {selectedElementIsProtected ? (
              <p
                style={{
                  marginTop:
                    "8px",

                  color:
                    "#666",

                  fontSize:
                    "12px",
                }}
              >
                O componente possui conexão e está protegido.
              </p>
            ) : (
              <p
                style={{
                  marginTop:
                    "8px",

                  color:
                    "#666",

                  fontSize:
                    "12px",
                }}
              >
                O componente está desconectado e pode ser removido.
              </p>
            )}
          </div>
        ) : (
          <div>
            <h3>
              Seleção
            </h3>

            Nenhum componente ou conexão selecionado
          </div>
        )}
    </>
  );

  const phasorEl = (
    <PhasorDiagram
      results={mnaElectricalResults}
      elements={elements}
      selectedElementId={selectedElementId}
    />
  );

  const waveEl = (
    <WaveformPanel
      results={mnaElectricalResults}
      elements={elements}
      selectedElementId={selectedElementId}
      frequency={frequency}
    />
  );


  return (
    <div className="app-root" data-view={view}>
      <TopBar
        statusLabel={circuitStatusStyle.label}
        statusMessage={circuitStatusStyle.message}
        statusColor={circuitStatusStyle.color}
        statusBackground={circuitStatusStyle.background}
        statusBorder={circuitStatusStyle.border}
        frequency={frequency}
        setFrequency={setFrequency}
        onNewCircuit={newCircuit}
        onLoadBenchPreset={loadBenchPreset}
        onSaveCircuit={saveCircuitToFile}
        onOpenCircuit={openCircuitFile}
        onExportReport={exportReport}
      />
      <div className="app-tools">
        <Toolbox
          onNewCircuit={
            newCircuit
          }
          onSaveCircuit={
            saveCircuitToFile
          }
          onOpenCircuit={
            openCircuitFile
          }
          onAddSource={
            addSource
          }
          onAddCurrentSource={
            addCurrentSource
          }
          onAddResistor={
            addResistor
          }
          onAddCapacitor={
            addCapacitor
          }
          onAddInductor={
            addInductor
          }
          onAddMotor={addMotor}
          onAddLamp={addLamp}
          onAddSwitch={addSwitch}
          onLoadBenchPreset={loadBenchPreset}
          onExportReport={exportReport}
          onOpenAnalysis={() => setView("analysis")}
        />
      </div>

      <div className="app-center">
        <div className="status-box" style={{
            marginBottom:
              "8px",

            padding:
              "6px 10px",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "center",

            flexWrap: "wrap",

            gap: "4px 16px",

            border:
              `1px solid ${circuitStatusStyle.border}`,

            borderRadius:
              "6px",

            backgroundColor:
              circuitStatusStyle.background,

            color:
              circuitStatusStyle.color,

            fontWeight:
              600,
          }}
        >
          Estado do circuito:
          {" "}

          {circuitStatusStyle.label}

          <span
            style={{
              fontSize:
                "12px",

              fontWeight:
                400,
            }}
          >
            {circuitStatusStyle.message}
          </span>
        </div>

        <Canvas
          animationModel={animationModel}
          frequency={
            frequency
          }
          setFrequency={
            setFrequency
          }
          sourceVoltage={
            sourceVoltage
          }
          setSourceVoltage={
            setSourceVoltage
          }
          elements={
            elements
          }
          setElements={
            setElements
          }
          connections={
            connections
          }
          setConnections={
            setConnections
          }
          selectedElementId={
            selectedElementId
          }
          setSelectedElementId={
            setSelectedElementId
          }
          selectedConnectionId={
            selectedConnectionId
          }
          setSelectedConnectionId={
            setSelectedConnectionId
          }
          editingElementId={
            editingElementId
          }
          setEditingElementId={
            setEditingElementId
          }
        />
      </div>

      <div className="app-side">
        <button type="button" className="side-back" onClick={() => setView("circuit")}>
          ← Voltar ao circuito
        </button>
        <button type="button" className="side-report" onClick={exportReport} disabled={reportBusy}>
          {reportBusy ? "Gerando PDF…" : "Gerar relatório em PDF"}
        </button>
        <ResultsPanel
          result={
            result
          }
        />

        <hr />

        <label
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "6px",

            marginBottom:
              "12px",

            fontSize:
              "13px",

            cursor:
              "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={
              showDebugPanels
            }
            onChange={() =>
              setShowDebugPanels(
                (current) =>
                  !current
              )
            }
          />
          Modo desenvolvedor (painéis de depuração)
        </label>

        {showDebugPanels ? (
          <>
            <SolverComparisonPanel
              legacyResult={
                legacyResult
              }
              mnaResult={
                mnaPrimaryResult.result
              }
              mnaAvailable={
                mnaPrimaryResult.available
              }
              mnaErrorMessage={
                mnaPrimaryResult.errorMessage
              }
            />

            <CircuitGraphPanel
              circuitGraph={circuitGraph}
              bypassedCount={bypassedElementIds.size}
            />

            <AdmittanceMatrixPanel
              nodalAnalysis={nodalAnalysis}
            />

            <MnaMatrixPanel
              modifiedNodalAnalysis={modifiedNodalAnalysis}
            />

            <MnaSolutionPanel
              modifiedNodalAnalysis={modifiedNodalAnalysis}
              mnaSolution={mnaSolution}
            />
          </>
        ) : null}

        {phasorEl}
        {waveEl}

        <FrequencySweepPanel
          elements={elements}
          connections={connections}
          frequency={frequency}
        />

        <MeasurementComparisonPanel
          elements={elements}
          results={mnaElectricalResults}
        />

        <MnaElectricalResultsPanel
          results={
            mnaElectricalResults
          }
        />

        <hr />

        <div className="sel-desktop">{selectionPanel}</div>
      </div>
      <ResultsStrip
        result={result}
        open={resultsOpen}
        onToggle={() => setResultsOpen((current) => !current)}
      />
      {resultsOpen ? (
        <div className="results-sheet">
          {phasorEl}
          {waveEl}
          <button
            type="button"
            className="more-analysis"
            onClick={() => {
              setResultsOpen(false);
              setView("analysis");
            }}
          >
            Mais análises →
          </button>
        </div>
      ) : null}
      {hasSelection ? (
        <div className="sel-sheet">{selectionPanel}</div>
      ) : null}
    </div>
  );
}

export default App;