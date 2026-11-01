import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

/** Nút chỉ có icon: `label` vừa là tên truy cập (aria-label) vừa là tooltip (title). */
export function IconButton({
  icon: Icon,
  label,
  className = '',
  ...props
}: Omit<ComponentProps<'button'>, 'children' | 'title' | 'aria-label'> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-primary-soft hover:text-primary disabled:opacity-50 ${className}`}
      {...props}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
