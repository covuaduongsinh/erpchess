import type { ReportPreset } from '@erpchess/domain';
import { useMemo, useState } from 'react';
import { useT } from '../../lib/use-t';

export type ReportFilter = { from?: string; to?: string };

/** Khoảng ngày của báo cáo (toàn thời gian / tháng / quý / năm / tuỳ chỉnh) và nhãn in trên phiếu. */
export function useReportRange() {
  const { t } = useT();
  const [preset, setPreset] = useState<ReportPreset | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const filter = useMemo<ReportFilter>(() => {
    const now = new Date();
    if (preset === 'all') return {};
    if (preset === 'month') {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to: now.toISOString(),
      };
    }
    if (preset === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        from: new Date(now.getFullYear(), qMonth, 1).toISOString(),
        to: now.toISOString(),
      };
    }
    if (preset === 'year') {
      return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: now.toISOString() };
    }
    return {
      from: customFrom ? new Date(customFrom).toISOString() : undefined,
      to: customTo ? new Date(`${customTo}T23:59:59.999Z`).toISOString() : undefined,
    };
  }, [preset, customFrom, customTo]);

  const periodLabel =
    preset === 'custom'
      ? [customFrom, customTo].filter(Boolean).join(' → ') || undefined
      : {
          all: t('reports.presetAll'),
          month: t('reports.presetMonth'),
          quarter: t('reports.presetQuarter'),
          year: t('reports.presetYear'),
        }[preset];

  return {
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    filter,
    periodLabel,
  };
}

export type ReportRange = ReturnType<typeof useReportRange>;

/** Chọn khoảng ngày: các nút nhanh, và hai ô ngày khi chọn "Tuỳ chỉnh". */
export function ReportRangePicker({ range }: { range: ReportRange }) {
  const { t } = useT();
  const { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo } = range;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-muted">{t('reports.dateRange')}</span>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ['all', t('reports.presetAll')],
            ['month', t('reports.presetMonth')],
            ['quarter', t('reports.presetQuarter')],
            ['year', t('reports.presetYear')],
            ['custom', t('reports.customRange')],
          ] as const
        ).map(([p, label]) => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            onClick={() => setPreset(p)}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted hover:bg-primary-soft aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
          >
            {label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border border-text-muted/30 bg-surface px-2 py-1"
            aria-label={t('reports.fromDate')}
          />
          <span>→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border border-text-muted/30 bg-surface px-2 py-1"
            aria-label={t('reports.toDate')}
          />
        </div>
      )}
    </div>
  );
}
