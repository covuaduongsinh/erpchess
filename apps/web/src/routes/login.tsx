import { signInStudent, signInWithEmail } from '@erpchess/api';
import { useErpClient } from '@erpchess/api/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { useT } from '../lib/use-t';

type Search = { redirect?: string };

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === 'string' && s.redirect.startsWith('/') ? s.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useT();
  const client = useErpClient();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<'email' | 'student'>('email');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    try {
      if (mode === 'email') {
        await signInWithEmail(client, String(form.get('email')), String(form.get('password')));
      } else {
        await signInStudent(client, String(form.get('username')), String(form.get('pin')));
      }
      await navigate({ to: redirect ?? '/' });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card title={t('auth.signIn')}>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md bg-bg p-1 text-sm">
          {(['email', 'student'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className="rounded-sm py-2 aria-selected:bg-white aria-selected:font-medium aria-selected:shadow-sm"
            >
              {m === 'email' ? t('auth.tabEmail') : t('auth.tabStudent')}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {mode === 'email' ? (
            <>
              <Field
                label={t('auth.email')}
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <Field
                label={t('auth.password')}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </>
          ) : (
            <>
              <Field
                label={t('auth.username')}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                required
              />
              <Field
                label={t('auth.pin')}
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                required
              />
            </>
          )}
          <ErrorText error={error} />
          <Button type="submit" disabled={pending}>
            {t('auth.signIn')}
          </Button>
        </form>
        {mode === 'email' && (
          <p className="text-sm text-text-muted">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" search={{ redirect }} className="font-medium text-primary">
              {t('auth.signUp')}
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}
