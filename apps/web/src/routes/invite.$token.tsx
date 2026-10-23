import { useAcceptInvitation, useSession } from '@erpchess/api/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Button, Card, Spinner } from '../components/ui';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
});

function InvitePage() {
  const { t } = useT();
  const { token } = Route.useParams();
  const { session, loading } = useSession();
  const accept = useAcceptInvitation();
  const navigate = useNavigate();
  const here = `/invite/${token}`;

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto w-full max-w-md">
      <Card title={t('invite.title')}>
        {!session ? (
          <>
            <p>{t('invite.signInFirst')}</p>
            <div className="flex gap-3">
              <Link
                to="/login"
                search={{ redirect: here }}
                className="rounded-md bg-primary px-4 py-2 text-white"
              >
                {t('auth.signIn')}
              </Link>
              <Link
                to="/signup"
                search={{ redirect: here }}
                className="rounded-md px-4 py-2 text-primary"
              >
                {t('auth.signUp')}
              </Link>
            </div>
          </>
        ) : (
          <>
            {accept.isError && (
              <p role="alert" className="text-sm text-danger">
                {t('invite.invalid')}
              </p>
            )}
            <Button
              variant="cta"
              disabled={accept.isPending}
              onClick={() => accept.mutate(token, { onSuccess: () => void navigate({ to: '/' }) })}
            >
              {t('invite.accept')}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
