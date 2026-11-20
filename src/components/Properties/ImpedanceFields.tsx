import type { CircuitElement } from "../../core/CircuitElement";
import {
  formatImpedance,
  getImpedanceAt,
  getImpedanceParameters,
  type ImpedanceParameters,
} from "../../core/impedanceModel";
import { NumberField } from "./MotorFields";

interface ImpedanceFieldsProps {
  element: CircuitElement;
  frequency: number;
  onChange: (changes: Partial<ImpedanceParameters>) => void;
}

const fmt = (value: number, digits = 3) =>
  Number(value.toFixed(digits)).toString().replace(".", ",");

/* Z = R + jX (X em 60 Hz) e o resultado na frequência atual. */
export function ImpedanceFields({ element, frequency, onChange }: ImpedanceFieldsProps) {
  const params = getImpedanceParameters(element);
  const atF = getImpedanceAt(element, frequency);
  const magnitude = Math.hypot(atF.resistance, atF.reactance);
  const angle = (Math.atan2(atF.reactance, atF.resistance) * 180) / Math.PI;

  return (
    <div className="motor-fields">
      <NumberField
        label="R (Ω)"
        value={params.resistance}
        onCommit={(r) => onChange({ resistance: r })}
      />
      <NumberField
        label="X em 60 Hz (Ω; + indutiva, − capacitiva)"
        value={params.reactance}
        onCommit={(x) => onChange({ reactance: x })}
      />
      <p className="motor-summary">
        Em {fmt(frequency, 1)} Hz: Z = {formatImpedance(atF, true)} = {fmt(magnitude)} Ω ∠
        {fmt(angle, 1)}°, FP = {fmt(magnitude > 0 ? atF.resistance / magnitude : 1)}
        {atF.reactance > 0 ? " indutivo" : atF.reactance < 0 ? " capacitivo" : ""}.
        {element.group
          ? element.group.balanced === false
            ? " Só esta fase (carga desequilibrada)."
            : " Vale para as três fases do bloco."
          : ""}
      </p>
    </div>
  );
}
