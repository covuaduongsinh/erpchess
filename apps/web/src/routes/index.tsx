import { useSession } from '@erpchess/api/react';
import { createFileRoute } from '@tanstack/react-router';
import { AcademyList } from '../components/AcademyList';
import { Home } from '../components/Home';
import { Spinner } from '../components/ui';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const { session, loading } = useSession();
  if (loading) return <Spinner />;
  return session ? <AcademyList session={session} /> : <Home />;
}
