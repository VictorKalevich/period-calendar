interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Единица после числа; не нужна, если задан `format`. */
  unit?: string;
  /** Подпись значения целиком, например «+2 дня». */
  format?: (value: number) => string;
  /** Самая широкая подпись: ячейка значения не меняет ширину, кнопки не прыгают. */
  widest?: string;
  onChange: (value: number) => void;
}

/** Числовой выбор с круглыми кнопками 44×44. */
export function Stepper({ label, value, min, max, unit, format, widest, onChange }: Props) {
  const text = format ? format(value) : `${value} ${unit ?? ''}`.trim();
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
        {widest ? (
          <span className="stepper__value stepper__value--fixed">
            <span className="stepper__sizer" aria-hidden="true">
              {widest}
            </span>
            <output aria-live="polite">{text}</output>
          </span>
        ) : (
          <output className="stepper__value" aria-live="polite">
            {text}
          </output>
        )}
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
