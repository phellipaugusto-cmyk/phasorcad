import type { ReactNode } from "react";

interface ToolboxProps {
  onNewCircuit: () => void;
  onSaveCircuit: () => void;
  onOpenCircuit: (file: File) => void;
  onAddSource: () => void;
  onAddCurrentSource: () => void;
  onAddResistor: () => void;
  onAddCapacitor: () => void;
  onAddInductor: () => void;
  /* Só no celular: abre a página de análise. */
  onExportReport?: () => void;
  onOpenAnalysis?: () => void;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="tb-ico"
      viewBox="0 0 32 28"
      width="32"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  source: (
    <Icon>
      <circle cx="16" cy="14" r="10" />
      <path d="M9.5 14 q3.2 -7 6.5 0 t6.5 0" />
    </Icon>
  ),
  current: (
    <Icon>
      <circle cx="16" cy="14" r="10" />
      <path d="M16 20 V8 M12 12 l4 -4 l4 4" />
    </Icon>
  ),
  resistor: (
    <Icon>
      <path d="M2 14 h5 l2 -6 l4 12 l4 -12 l4 12 l2 -6 h7" />
    </Icon>
  ),
  capacitor: (
    <Icon>
      <path d="M2 14 h12 M14 5 v18 M18 5 v18 M18 14 h12" />
    </Icon>
  ),
  inductor: (
    <Icon>
      <path d="M2 17 h3 a3.5 3.5 0 0 1 7 0 a3.5 3.5 0 0 1 7 0 a3.5 3.5 0 0 1 7 0 h3" />
    </Icon>
  ),
  analysis: (
    <Icon>
      <path d="M3 24 V4 M3 24 H29 M7 18 l5 -6 l5 4 l9 -10" />
    </Icon>
  ),
};

export function Toolbox({
  onNewCircuit,
  onSaveCircuit,
  onOpenCircuit,
  onAddSource,
  onAddCurrentSource,
  onAddResistor,
  onAddCapacitor,
  onAddInductor,
  onExportReport,
  onOpenAnalysis,
}: ToolboxProps) {
  const part = (
    icon: ReactNode,
    label: string,
    onClick: () => void,
    title: string
  ) => (
    <button
      type="button"
      className="tb-part"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {icon}
      <span className="tb-lbl">{label}</span>
    </button>
  );

  return (
    <div className="toolbox">
      <div className="toolbox-list">
        {part(ICONS.source, "Fonte CA", onAddSource, "Adicionar uma Fonte CA (tensão)")}
        {part(ICONS.current, "Fonte I", onAddCurrentSource, "Adicionar uma Fonte de corrente")}
        {part(ICONS.resistor, "Resistor", onAddResistor, "Adicionar um Resistor")}
        {part(ICONS.capacitor, "Capacitor", onAddCapacitor, "Adicionar um Capacitor")}
        {part(ICONS.inductor, "Indutor", onAddInductor, "Adicionar um Indutor")}
        <span className="tb-sep tb-files" />
        <div className="tb-files tb-filegroup">
          <button type="button" className="tb-file" onClick={onNewCircuit}>
            Novo
          </button>
          <button
            type="button"
            className="tb-file"
            onClick={onSaveCircuit}
            title="Baixar o circuito como arquivo .json."
          >
            Salvar
          </button>
          {onExportReport ? (
            <button
              type="button"
              className="tb-file"
              onClick={onExportReport}
              title="Gerar um relatório em PDF da análise do circuito."
            >
              PDF
            </button>
          ) : null}
          <label className="tb-file tb-open" title="Abrir um circuito salvo (.json).">
            Abrir
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  onOpenCircuit(file);
                }
              }}
            />
          </label>
        </div>
        {onOpenAnalysis ? (
          <button
            type="button"
            className="tb-part tb-analysis"
            onClick={onOpenAnalysis}
            aria-label="Abrir a análise completa"
          >
            {ICONS.analysis}
            <span className="tb-lbl">Análise</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
