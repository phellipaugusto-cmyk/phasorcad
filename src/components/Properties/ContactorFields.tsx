import type { CircuitElement } from "../../core/CircuitElement";
import {
  CONTACTOR_PICKUP_FRACTION,
  getContactorParameters,
  type ContactorParameters,
} from "../../core/contactorModel";
import type { CoilState } from "../../solver/contactorResolver";
import { NumberField } from "./MotorFields";

interface ContactorFieldsProps {
  element: CircuitElement;
  coil: CoilState | undefined;
  converged: boolean;
  contacts: CircuitElement[];
  onChange: (changes: Partial<ContactorParameters>) => void;
}

const fmt = (value: number, digits = 1) =>
  Number(value.toFixed(digits)).toString().replace(".", ",");

/* Dados da bobina, estado (energizada?) e contatos comandados. */
export function ContactorFields({
  element,
  coil,
  converged,
  contacts,
  onChange,
}: ContactorFieldsProps) {
  const params = getContactorParameters(element);
  const pickup = CONTACTOR_PICKUP_FRACTION * params.ratedVoltage;

  return (
    <div className="motor-fields">
      <NumberField
        label="Tensão da bobina (V)"
        value={params.ratedVoltage}
        onCommit={(volts) => onChange({ ratedVoltage: volts })}
      />
      <NumberField
        label="Fator de potência"
        value={params.powerFactor}
        step="0.01"
        onCommit={(fp) => onChange({ powerFactor: fp })}
      />

      <p className="motor-summary">
        <strong
          style={{ color: coil?.energized ? "#15803d" : "#6b7280" }}
        >
          {coil?.energized ? "Bobina energizada" : "Bobina desenergizada"}
        </strong>
        {coil ? ` (${fmt(coil.voltage)} V; arma a partir de ${fmt(pickup)} V)` : ""}
        .
        <br />
        {contacts.length === 0
          ? "Nenhum contato ligado a esta bobina: adicione um Interruptor e escolha \"Contato de\" esta bobina."
          : `Contatos: ${contacts
              .map(
                (item) =>
                  `${item.label} (${item.normallyClosed ? "NF" : "NA"}, ${
                    item.closed === false ? "aberto" : "fechado"
                  })`
              )
              .join(", ")}.`}
        {!converged ? (
          <>
            <br />
            <span style={{ color: "#b91c1c" }}>
              O comando não estabiliza (a bobina desliga a si mesma?).
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
