import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

export type ButtonVariant = 'primary' | 'cta' | 'ghost' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-text-on-primary hover:opacity-90',
  cta: 'bg-orange text-white hover:bg-orange-hover',
  ghost: 'text-primary hover:bg-primary/10',
  secondary: 'border border-border bg-surface text-text hover:bg-primary-soft',
  danger: 'bg-danger text-white hover:opacity-90',
};

// `md` giữ nguyên kích thước nút cũ để không đổi các trang đang dùng.
const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2',
  lg: 'px-5 py-3 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
