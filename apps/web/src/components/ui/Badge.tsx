import type { ReactNode } from 'react';

export type BadgeTone = 'new' | 'success' | 'warn' | 'muted';

const tones: Record<BadgeTone, string> = {
  new: 'bg-orange text-white',
  success: 'bg-green/15 text-green',
  warn: 'bg-yellow/25 text-orange-hover',
  muted: 'bg-text-muted/15 text-text-muted',
};

export function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
