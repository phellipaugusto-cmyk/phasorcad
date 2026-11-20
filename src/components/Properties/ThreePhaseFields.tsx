import type { CircuitElement } from "../../core/CircuitElement";
import { getSourceLineVoltage } from "../../core/threePhase";
import { NumberField } from "./MotorFields";

interface ThreePhaseFieldsProps {
  element: CircuitElement;
  members: CircuitElement[];
  onChange: (changes: {
    connection?: "Y" | "D";
    sequence?: "ABC" | "ACB";
    lineVoltage?: number;
  }) => void;
}

/* Configuração do bloco trifásico (vale para os três membros). */
export function ThreePhaseFields({ element, members, onChange }: ThreePhaseFieldsProps) {
  const group = element.group;

  if (!group) {
    return null;
  }

  const isSource = group.kind === "source";
  const name = element.label.replace(/\s+\S+$/, "");

  return (
    <div className="motor-fields">
      <div>
        <strong>{name}</strong> — {isSource ? "gerador" : "carga"} trifásico
        {isSource ? "" : "a"} equilibrad{isSource ? "o" : "a"}
      </div>

      <label className="motor-field">
        <span>Ligação</span>
        <select
          value={group.connection}
          onChange={(event) =>
            onChange({ connection: event.target.value === "D" ? "D" : "Y" })
          }
        >
          <option value="Y">Estrela (Y)</option>
          <option value="D">Triângulo (Δ)</option>
        </select>
      </label>

      {isSource ? (
        <>
          <NumberField
            label="Tensão de linha V_L (V)"
            value={Number(getSourceLineVoltage(members).toFixed(3))}
            onCommit={(volts) => onChange({ lineVoltage: volts })}
          />
          <label className="motor-field">
            <span>Sequência</span>
            <select
              value={group.sequence ?? "ABC"}
              onChange={(event) =>
                onChange({ sequence: event.target.value === "ACB" ? "ACB" : "ABC" })
              }
            >
              <option value="ABC">ABC (positiva)</option>
              <option value="ACB">ACB (negativa)</option>
            </select>
          </label>
        </>
      ) : null}

      <p className="motor-summary">
        {isSource
          ? group.connection === "Y"
            ? "Em Y, cada fonte tem a tensão de fase V_F = V_L/√3; o terminal esquerdo de cada uma é o neutro."
            : "Em Δ, cada fonte fica entre duas linhas e tem a própria tensão de linha."
          : group.connection === "Y"
            ? "Em Y, cada Z fica entre a linha e o neutro (terminais direitos ligados)."
            : "Em Δ, cada Z fica entre duas linhas: Z_AB, Z_BC e Z_CA."}{" "}
        Mudar um membro muda os três. Trocar a ligação mantém os fios das linhas
        A, B e C{group.connection === "Y" ? " (o do neutro é removido)" : ""}.
      </p>
    </div>
  );
}
