/** Công tắc bật/tắt (role="switch") có nhãn bên cạnh. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-full bg-text-muted/30 transition-colors aria-checked:bg-primary disabled:opacity-50"
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
