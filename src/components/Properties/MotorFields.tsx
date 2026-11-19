import { useState } from "react";
import type { CircuitElement } from "../../core/CircuitElement";
import {
  KW_PER_CV,
  MOTOR_MAX_LOAD_FACTOR,
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
export function NumberField({
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

      <label className="motor-field motor-load">
        <span>
          Carga no eixo: {fmt(params.loadFactor * 100, 0)} %
          {params.loadFactor === 0 ? " (a vazio)" : ""}
        </span>
        <input
          type="range"
          min={0}
          max={MOTOR_MAX_LOAD_FACTOR * 100}
          step={5}
          value={params.loadFactor * 100}
          onChange={(event) =>
            onChange({ loadFactor: Number(event.target.value) / 100 })
          }
          aria-label="Carga no eixo, em % da nominal"
        />
      </label>

      {equivalent ? (
        <p className="motor-summary">
          Na tensão nominal, com {fmt(equivalent.loadFactor * 100, 0)} % de
          carga: P<sub>eixo</sub> = {fmt(equivalent.shaftPower, 1)} W, P ={" "}
          {fmt(equivalent.activePower, 1)} W, Q ={" "}
          {fmt(equivalent.reactivePower, 1)} var, I ={" "}
          {fmt(equivalent.ratedCurrent, 3)} A, FP ={" "}
          {fmt(equivalent.powerFactor, 3)}, η ={" "}
          {fmt(equivalent.efficiency * 100, 1)} %.
          <br />
          Equivalente: R = {fmt(equivalent.resistance)} Ω em série com L ={" "}
          {fmt(equivalent.inductance * 1000, 1)} mH (X ={" "}
          {fmt(equivalent.reactance)} Ω a 60 Hz).
          <br />
          Modelo de impedância constante no ponto de carga escolhido.
        </p>
      ) : null}
    </div>
  );
}
