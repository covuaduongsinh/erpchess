import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { RequireSession } from '../components/RequireSession';
import { Spinner } from '../components/ui';

export const Route = createFileRoute('/preferences')({
  component: () => <RequireSession>{() => <PreferencesRedirect />}</RequireSession>,
});

function PreferencesRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: '/profile', replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
