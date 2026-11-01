import { isStaff } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { School } from 'lucide-react';
import { CoachesList, InviteCoachCard } from '../components/academy/CoachesPanel';
import { Card, PageHeader } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/coaches')({
  component: CoachesPage,
});

function CoachesPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  if (!isStaff(academy.role)) return <p className="text-text-muted">{t('coaches.staffOnly')}</p>;
  return (
    <>
      <PageHeader icon={School} title={t('coaches.title')} subtitle={t('coaches.subtitle')} />
      <Card>
        <CoachesList />
      </Card>
      {academy.role === 'owner' && <InviteCoachCard />}
    </>
  );
}
