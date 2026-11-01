import type { ComponentProps } from 'react';

export function Field({
  label,
  hint,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="rounded-md border border-text-muted/30 bg-surface px-3 py-2 text-base outline-primary"
        {...props}
      />
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </label>
  );
}
