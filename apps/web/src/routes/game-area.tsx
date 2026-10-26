import { useMyAcademies } from '@erpchess/api/react';
import type { Session } from '@supabase/supabase-js';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { RequireSession } from '../components/RequireSession';
import { Spinner } from '../components/ui';

export const Route = createFileRoute('/game-area')({
  component: () => (
    <RequireSession>{(session) => <GameAreaRedirect session={session} />}</RequireSession>
  ),
});

function GameAreaRedirect({ session }: { session: Session }) {
  const navigate = useNavigate();
  const academies = useMyAcademies(session.user.id);

  useEffect(() => {
    if (academies.isPending) return;

    if (academies.data && academies.data.length > 0) {
      const first = academies.data[0];
      if (first) {
        void navigate({
          to: '/a/$slug/play',
          params: { slug: first.slug },
          replace: true,
        });
        return;
      }
    }

    void navigate({ to: '/', replace: true });
  }, [academies.isPending, academies.data, navigate]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
