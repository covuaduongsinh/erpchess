import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '../components/auth/LoginForm';

type Search = { redirect?: string };

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === 'string' && s.redirect.startsWith('/') ? s.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return (
    <div className="mx-auto w-full max-w-md">
      <LoginForm redirect={redirect} />
    </div>
  );
}
