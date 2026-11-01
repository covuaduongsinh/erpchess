import {
  useAcademyStats,
  useClassrooms,
  useLeaderboard,
  useMembers,
  useStudentXp,
  useTournaments,
  useXpLeaderboard,
} from '@erpchess/api/react';
import {
  academyRoles,
  calendarRange,
  isStaff,
  type Period,
  periodRange,
  periods,
  streakFrom,
  vnToday,
} from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Radio,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { AcademyContactCard } from '../components/academy/BrandingCard';
import { LeaderboardPodium } from '../components/dashboard/LeaderboardPodium';
import { QuickSessionModal } from '../components/dashboard/QuickSessionModal';
import { WeeklyStatsPanel } from '../components/dashboard/WeeklyStatsPanel';
import { Card, EmptyState, ErrorText, PageHeader, Spinner, StatCard, Tabs } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/')({
  component: OverviewPage,
});

function OverviewPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const [quickSessionOpen, setQuickSessionOpen] = useState(false);
  const [tab, setTab] = useState<'stats' | 'sessions'>('stats');
  const members = useMembers(academy.id);

  const coaches = useMemo(() => {
    return (members.data ?? [])
      .filter((m) => m.role === 'coach' || m.role === 'owner')
      .map((m) => ({
        id: m.profile.id,
        name: m.profile.display_name || m.profile.username || t('role.coach'),
      }));
  }, [members.data, t]);

  const userName = String(session.user.user_metadata?.display_name ?? '').trim();
  const greeting = userName ? t('overview.greeting', { name: userName }) : '';
  const subtitle = [greeting, staff ? t('overview.greetingStaff') : t('overview.greetingMember')]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={t('overview.title', { name: academy.name })}
        subtitle={subtitle}
      />
      {academy.description && (
        <p className="whitespace-pre-line text-sm text-text-muted">{academy.description}</p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {staff && <QuickActionsRow onOpenQuickSession={() => setQuickSessionOpen(true)} />}
          {staff && <StatsRow />}
          {staff ? (
            <>
              <Tabs
                variant="pills"
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'stats', label: t('overview.tabStats'), icon: Users },
                  { value: 'sessions', label: t('overview.tabSessions'), icon: Radio },
                ]}
              />
              {tab === 'stats' ? (
                <>
                  <WeeklyStatsPanel academyId={academy.id} />
                  <AcademyColumn />
                </>
              ) : (
                <OngoingSessionsCard />
              )}
            </>
          ) : (
            <>
              <UpcomingClassesCard />
              <XpCard />
              <AcademyContactCard />
            </>
          )}
        </div>
        <LeaderboardCard />
      </div>

      {staff && (
        <QuickSessionModal
          open={quickSessionOpen}
          onClose={() => setQuickSessionOpen(false)}
          academyId={academy.id}
          slug={academy.slug}
          userId={session.user.id}
          coaches={coaches}
        />
      )}
    </>
  );
}

/** Nội dung tab "Thống kê học viện": lịch sắp tới, XP, thành viên và liên hệ. */
function AcademyColumn() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <UpcomingClassesCard />
      <XpCard />
      <MembersCard />
      <AcademyContactCard />
    </div>
  );
}

const cardBase =
  'flex items-start gap-4 rounded-card p-5 text-left shadow-sm transition-shadow hover:shadow-md';

function QuickCardBody({
  icon: Icon,
  title,
  desc,
  primary,
}: {
  icon: typeof Trophy;
  title: string;
  desc: string;
  primary: boolean;
}) {
  return (
    <>
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
          primary ? 'bg-white/20' : 'bg-primary-soft text-primary'
        }`}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="font-bold">{title}</span>
        <span className={`text-sm ${primary ? 'opacity-80' : 'text-text-muted'}`}>{desc}</span>
      </span>
    </>
  );
}

/** Thao tác nhanh: 3 thẻ lớn, thẻ đầu tô màu chính. */
function QuickActionsRow({ onOpenQuickSession }: { onOpenQuickSession: () => void }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const slug = academy.slug;
  const primary = `${cardBase} bg-primary text-text-on-primary`;
  const plain = `${cardBase} bg-surface text-text`;
  return (
    <section className="flex flex-col gap-2" aria-label={t('overview.quickActions')}>
      <h2 className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
        {t('overview.quickActions')}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link to="/a/$slug/tournaments/new" params={{ slug }} className={primary}>
          <QuickCardBody
            icon={Trophy}
            title={t('overview.qaTournament')}
            desc={t('overview.qaTournamentDesc')}
            primary
          />
        </Link>
        <Link to="/a/$slug/students" params={{ slug }} className={plain}>
          <QuickCardBody
            icon={GraduationCap}
            title={t('overview.qaStudents')}
            desc={t('overview.qaStudentsDesc')}
            primary={false}
          />
        </Link>
        <button type="button" onClick={onOpenQuickSession} className={plain}>
          <QuickCardBody
            icon={Swords}
            title={t('overview.qaClass')}
            desc={t('overview.qaClassDesc')}
            primary={false}
          />
        </button>
      </div>
    </section>
  );
}

/** 4 thẻ số liệu: học viên, lớp trong tháng, giải đấu, lượt làm bài 7 ngày. */
function StatsRow() {
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

function UpcomingClassesCard() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const slug = academy.slug;
  // Mốc thời gian cố định theo lần mở trang để khoá truy vấn không đổi mỗi lần render
  const range = useMemo(() => {
    const now = new Date();
    return { from: now, to: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
  }, []);
  const classes = useClassrooms(academy.id, range);
  const list = classes.data ?? [];

  return (
    <Card title={t('overview.upcoming')}>
      {classes.isPending ? (
        <Spinner />
      ) : classes.error ? (
        <ErrorText error={classes.error} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t('overview.upcomingEmpty')}
          action={
            isStaff(academy.role) ? (
              <Link
                to="/a/$slug/classes"
                params={{ slug }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('overview.upcomingCreate')} →
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.slice(0, 5).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-primary-soft/40 p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{c.title}</span>
                <span className="text-xs text-text-muted">
                  {formatDateTime(c.starts_at, i18n.language)} ·{' '}
                  {c.kind === 'online' ? t('overview.online') : t('overview.onsite')}
                </span>
              </div>
              {c.kind === 'online' ? (
                <Link
                  to="/a/$slug/classes/$id/room"
                  params={{ slug, id: c.id }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-text-on-primary hover:opacity-90"
                >
                  {t('overview.joinClass')}
                </Link>
              ) : (
                <Link
                  to="/a/$slug/classes"
                  params={{ slug }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-primary-soft"
                >
                  {t('overview.details')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Tab "Buổi học đang diễn ra": buổi hôm nay đã bắt đầu, chưa kết thúc và chưa hết giờ. */
function OngoingSessionsCard() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const slug = academy.slug;
  const range = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
  }, []);
  const classes = useClassrooms(academy.id, range);
  const now = Date.now();
  const live = (classes.data ?? []).filter((c) => {
    const start = new Date(c.starts_at).getTime();
    return !c.ended_at && start <= now && now < start + c.minutes * 60_000;
  });
  return (
    <Card title={t('overview.tabSessions')}>
      {classes.isPending ? (
        <Spinner />
      ) : classes.error ? (
        <ErrorText error={classes.error} />
      ) : live.length === 0 ? (
        <EmptyState
          icon={Radio}
          dashed
          title={t('overview.ongoingEmpty')}
          description={t('overview.ongoingEmptyDesc')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {live.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{c.title}</span>
                <span className="text-xs text-text-muted">
                  {formatDateTime(c.starts_at, i18n.language)}
                </span>
              </div>
              <Link
                to="/a/$slug/classes/$id/room"
                params={{ slug, id: c.id }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-text-on-primary hover:opacity-90"
              >
                {t('overview.joinClass')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const PERIOD_LABEL: Record<Period, TranslationKey> = {
  week: 'dashboard.week',
  month: 'dashboard.month',
  sixMonths: 'dashboard.sixMonths',
};

/** Cột phải: bảng xếp hạng có bục podium top 3 và danh sách hạng 4 trở đi. */
function LeaderboardCard(): ReactNode {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const [period, setPeriod] = useState<Period>('week');
  // Tính một lần cho mỗi lựa chọn để khoá truy vấn ổn định giữa các lần render
  const { from, to } = useMemo(() => periodRange(period), [period]);
  const board = useLeaderboard(academy.id, from, to);
  const ranked = board.data?.filter((r) => r.points > 0) ?? [];

  return (
    <Card title={t('dashboard.leaderboard')}>
      <Tabs
        variant="pills"
        ariaLabel={t('overview.leaderboardPeriods')}
        value={period}
        onChange={setPeriod}
        items={periods.map((p) => ({ value: p, label: t(PERIOD_LABEL[p]) }))}
      />
      {board.isPending ? (
        <Spinner />
      ) : board.error ? (
        <ErrorText error={board.error} />
      ) : ranked.length === 0 ? (
        <EmptyState icon={Trophy} title={t('dashboard.empty')} />
      ) : (
        <LeaderboardPodium rows={ranked} currentUserId={session.user.id} />
      )}
      <p className="text-xs text-text-muted">{t('dashboard.rule')}</p>
    </Card>
  );
}

function MembersCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  return (
    <Card title={t('academy.members')}>
      {members.isPending ? (
        <Spinner />
      ) : members.error ? (
        <ErrorText error={members.error} />
      ) : (
        <dl className="flex flex-col gap-3">
          {academyRoles.map((role) => {
            const list = members.data.filter((m) => m.role === role);
            if (list.length === 0) return null;
            return (
              <div key={role}>
                <dt className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
                  {t(`role.${role}`)} ({list.length})
                </dt>
                <dd>
                  {list.map((m) => (
                    <p key={m.profile.id}>
                      {m.profile.display_name}
                      {m.profile.username && (
                        <span className="text-text-muted"> · @{m.profile.username}</span>
                      )}
                    </p>
                  ))}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </Card>
  );
}

/** Học viên: XP của mình và chuỗi ngày học; staff: bảng XP của học viện. */
function XpCard() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const student = academy.role === 'student';
  const mine = useStudentXp(student ? session.user.id : undefined, academy.id);
  const board = useXpLeaderboard(student ? undefined : academy.id, {});
  if (student) {
    if (mine.isPending) return <Spinner />;
    if (mine.error) return <ErrorText error={mine.error} />;
    const xp = mine.data;
    const streak = streakFrom(xp.days, vnToday());
    const missing = xp.nextLevelXp !== null ? xp.nextLevelXp - xp.total : null;
    return (
      <Card title={t('xp.title')}>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-text-muted">{t('xp.today')}</dt>
            <dd className="text-2xl font-bold text-orange">+{xp.today}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t('xp.total')}</dt>
            <dd className="text-2xl font-bold text-primary">{xp.total}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t('xp.streak')}</dt>
            <dd className="text-2xl font-bold text-primary">
              🔥 {t('xp.days', { count: streak.current })}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-text-muted">{t('xp.longest', { count: streak.longest })}</p>
        {xp.nextLevel && missing !== null && (
          <p className="text-sm">
            {missing > 0
              ? t('xp.nextLevel', { xp: missing, level: xp.nextLevel })
              : t('xp.reachedLevel', { level: xp.nextLevel })}
          </p>
        )}
        <p className="text-xs text-text-muted">{t('xp.rule')}</p>
      </Card>
    );
  }
  const ranked = (board.data ?? []).filter((r) => r.xp > 0);
  return (
    <Card title={t('xp.leaderboard')}>
      {board.isPending ? (
        <Spinner />
      ) : board.error ? (
        <ErrorText error={board.error} />
      ) : ranked.length === 0 ? (
        <p className="text-text-muted">{t('xp.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {ranked.slice(0, 10).map((r, i) => (
            <li key={r.studentId} className="flex items-center gap-3 px-3 py-1">
              <span className="w-6 text-sm text-text-muted">{i + 1}</span>
              <span className="flex-1 font-medium">{r.displayName}</span>
              <span className="font-bold text-primary">{r.xp} XP</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-text-muted">{t('xp.rule')}</p>
    </Card>
  );
}
