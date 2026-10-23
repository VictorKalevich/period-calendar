interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}

/** Числовой выбор с круглыми кнопками 44×44. */
export function Stepper({ label, value, min, max, unit, onChange }: Props) {
  return (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <div className="stepper__controls">
        <button
          type="button"
          className="round-btn"
          aria-label={`${label}: меньше`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output className="stepper__value" aria-live="polite">
          {value} {unit}
        </output>
        <button
          type="button"
          className="round-btn"
          aria-label={`${label}: больше`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
