import type { LucideIcon } from 'lucide-react';

export type StatAccent = 'blue' | 'green' | 'orange' | 'purple' | 'gray';

// Class viết đủ chữ (không ghép chuỗi) để Tailwind quét được.
const accents: Record<StatAccent, { box: string; bar: string }> = {
  blue: { box: 'bg-blue-light/10 text-blue-light', bar: 'bg-blue-light' },
  green: { box: 'bg-green/10 text-green', bar: 'bg-green' },
  orange: { box: 'bg-orange/10 text-orange', bar: 'bg-orange' },
  purple: { box: 'bg-purple/10 text-purple', bar: 'bg-purple' },
  gray: { box: 'bg-text-muted/10 text-text-muted', bar: 'bg-text-muted' },
};

/**
 * Thẻ số liệu. `inline`: icon cạnh số; `stacked`: icon ở trên, nhãn nhỏ viết hoa, số lớn ở giữa.
 * `progress` vẽ thanh tiến độ (vd. số ghế đã dùng).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'blue',
  variant = 'inline',
  progress,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: StatAccent;
  variant?: 'inline' | 'stacked';
  progress?: { value: number; max: number };
}) {
  const a = accents[accent];
  const pct =
    progress && progress.max > 0
      ? Math.min(100, Math.max(0, Math.round((progress.value / progress.max) * 100)))
      : 0;
  const icon = Icon && (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${a.box}`}>
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
  const bar = progress && (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={progress.max}
      aria-valuenow={progress.value}
      className="h-1.5 w-full overflow-hidden rounded-full bg-text-muted/15"
    >
      <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${pct}%` }} />
    </div>
  );

  if (variant === 'stacked') {
    return (
      <div
        data-variant="stacked"
        className="flex flex-col items-center gap-2 rounded-card bg-surface p-5 text-center shadow-sm"
      >
        {icon}
        <span className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
          {label}
        </span>
        <span className="text-3xl font-bold text-text">{value}</span>
        {bar}
      </div>
    );
  }
  return (
    <div
      data-variant="inline"
      className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm"
    >
      <div className="flex items-center gap-4">
        {icon}
        <div className="flex flex-col">
          <span className="text-2xl leading-tight font-bold text-text">{value}</span>
          <span className="text-sm text-text-muted">{label}</span>
        </div>
      </div>
      {bar}
    </div>
  );
}
