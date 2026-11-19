import { useState } from "react";
import type {
  CircuitElement,
  MeasuredReadings,
} from "../../core/CircuitElement";

interface MeasuredFieldsProps {
  element: CircuitElement;
  /* NaN apaga a leitura. */
  onChange: (quantity: keyof MeasuredReadings, value: number) => void;
}

const FIELDS: { key: keyof MeasuredReadings; label: string }[] = [
  { key: "voltage", label: "Tensão medida (V)" },
  { key: "current", label: "Corrente medida (A)" },
  { key: "power", label: "Potência medida (W)" },
];

/* Campo opcional: vazio = sem leitura. Confirma ao sair ou com Enter. */
function OptionalNumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);

  const commit = () => {
    if (text !== null) {
      const trimmed = text.trim();
      onCommit(trimmed === "" ? Number.NaN : Number(trimmed.replace(",", ".")));
      setText(null);
    }
  };

  return (
    <label className="motor-field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="—"
        value={text ?? (value === undefined ? "" : String(value))}
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

/* Leituras da bancada, para o painel "Medido × Simulado". */
export function MeasuredFields({ element, onChange }: MeasuredFieldsProps) {
  const hasReadings = element.measured !== undefined;

  return (
    <details className="motor-fields" open={hasReadings}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Leituras da bancada
      </summary>
      {FIELDS.map((field) => (
        <OptionalNumberField
          key={`${element.id}-${field.key}`}
          label={field.label}
          value={element.measured?.[field.key]}
          onCommit={(value) => onChange(field.key, value)}
        />
      ))}
    </details>
  );
}
