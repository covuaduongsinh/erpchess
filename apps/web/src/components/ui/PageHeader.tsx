import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Thẻ đầu trang: ô icon, tiêu đề lớn, phụ đề một dòng và nút hành động ở bên phải. */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Kiểu gọn cho khung hẹp (vd. cột phải trang phân tích). */
  compact?: boolean;
}) {
  return (
    <header
      className={`flex flex-wrap items-center rounded-card bg-surface shadow-sm ${
        compact ? 'gap-3 p-3' : 'gap-4 p-5'
      }`}
    >
      {Icon && (
        <span
          className={`flex shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ${
            compact ? 'size-9' : 'size-12'
          }`}
        >
          <Icon className={compact ? 'size-5' : 'size-6'} aria-hidden="true" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className={`truncate font-bold text-text ${compact ? 'text-lg' : 'text-2xl'}`}>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
