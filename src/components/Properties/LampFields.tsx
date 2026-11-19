import type { CircuitElement } from "../../core/CircuitElement";
import {
  getLampRatedVoltage,
  getLampResistance,
} from "../../core/lampModel";
import { NumberField } from "./MotorFields";

interface LampFieldsProps {
  element: CircuitElement;
  onVoltageChange: (volts: number) => void;
}

const fmt = (value: number, digits = 2) =>
  Number(value.toFixed(digits)).toString().replace(".", ",");

/* Tensão nominal da lâmpada e o resistor equivalente. */
export function LampFields({ element, onVoltageChange }: LampFieldsProps) {
  const resistance = getLampResistance(element);

  return (
    <div className="motor-fields">
      <NumberField
        label="Tensão nominal (V)"
        value={getLampRatedVoltage(element)}
        onCommit={onVoltageChange}
      />

      {resistance ? (
        <p className="motor-summary">
          Incandescente = resistor puro: R = Vn²/P = {fmt(resistance, 1)} Ω
          (FP = 1).
        </p>
      ) : null}
    </div>
  );
}
