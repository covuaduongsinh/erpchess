import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Trạng thái rỗng căn giữa: icon, tiêu đề, mô tả và nút CTA; `dashed` thêm khung viền nét đứt. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  dashed = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  dashed?: boolean;
}) {
  return (
    <div
      data-dashed={dashed}
      className={`flex flex-col items-center gap-3 rounded-card px-6 py-12 text-center ${
        dashed ? 'border-2 border-dashed border-border' : ''
      }`}
    >
      {Icon && (
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-7" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-lg font-bold text-text">{title}</h3>
      {description && <p className="max-w-md text-sm text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
