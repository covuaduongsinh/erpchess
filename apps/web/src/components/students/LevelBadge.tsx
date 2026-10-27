export interface LevelBadgeProps {
  name?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface LevelPreset {
  icon: string;
  badgeClass: string;
  borderClass: string;
}

function getLevelPreset(name?: string | null): LevelPreset {
  if (!name) {
    return {
      icon: '♟️',
      badgeClass: 'bg-gray-100 text-gray-600',
      borderClass: 'border-gray-200',
    };
  }

  const lower = name.toLowerCase();

  if (lower.includes('gold') || lower.includes('kiwi') || lower.includes('vàng')) {
    return {
      icon: '🥝',
      badgeClass: 'bg-amber-50 text-amber-800',
      borderClass: 'border-amber-300 ring-1 ring-amber-200',
    };
  }

  if (lower.includes('silver') || lower.includes('bạc') || lower.includes('knight')) {
    return {
      icon: '🛡️',
      badgeClass: 'bg-slate-100 text-slate-800',
      borderClass: 'border-slate-300',
    };
  }

  if (lower.includes('bronze') || lower.includes('đồng') || lower.includes('pawn')) {
    return {
      icon: '⚔️',
      badgeClass: 'bg-orange-50 text-orange-800',
      borderClass: 'border-orange-200',
    };
  }

  if (lower.includes('master') || lower.includes('kiện tướng') || lower.includes('đội tuyển')) {
    return {
      icon: '👑',
      badgeClass: 'bg-purple-50 text-purple-800',
      borderClass: 'border-purple-300 ring-1 ring-purple-200',
    };
  }

  if (lower.includes('nâng cao') || lower.includes('advanced')) {
    return {
      icon: '⭐',
      badgeClass: 'bg-blue-50 text-blue-800',
      borderClass: 'border-blue-200',
    };
  }

  return {
    icon: '🎯',
    badgeClass: 'bg-emerald-50 text-emerald-800',
    borderClass: 'border-emerald-200',
  };
}

export function LevelBadge({ name, className = '', size = 'md' }: LevelBadgeProps) {
  const { icon, badgeClass, borderClass } = getLevelPreset(name);

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
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span>{name || 'Chưa phân cấp'}</span>
    </span>
  );
}
