import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-sm ${className}`}>
      {title && <h2 className="text-lg font-bold text-primary">{title}</h2>}
      {children}
    </section>
  );
}
