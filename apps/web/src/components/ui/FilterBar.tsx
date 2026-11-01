import { CalendarDays, LayoutGrid, List, Search, Table2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { quickPeriods, quickRange } from '../../lib/quick-range';
import { useT } from '../../lib/use-t';

const control = 'rounded-md border border-border bg-surface px-3 py-2 text-sm outline-primary';

/** Thẻ chứa các điều khiển lọc: tìm kiếm, sắp xếp, khoảng ngày, chip trạng thái, kiểu xem. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 shadow-sm">
      {children}
    </div>
  );
}

/** Ô tìm kiếm có icon kính lúp. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tên truy cập; mặc định lấy theo placeholder. */
  label?: string;
}) {
  const { t } = useT();
  const text = placeholder ?? t('ui.search');
  return (
    <label className="relative flex min-w-48 flex-1 items-center">
      <Search
        className="pointer-events-none absolute left-3 size-4 text-text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label ?? text}
        placeholder={text}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${control} w-full pl-9`}
      />
    </label>
  );
}

/** Ô chọn có nhãn. */
export function SelectField<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className={`${control} text-text`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export type DateRange = { from: string; to: string };

/** Cặp ô Từ ngày / Đến ngày (giá trị `YYYY-MM-DD`, chuỗi rỗng là chưa chọn). */
export function DateRangeFields({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  const { t } = useT();
  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
        {t('ui.from')}
        <input
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className={`${control} text-text`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
        {t('ui.to')}
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className={`${control} text-text`}
        />
      </label>
    </>
  );
}

/** Nút chọn nhanh khoảng ngày: Tháng / Quý / Năm (T/Q/N; M/Q/Y trong tiếng Anh). */
export function PeriodQuickPick({
  onPick,
  now,
}: {
  onPick: (range: DateRange) => void;
  /** Mốc thời gian tính khoảng; mặc định là bây giờ (chỉ để kiểm thử). */
  now?: Date;
}) {
  const { t } = useT();
  const labels = {
    month: { short: t('ui.periodMonth'), title: t('ui.periodMonthTitle') },
    quarter: { short: t('ui.periodQuarter'), title: t('ui.periodQuarterTitle') },
    year: { short: t('ui.periodYear'), title: t('ui.periodYearTitle') },
  } as const;
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 text-xs font-medium text-text-muted">
        {t('ui.periodGroup')}
      </legend>
      <div className="flex overflow-hidden rounded-md border border-border">
        {quickPeriods.map((p) => (
          <button
            key={p}
            type="button"
            title={labels[p].title}
            aria-label={labels[p].title}
            onClick={() => onPick(quickRange(p, now))}
            className="bg-surface px-3 py-2 text-sm font-medium text-text-muted hover:bg-primary-soft hover:text-primary not-first:border-l not-first:border-border"
          >
            {labels[p].short}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Chip trạng thái (Tất cả / Đang diễn ra...): chip đang chọn tô màu chính. */
export function StatusChips<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; count?: number }[];
  value: V;
  onChange: (value: V) => void;
}) {
  const { t } = useT();
  return (
    <fieldset className="m-0 flex flex-wrap gap-1 border-0 p-0">
      <legend className="sr-only">{t('ui.statusGroup')}</legend>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="rounded-full border border-border px-3 py-1 text-sm text-text-muted hover:bg-primary-soft aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 opacity-70">{o.count}</span>}
        </button>
      ))}
    </fieldset>
  );
}

export type ViewMode = 'list' | 'grid' | 'table' | 'calendar';

const viewIcons = { list: List, grid: LayoutGrid, table: Table2, calendar: CalendarDays } as const;

/** Nút chuyển chế độ xem; chỉ truyền `views` mà trang thực sự hỗ trợ để không có nút chết. */
export function ViewToggle({
  value,
  onChange,
  views = ['list', 'grid'],
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  views?: ViewMode[];
}) {
  const { t } = useT();
  const labels = {
    list: t('ui.viewList'),
    grid: t('ui.viewGrid'),
    table: t('ui.viewTable'),
    calendar: t('ui.viewCalendar'),
  } as const;
  return (
    <fieldset className="m-0 flex overflow-hidden rounded-md border border-border p-0">
      <legend className="sr-only">{t('ui.viewGroup')}</legend>
      {views.map((v) => {
        const Icon = viewIcons[v];
        return (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            aria-label={labels[v]}
            title={labels[v]}
            onClick={() => onChange(v)}
            className="bg-surface p-2 text-text-muted hover:bg-primary-soft aria-pressed:bg-primary aria-pressed:text-text-on-primary not-first:border-l not-first:border-border"
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </fieldset>
  );
}
