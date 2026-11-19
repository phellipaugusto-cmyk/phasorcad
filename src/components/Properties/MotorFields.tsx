import { useState } from "react";
import type { CircuitElement } from "../../core/CircuitElement";
import {
  KW_PER_CV,
  getMotorEquivalent,
  getMotorParameters,
  type MotorParameters,
} from "../../core/motorModel";

interface MotorFieldsProps {
  element: CircuitElement;
  onChange: (changes: Partial<MotorParameters>) => void;
  onPowerChange: (kw: number) => void;
}

const fmt = (value: number, digits = 2) =>
  Number(value.toFixed(digits)).toString().replace(".", ",");

/* Campo numérico que só confirma ao sair do campo ou com Enter. */
function NumberField({
  label,
  value,
  onCommit,
  step = "any",
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  const commit = () => {
    if (text !== null) {
      const parsed = Number(text.replace(",", "."));

      if (Number.isFinite(parsed)) {
        onCommit(parsed);
      }

      setText(null);
    }
  };

  return (
    <label className="motor-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={text ?? String(Number(value.toPrecision(5)))}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            (event.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}

/* Dados de placa do motor e o circuito equivalente resultante. */
export function MotorFields({
  element,
  onChange,
  onPowerChange,
}: MotorFieldsProps) {
  const params = getMotorParameters(element);
  const equivalent = getMotorEquivalent(element);

  return (
    <div className="motor-fields">
      <NumberField
        label="Potência no eixo (cv)"
        value={element.value / KW_PER_CV}
        onCommit={(cv) => onPowerChange(cv * KW_PER_CV)}
      />
      <NumberField
        label="Rendimento (%)"
        value={params.efficiency * 100}
        onCommit={(percent) => onChange({ efficiency: percent / 100 })}
      />
      <NumberField
        label="Fator de potência"
        value={params.powerFactor}
        step="0.01"
        onCommit={(fp) => onChange({ powerFactor: fp })}
      />
      <NumberField
        label="Tensão nominal (V)"
        value={params.ratedVoltage}
        onCommit={(volts) => onChange({ ratedVoltage: volts })}
      />

      {equivalent ? (
        <p className="motor-summary">
          Nominal: P = {fmt(equivalent.activePower, 0)} W, S ={" "}
          {fmt(equivalent.apparentPower, 0)} VA, I ={" "}
          {fmt(equivalent.ratedCurrent, 2)} A.
          <br />
          Equivalente: R = {fmt(equivalent.resistance)} Ω em série com L ={" "}
          {fmt(equivalent.inductance * 1000, 1)} mH (X ={" "}
          {fmt(equivalent.reactance)} Ω a 60 Hz).
          <br />
          Modelo de impedância constante.
        </p>
      ) : null}
    </div>
  );
}
