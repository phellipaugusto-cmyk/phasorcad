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
  onAddMotor: () => void;
  onAddLamp: () => void;
  onAddSwitch: () => void;
  onAddContactor: () => void;
  onLoadBenchPreset: () => void;
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
  motor: (
    <Icon>
      <path d="M2 14 h5 M25 14 h5" />
      <circle cx="16" cy="14" r="9" />
      <path d="M11.5 19 V9 l4.5 6 l4.5 -6 V19" />
    </Icon>
  ),
  lamp: (
    <Icon>
      <path d="M2 14 h7 M23 14 h7" />
      <circle cx="16" cy="14" r="7" />
      <path d="M11 9 l10 10 M21 9 l-10 10" />
    </Icon>
  ),
  switch: (
    <Icon>
      <path d="M2 14 h7 M23 14 h7 M9 14 l13 -7" />
      <circle cx="9" cy="14" r="1.6" />
      <circle cx="23" cy="14" r="1.6" />
    </Icon>
  ),
  contactor: (
    <Icon>
      <path d="M2 14 h8 M22 14 h8" />
      <rect x="10" y="8" width="12" height="12" />
      <path d="M12 18 l8 -8" />
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
  onAddMotor,
  onAddLamp,
  onAddSwitch,
  onAddContactor,
  onLoadBenchPreset,
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
        {part(ICONS.motor, "Motor", onAddMotor, "Adicionar um Motor (carga por dados de placa)")}
        {part(ICONS.lamp, "Lâmpada", onAddLamp, "Adicionar uma Lâmpada incandescente (resistiva)")}
        {part(ICONS.switch, "Interruptor", onAddSwitch, "Adicionar um Interruptor (duplo clique liga/desliga)")}
        {part(ICONS.contactor, "Contator", onAddContactor, "Adicionar um Contator (bobina + contato NA comandado)")}
        <span className="tb-sep tb-files" />
        <div className="tb-files tb-filegroup">
          <button type="button" className="tb-file" onClick={onNewCircuit}>
            Novo
          </button>
          <button
            type="button"
            className="tb-file"
            onClick={onLoadBenchPreset}
            title="Abrir o exemplo da bancada de Circuitos 2 (fases A e B, lâmpadas, contator e motor)."
          >
            Bancada
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
