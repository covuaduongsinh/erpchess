import { signUp } from '@erpchess/api';
import { useErpClient } from '@erpchess/api/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { useT } from '../lib/use-t';

type Search = { redirect?: string };

export const Route = createFileRoute('/signup')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === 'string' && s.redirect.startsWith('/') ? s.redirect : undefined,
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const { t } = useT();
  const client = useErpClient();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    setError(null);
    setPending(true);
    try {
      const target = new URL(redirect ?? '/', window.location.origin).href;
      const { session } = await signUp(
        client,
        {
          displayName: String(form.get('displayName')),
          email,
          password: String(form.get('password')),
        },
        target,
      );
      // Project bật xác nhận email thì chưa có session: báo người dùng mở email
      if (session) await navigate({ to: redirect ?? '/' });
      else setSentTo(email);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card title={t('auth.signUp')}>
        {sentTo ? (
          <p role="status">{t('auth.checkEmail', { email: sentTo })}</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label={t('auth.displayName')} name="displayName" autoComplete="name" required />
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
              autoComplete="new-password"
              minLength={8}
              required
            />
            <ErrorText error={error} />
            <Button type="submit" variant="cta" disabled={pending}>
              {t('auth.signUp')}
            </Button>
          </form>
        )}
        <p className="text-sm text-text-muted">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" search={{ redirect }} className="font-medium text-primary">
            {t('auth.signIn')}
          </Link>
        </p>
      </Card>
    </div>
  );
}
