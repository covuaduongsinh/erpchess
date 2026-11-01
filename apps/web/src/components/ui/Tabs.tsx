import type { LucideIcon } from 'lucide-react';
import { type KeyboardEvent, useRef } from 'react';
import { Badge } from './Badge';

export type TabItem<V extends string> = {
  value: V;
  label: string;
  icon?: LucideIcon;
  /** Huy hiệu chữ (vd. "Mới"), dùng cho kiểu gạch chân. */
  badge?: string;
  /** Số đếm, dùng cho kiểu viên thuốc. */
  count?: number;
};

/**
 * Tab điều khiển bằng `value`/`onChange`. `underline`: gạch chân có icon và huy hiệu;
 * `pills`: nút nhóm dạng viên thuốc có số đếm. Bàn phím: ←/→ chuyển (vòng tròn), Home/End.
 */
export function Tabs<V extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  ariaLabel,
}: {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  variant?: 'underline' | 'pills';
  ariaLabel?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent) {
    const index = items.findIndex((i) => i.value === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = items[next];
    if (!target) return;
    onChange(target.value);
    refs.current[target.value]?.focus();
  }

  const list =
    variant === 'underline'
      ? 'flex gap-1 border-b border-border'
      : 'inline-flex flex-wrap gap-1 rounded-full bg-text-muted/10 p-1';
  const tab =
    variant === 'underline'
      ? '-mb-px flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-text-muted hover:text-text aria-selected:border-primary aria-selected:font-medium aria-selected:text-primary'
      : 'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-text-muted hover:text-text aria-selected:bg-primary aria-selected:font-medium aria-selected:text-text-on-primary';

  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className={list}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[item.value] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={tab}
          >
            {item.icon && <item.icon className="size-4 shrink-0" aria-hidden="true" />}
            {item.label}
            {item.badge && <Badge tone="new">{item.badge}</Badge>}
            {variant === 'pills' && item.count !== undefined && (
              <span className="rounded-full bg-text-muted/15 px-1.5 text-xs">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
