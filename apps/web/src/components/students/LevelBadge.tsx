import { Award } from 'lucide-react';

export interface LevelBadgeProps {
  name?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface LevelPreset {
  badgeClass: string;
  borderClass: string;
}

function getLevelPreset(name?: string | null): LevelPreset {
  if (!name) {
    return {
      badgeClass: 'bg-bg text-text',
      borderClass: 'border-border',
    };
  }

  const lower = name.toLowerCase();

  if (lower.includes('gold') || lower.includes('kiwi') || lower.includes('vàng')) {
    return {
      badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
      borderClass: 'border-amber-300 ring-1 ring-amber-200',
    };
  }

  if (lower.includes('silver') || lower.includes('bạc') || lower.includes('knight')) {
    return {
      badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-200',
      borderClass: 'border-slate-300',
    };
  }

  if (lower.includes('bronze') || lower.includes('đồng') || lower.includes('pawn')) {
    return {
      badgeClass: 'bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200',
      borderClass: 'border-orange-200',
    };
  }

  if (lower.includes('master') || lower.includes('kiện tướng') || lower.includes('đội tuyển')) {
    return {
      badgeClass: 'bg-purple-50 text-purple-800 dark:bg-purple-500/15 dark:text-purple-200',
      borderClass: 'border-purple-300 ring-1 ring-purple-200',
    };
  }

  if (lower.includes('nâng cao') || lower.includes('advanced')) {
    return {
      badgeClass: 'bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200',
      borderClass: 'border-blue-200',
    };
  }

  return {
    badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
    borderClass: 'border-emerald-200',
  };
}

export function LevelBadge({ name, className = '', size = 'md' }: LevelBadgeProps) {
  const { badgeClass, borderClass } = getLevelPreset(name);

  const sizeClasses = {
    sm: 'text-2xs px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-2xs whitespace-nowrap transition-transform hover:scale-105 ${badgeClass} ${borderClass} ${sizeClasses} ${className}`}
      title={name ? `Cấp độ: ${name}` : 'Chưa phân cấp'}
    >
      <Award aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{name || 'Chưa phân cấp'}</span>
    </span>
  );
}
