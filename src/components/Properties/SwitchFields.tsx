import type { CircuitElement } from "../../core/CircuitElement";

export interface SwitchControlChange {
  /* "" = manual (sem bobina). */
  controlledBy?: string;
  normallyClosed?: boolean;
  momentary?: boolean;
}

interface SwitchFieldsProps {
  /* Como está no editor (o que o usuário configurou). */
  element: CircuitElement;
  /* Como ficou depois das bobinas (estado real). */
  resolved: CircuitElement;
  contactors: CircuitElement[];
  onToggle: () => void;
  onPulse: () => void;
  onControlChange: (change: SwitchControlChange) => void;
}

/* Interruptor manual ou contato comandado por uma bobina. */
export function SwitchFields({
  element,
  resolved,
  contactors,
  onToggle,
  onPulse,
  onControlChange,
}: SwitchFieldsProps) {
  const controller = contactors.find(
    (item) => item.id === element.controlledBy
  );
  const closed = resolved.closed !== false;

  return (
    <div className="motor-fields">
      <div>
        <strong>Estado:</strong>{" "}
        <span style={{ color: closed ? "#15803d" : "#b91c1c" }}>
          {closed ? "fechado (ligado)" : "aberto (desligado)"}
        </span>
      </div>

      <label className="motor-field">
        <span>Acionamento</span>
        <select
          value={controller ? controller.id : ""}
          onChange={(event) =>
            onControlChange({ controlledBy: event.target.value })
          }
        >
          <option value="">Manual</option>
          {contactors.map((item) => (
            <option key={item.id} value={item.id}>
              Contato de {item.label}
            </option>
          ))}
        </select>
      </label>

      {controller ? (
        <>
          <label className="motor-field">
            <span>Tipo de contato</span>
            <select
              value={element.normallyClosed ? "NF" : "NA"}
              onChange={(event) =>
                onControlChange({
                  normallyClosed: event.target.value === "NF",
                })
              }
            >
              <option value="NA">NA (fecha com a bobina)</option>
              <option value="NF">NF (abre com a bobina)</option>
            </select>
          </label>
          <p className="motor-summary">
            Estado automático: segue a bobina {controller.label}. Para
            mudar, ligue ou desligue o que alimenta a bobina.
          </p>
        </>
      ) : (
        <>
          <label className="motor-field">
            <span>Tipo</span>
            <select
              value={
                element.momentary
                  ? element.normallyClosed
                    ? "pulso-NF"
                    : "pulso-NA"
                  : "retem"
              }
              onChange={(event) => {
                const value = event.target.value;
                onControlChange({
                  momentary: value !== "retem",
                  normallyClosed: value === "pulso-NF",
                });
              }}
            >
              <option value="retem">Interruptor (retém)</option>
              <option value="pulso-NA">Botoeira NA (liga)</option>
              <option value="pulso-NF">Botoeira NF (desliga)</option>
            </select>
          </label>
          {element.momentary ? (
            <>
              <button
                type="button"
                onClick={onPulse}
                style={{ marginTop: "6px", cursor: "pointer" }}
              >
                Pressionar
              </button>
              <p className="motor-summary">
                Botoeira: fica pressionada por um instante e volta
                sozinha. No desenho, duplo clique também pressiona.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              style={{ marginTop: "6px", cursor: "pointer" }}
            >
              {closed ? "Desligar" : "Ligar"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
