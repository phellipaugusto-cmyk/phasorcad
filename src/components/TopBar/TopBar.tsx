import { useState } from "react";

interface TopBarProps {
  statusLabel: string;
  statusMessage: string;
  statusColor: string;
  statusBackground: string;
  statusBorder: string;
  frequency: number;
  setFrequency: (value: number) => void;
  onNewCircuit: () => void;
  onLoadBenchPreset: () => void;
  onSaveCircuit: () => void;
  onOpenCircuit: (file: File) => void;
  onExportReport: () => void;
}

/* Barra superior do celular: estado, frequência e menu de arquivo. */
export function TopBar({
  statusLabel,
  statusMessage,
  statusColor,
  statusBackground,
  statusBorder,
  frequency,
  setFrequency,
  onNewCircuit,
  onLoadBenchPreset,
  onSaveCircuit,
  onOpenCircuit,
  onExportReport,
}: TopBarProps) {
  const [open, setOpen] = useState<"status" | "freq" | "menu" | null>(null);

  const toggle = (name: "status" | "freq" | "menu") =>
    setOpen((current) => (current === name ? null : name));

  return (
    <header className="topbar">
      <button
        type="button"
        className="chip"
        style={{
          color: statusColor,
          background: statusBackground,
          borderColor: statusBorder,
        }}
        aria-expanded={open === "status"}
        onClick={() => toggle("status")}
      >
        <span className="dot" style={{ background: statusColor }} />
        {statusLabel}
      </button>

      <button
        type="button"
        className="chip"
        aria-expanded={open === "freq"}
        onClick={() => toggle("freq")}
      >
        {frequency} Hz
      </button>

      <span className="topbar-title">PhasorCAD</span>

      <button
        type="button"
        className="chip chip-icon"
        aria-label="Menu de arquivo"
        aria-expanded={open === "menu"}
        onClick={() => toggle("menu")}
      >
        ⋯
      </button>

      {open ? (
        <div className="popover" role="dialog">
          {open === "status" ? (
            <p className="popover-text">{statusMessage}</p>
          ) : null}

          {open === "freq" ? (
            <div className="popover-row">
              <label>
                Frequência
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.000001"
                  value={frequency}
                  onChange={(event) =>
                    setFrequency(
                      Math.max(Number(event.target.value), 0.000001)
                    )
                  }
                />
              </label>
              <span>Hz</span>
              <button type="button" onClick={() => setFrequency(50)}>
                50
              </button>
              <button type="button" onClick={() => setFrequency(60)}>
                60
              </button>
            </div>
          ) : null}

          {open === "menu" ? (
            <div className="popover-menu">
              <button
                type="button"
                onClick={() => {
                  setOpen(null);
                  onNewCircuit();
                }}
              >
                Novo circuito
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(null);
                  onLoadBenchPreset();
                }}
              >
                Exemplo: Bancada
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(null);
                  onSaveCircuit();
                }}
              >
                Salvar circuito
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(null);
                  onExportReport();
                }}
              >
                Relatório em PDF
              </button>
              <label className="menu-open">
                Abrir circuito
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    setOpen(null);
                    if (file) {
                      onOpenCircuit(file);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
