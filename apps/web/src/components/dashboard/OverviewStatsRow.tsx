import { useAcademyStats, useClassrooms, useTournaments } from '@erpchess/api/react';
import { calendarRange } from '@erpchess/domain';
import { CalendarDays, GraduationCap, Swords, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { ErrorText, Spinner, StatCard } from '../ui';

/** 4 thẻ số liệu: học viên, lớp trong tháng, giải đấu, lượt làm bài 7 ngày. */
export function OverviewStatsRow() {
  const { t } = useT();
  const { academy } = useAcademy();
  const stats = useAcademyStats(academy.id);
  const month = useMemo(() => calendarRange('month'), []);
  const classes = useClassrooms(academy.id, month);
  const tournaments = useTournaments(academy.id);
  if (stats.isPending) return <Spinner />;
  if (stats.error) return <ErrorText error={stats.error} />;
  if (!stats.data) return null;
  const list = tournaments.data ?? [];
  const count = (status: string) => list.filter((x) => x.status === status).length;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        variant="stacked"
        accent="blue"
        icon={GraduationCap}
        label={t('overview.statStudents')}
        value={stats.data.students}
        hint={t('overview.statStudentsHint', { count: stats.data.staff })}
      />
      <StatCard
        variant="stacked"
        accent="green"
        icon={CalendarDays}
        label={t('overview.statClasses')}
        value={classes.data?.length ?? '—'}
      />
      <StatCard
        variant="stacked"
        accent="orange"
        icon={Trophy}
        label={t('overview.statTournaments')}
        value={tournaments.data ? list.length : '—'}
        hint={t('overview.statTournamentsHint', {
          active: count('active'),
          upcoming: count('upcoming'),
          finished: count('finished'),
        })}
      />
      <StatCard
        variant="stacked"
        accent="purple"
        icon={Swords}
        label={t('overview.statAttempts')}
        value={stats.data.attemptsWeek}
      />
    </div>
  );
}
