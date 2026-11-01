import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Thẻ đầu trang: ô icon, tiêu đề lớn, phụ đề một dòng và nút hành động ở bên phải. */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 rounded-card bg-surface p-5 shadow-sm">
      {Icon && (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-2xl font-bold text-text">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
