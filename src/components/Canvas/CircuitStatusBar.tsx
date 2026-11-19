interface CircuitStatusBarProps {
  error: string | null;
  message: string | null;
  selectedOriginTerminalId: string | null;
  selectedConnectionId: string | null;
  onCancel: () => void;
  onNewConnection: () => void;
}

export function CircuitStatusBar({
  error,
  message,
  selectedOriginTerminalId,
  selectedConnectionId,
  onCancel,
  onNewConnection,
}: CircuitStatusBarProps) {
  const selectionIsActive = selectedOriginTerminalId !== null;
  const statusIsError = error !== null;
  const statusIsSuccess = message !== null;

  let text = "Clique em um terminal para iniciar uma conexão.";

  if (error) {
    text = error;
  } else if (message) {
    text = message;
  } else if (selectedOriginTerminalId) {
    text = `Terminal de origem: ${selectedOriginTerminalId}. Aguardando terminal de destino.`;
  } else if (selectedConnectionId) {
    text = "Conexão selecionada. Use o painel para removê-la.";
  }

  return (
    <div
      className="circuit-status-bar"
      style={{
        minHeight: "34px",
        marginBottom: "8px",
        padding: "6px 10px",
        border: statusIsError
          ? "1px solid #dc2626"
          : statusIsSuccess
            ? "1px solid #16a34a"
            : selectionIsActive
              ? "1px solid #2563eb"
              : "1px solid #d1d5db",
        borderRadius: "6px",
        backgroundColor: statusIsError
          ? "#fef2f2"
          : statusIsSuccess
            ? "#f0fdf4"
            : selectionIsActive
              ? "#eff6ff"
              : "#f9fafb",
        color: statusIsError
          ? "#b91c1c"
          : statusIsSuccess
            ? "#15803d"
            : selectionIsActive
              ? "#1d4ed8"
              : "#4b5563",
        fontSize: "13px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        boxSizing: "border-box",
      }}
    >
      <span>{text}</span>

      {selectionIsActive ? (
        <button type="button" onClick={onCancel} style={{ cursor: "pointer" }}>
          Cancelar
        </button>
      ) : statusIsSuccess ? (
        <button
          type="button"
          onClick={onNewConnection}
          style={{ cursor: "pointer" }}
        >
          Nova conexão
        </button>
      ) : null}
    </div>
  );
}
