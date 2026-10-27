import {
  useAcademyStats,
  useClassrooms,
  useCreateInvitation,
  useLeaderboard,
  useMembers,
  useStudentXp,
  useUpdateAcademyProfile,
  useXpLeaderboard,
} from '@erpchess/api/react';
import {
  academyRoles,
  isStaff,
  type Period,
  periodRange,
  periods,
  socialKeys,
  streakFrom,
  vnToday,
} from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { QuickSessionModal } from '../components/dashboard/QuickSessionModal';
import { WeeklyActivityChart } from '../components/dashboard/WeeklyActivityChart';
import { InviteLink } from '../components/InviteLink';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/')({
  component: OverviewPage,
});

function OverviewPage() {
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const [quickSessionOpen, setQuickSessionOpen] = useState(false);
  const members = useMembers(academy.id);

  const coaches = useMemo(() => {
    return (members.data ?? [])
      .filter((m) => m.role === 'coach' || m.role === 'owner')
      .map((m) => ({
        id: m.profile.id,
        name: m.profile.display_name || m.profile.username || 'Huấn luyện viên',
      }));
  }, [members.data]);

  return (
    <div className="flex flex-col gap-6">
      {academy.description && (
        <p className="whitespace-pre-line text-sm text-text-muted">{academy.description}</p>
      )}
      {staff && <QuickActionsRow onOpenQuickSession={() => setQuickSessionOpen(true)} />}
      {staff && <StatsRow />}
      {staff && <WeeklyActivityChart />}
      <div className="grid gap-6 md:grid-cols-2">
        <UpcomingClassesCard />
        <XpCard />
        <LeaderboardCard />
        <MembersCard />
        {academy.role === 'owner' && <InviteCoachCard />}
        {academy.role === 'owner' && <BrandingCard />}
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
    </div>
  );
}

type QuickAction =
  | {
      title: string;
      desc: string;
      icon: string;
      onClick: () => void;
      color: string;
    }
  | {
      title: string;
      desc: string;
      icon: string;
      to: string;
      color: string;
    };

function QuickActionsRow({ onOpenQuickSession }: { onOpenQuickSession: () => void }) {
  const { academy } = useAcademy();
  const slug = academy.slug;

  const actions: QuickAction[] = [
    {
      title: 'Tạo lớp học',
      desc: 'Mở nhanh phòng học trực tuyến LiveKit',
      icon: '🏫',
      onClick: onOpenQuickSession,
      color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 cursor-pointer',
    },
    {
      title: 'Giao bài tập',
      desc: 'Giao thế cờ từ kho học liệu cho học viên',
      icon: '📝',
      to: '/a/$slug/assignments/new',
      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    },
    {
      title: 'Tổ chức giải đấu',
      desc: 'Tạo giải đấu Swiss, Quad hoặc vòng tròn',
      icon: '🏆',
      to: '/a/$slug/tournaments/new',
      color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200',
    },
    {
      title: 'Quản lý học viên',
      desc: 'Thêm học viên, chia lớp hoặc nhập CSV',
      icon: '👥',
      to: '/a/$slug/students',
      color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200',
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
        Thao tác nhanh
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((act) =>
          'onClick' in act ? (
            <button
              key={act.title}
              type="button"
              onClick={act.onClick}
              className={`flex items-start text-left gap-3 rounded-xl border p-4 shadow-xs transition-all hover:shadow-md ${act.color}`}
            >
              <span className="text-2xl" aria-hidden="true">
                {act.icon}
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-sm">{act.title}</span>
                <span className="text-xs opacity-80">{act.desc}</span>
              </div>
            </button>
          ) : (
            <Link
              key={act.title}
              to={act.to}
              params={{ slug }}
              className={`flex items-start gap-3 rounded-xl border p-4 shadow-xs transition-all hover:shadow-md ${act.color}`}
            >
              <span className="text-2xl" aria-hidden="true">
                {act.icon}
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-sm">{act.title}</span>
                <span className="text-xs opacity-80">{act.desc}</span>
              </div>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

function UpcomingClassesCard() {
  const { i18n } = useT();
  const { academy } = useAcademy();
  const slug = academy.slug;

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const classes = useClassrooms(academy.id, { from: now, to: nextWeek });

  const list = classes.data ?? [];

  return (
    <Card title="Lịch học sắp tới">
      {classes.isPending ? (
        <Spinner />
      ) : classes.error ? (
        <ErrorText error={classes.error} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center text-text-muted">
          <span className="text-3xl mb-2" aria-hidden="true">
            📅
          </span>
          <p className="text-sm">Không có lớp học nào sắp diễn ra trong 7 ngày tới.</p>
          <Link
            to="/a/$slug/classes"
            params={{ slug }}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            Tạo buổi học mới →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.slice(0, 5).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-gray-900">{c.title}</span>
                <span className="text-xs text-text-muted">
                  {formatDateTime(c.starts_at, i18n.language)} ·{' '}
                  {c.kind === 'online' ? '🌐 Trực tuyến' : '🏫 Trực tiếp'}
                </span>
              </div>
              {c.kind === 'online' ? (
                <Link
                  to="/a/$slug/classes/$id/room"
                  params={{ slug, id: c.id }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Vào lớp
                </Link>
              ) : (
                <Link
                  to="/a/$slug/classes"
                  params={{ slug }}
                  className="rounded-md bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300"
                >
                  Chi tiết
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatsRow() {
  const { t } = useT();
  const { academy } = useAcademy();
  const stats = useAcademyStats(academy.id);
  if (stats.isPending) return <Spinner />;
  if (stats.error) return <ErrorText error={stats.error} />;
  if (!stats.data) return null;
  const items: [TranslationKey, number][] = [
    ['dashboard.students', stats.data.students],
    ['dashboard.staff', stats.data.staff],
    ['dashboard.groups', stats.data.groups],
    ['dashboard.batches', stats.data.batches],
    ['dashboard.assignments', stats.data.assignments],
    ['dashboard.attemptsWeek', stats.data.attemptsWeek],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1 rounded-lg bg-white p-4 shadow-sm">
          <dt className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
            {t(key)}
          </dt>
          <dd className="text-2xl font-bold text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const PERIOD_LABEL: Record<Period, TranslationKey> = {
  week: 'dashboard.week',
  month: 'dashboard.month',
  sixMonths: 'dashboard.sixMonths',
};

function LeaderboardCard() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const [period, setPeriod] = useState<Period>('week');
  // Tính một lần cho mỗi lựa chọn để khoá truy vấn ổn định giữa các lần render
  const { from, to } = useMemo(() => periodRange(period), [period]);
  const board = useLeaderboard(academy.id, from, to);
  const ranked = board.data?.filter((r) => r.points > 0) ?? [];

  return (
    <Card title={t('dashboard.leaderboard')}>
      <div role="tablist" className="flex gap-1">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className="rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary"
          >
            {t(PERIOD_LABEL[p])}
          </button>
        ))}
      </div>
      {board.isPending ? (
        <Spinner />
      ) : board.error ? (
        <ErrorText error={board.error} />
      ) : ranked.length === 0 ? (
        <p className="text-text-muted">{t('dashboard.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {ranked.slice(0, 10).map((row, i) => (
            <li
              key={row.studentId}
              className={`flex items-center gap-3 rounded-md px-3 py-2 ${
                row.studentId === session.user.id ? 'bg-yellow/20' : ''
              }`}
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${
                  i < 3 ? 'bg-orange text-white' : 'bg-bg text-text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 font-medium">{row.displayName}</span>
              <span className="text-sm text-text-muted">
                {t('dashboard.solved', { count: row.solved })}
              </span>
              <span className="w-20 text-right font-bold text-primary">
                {t('dashboard.points', { count: row.points })}
              </span>
            </li>
          ))}
        </ol>
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

function InviteCoachCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const invite = useCreateInvitation(academy.id);
  return (
    <Card title={t('academy.inviteCoach')}>
      <Button
        variant="cta"
        className="self-start"
        disabled={invite.isPending}
        onClick={() => invite.mutate({ role: 'coach' })}
      >
        {t('academy.inviteCoach')}
      </Button>
      <ErrorText error={invite.error} />
      {invite.data && <InviteLink token={invite.data.token} />}
    </Card>
  );
}

function BrandingCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const update = useUpdateAcademyProfile(academy.id);
  const socials = (academy.socials ?? {}) as Partial<Record<(typeof socialKeys)[number], string>>;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    update.mutate({
      name: text('name'),
      description: text('description'),
      logoUrl: text('logoUrl'),
      socials: Object.fromEntries(socialKeys.map((k) => [k, text(k)])),
    });
  }

  return (
    <Card title={t('branding.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('academy.name')} name="name" defaultValue={academy.name} required />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('branding.description')}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={academy.description}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base"
          />
        </label>
        <Field
          label={t('branding.logoUrl')}
          name="logoUrl"
          type="url"
          defaultValue={academy.logo_url ?? ''}
        />
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">{t('branding.socials')}</legend>
          {socialKeys.map((k) => (
            <Field
              key={k}
              label={t(`branding.${k}`)}
              name={k}
              type="url"
              defaultValue={socials[k] ?? ''}
            />
          ))}
        </fieldset>
        <ErrorText error={update.error} />
        {update.isSuccess && (
          <p role="status" className="text-sm text-green">
            {t('branding.saved')}
          </p>
        )}
        <Button type="submit" variant="cta" className="self-start" disabled={update.isPending}>
          {t('common.save')}
        </Button>
      </form>
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
