import type { ComponentProps, ReactNode } from 'react';
import { ZodError } from 'zod';
import { useT, validationKey } from '../lib/use-t';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'cta' | 'ghost' }) {
  const styles = {
    primary: 'bg-primary text-text-on-primary hover:opacity-90',
    cta: 'bg-orange text-white hover:bg-orange-hover',
    ghost: 'text-primary hover:bg-primary/10',
  }[variant];
  return (
    <button
      type="button"
      className={`rounded-md px-4 py-2 font-medium disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base outline-primary"
        {...props}
      />
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-sm">
      {title && <h2 className="text-lg font-bold text-primary">{title}</h2>}
      {children}
    </section>
  );
}

/** Hiển thị lỗi: lỗi validate được dịch theo trường, lỗi khác hiện nguyên thông điệp. */
export function ErrorText({ error }: { error: unknown }) {
  const { t } = useT();
  if (!error) return null;
  let message: string;
  if (error instanceof ZodError) {
    const key = validationKey(error.issues[0]?.message ?? '');
    message = key ? t(key) : error.message;
  } else if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    if (code === 'username_taken') message = t('students.usernameTaken');
    else if (code === 'lichess_not_found') message = t('database.lichessNotFound');
    else if (code === 'lichess_unreachable' || code === 'lichess_error')
      message = t('database.lichessUnavailable');
    else if (code === '23505') message = t('academy.slugTaken');
    else if (/invalid login credentials/i.test(error.message))
      message = t('auth.invalidCredentials');
    else message = t('common.error', { message: error.message });
  } else {
    message = String(error);
  }
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export function Spinner() {
  const { t } = useT();
  return <p className="text-text-muted">{t('common.loading')}</p>;
}
