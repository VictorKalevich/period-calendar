interface Props {
  label: string;
  /** Пояснение мелким текстом под подписью. */
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  /** `id` пояснения вне строки (`aria-describedby`). */
  describedBy?: string;
  onChange: (checked: boolean) => void;
}

/**
 * Переключатель дизайн-системы (`docs/design/design.md`, «Компоненты»): строка 52 с подписью и необязательной
 * подсказкой. Порядок свойств `input` задаёт порядок атрибутов в разметке — прежний (019).
 */
export function Toggle({ label, hint, checked, disabled, describedBy, onChange }: Props) {
  return (
    <label className="toggle">
      <span>
        {label}
        {hint !== undefined && <span className="t-small toggle__hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
