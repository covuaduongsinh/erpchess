import { type GameRow, type Member, TIME_PRESETS } from '@erpchess/api';
import { useGameMutations, useMembers, usePlayGames } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Bot, Crown, History, Plus, Radio, Swords, Trophy, Users } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { resultText } from '../components/play/gameText';
import { QuickPairCard } from '../components/play/QuickPairCard';
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  PageHeader,
  Spinner,
  StatCard,
  Tabs,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/play/')({
  component: PlayPage,
});

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function PlayPage() {
  const { t } = useT();
  const { academy, session, online = [] } = useAcademy();
  const staff = isStaff(academy.role);
  const members = useMembers(academy.id);
  const [since] = useState(startOfToday);
  const [player, setPlayer] = useState('');
  const [tab, setTab] = useState<'students' | 'history' | 'live'>('students');
  const [pairing, setPairing] = useState(false);
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  const live = usePlayGames(academy.id, { status: ['active'] });
  const today = usePlayGames(academy.id, { since });
  const history = usePlayGames(academy.id, {
    status: ['finished'],
    playerId: player || undefined,
    limit: 50,
  });

  const name = (id: string | null) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '?';
  const students = (members.data ?? []).filter((m) => m.role === 'student');
  const onlineStudents = online.filter((o) => o.role === 'student');
  const onlineIds = new Set(online.map((o) => o.userId));
  // Số liệu đều tính từ dữ liệu đã tải, không có RPC riêng
  const me = session.user.id;
  const todayGames = today.data ?? [];
  const finishedToday = todayGames.filter((g) => g.status === 'finished').length;
  const myToday = todayGames.filter((g) => g.white_id === me || g.black_id === me);
  const asWhite = myToday.filter((g) => g.white_id === me).length;
  const asBlack = myToday.filter((g) => g.black_id === me).length;
  const myHistory = (history.data ?? []).filter(
    (g) => g.white_id === me || g.black_id === me,
  ).length;

  return (
    <>
      <PageHeader
        icon={Swords}
        title={t('play.title')}
        subtitle={t('learnPage.playSubtitle')}
        actions={
          <>
            <Link
              to="/a/$slug/simuls"
              params={{ slug: academy.slug }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 font-medium hover:bg-primary-soft"
            >
              {t('simul.title')}
            </Link>
            <Link
              to="/a/$slug/tournaments"
              params={{ slug: academy.slug }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 font-medium hover:bg-primary-soft"
            >
              <Trophy className="size-4" aria-hidden="true" />
              {t('tournament.title')}
            </Link>
            {staff && (
              <Button
                variant="cta"
                icon={Plus}
                aria-pressed={pairing}
                onClick={() => setPairing((p) => !p)}
              >
                {t('learnPage.playPair')}
              </Button>
            )}
          </>
        }
      />

      {/* Thẻ số liệu theo vai trò: học viên xem "của tôi", còn lại xem toàn học viện */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {academy.role === 'student' ? (
          <>
            <StatCard
              variant="stacked"
              accent="blue"
              icon={Swords}
              label={t('learnPage.playStatTodayMine')}
              value={today.data ? myToday.length : '—'}
              hint={t('learnPage.playStatMineHint')}
            />
            <StatCard
              variant="stacked"
              accent="green"
              icon={Crown}
              label={t('learnPage.playStatWhite')}
              value={asWhite}
              hint={t('learnPage.playStatMineHint')}
            />
            <StatCard
              variant="stacked"
              accent="gray"
              icon={Crown}
              label={t('learnPage.playStatBlack')}
              value={asBlack}
              hint={t('learnPage.playStatMineHint')}
            />
            <StatCard
              variant="stacked"
              accent="purple"
              icon={History}
              label={t('learnPage.playStatTotalMine')}
              value={history.data ? myHistory : '—'}
              hint={t('learnPage.playStatTotalMineHint')}
            />
          </>
        ) : (
          <>
            <StatCard
              variant="stacked"
              accent="blue"
              icon={Swords}
              label={t('learnPage.playStatToday')}
              value={today.data ? todayGames.length : '—'}
              hint={t('learnPage.playStatTodayHint')}
            />
            <StatCard
              variant="stacked"
              accent="green"
              icon={Radio}
              label={t('learnPage.playStatLive')}
              value={live.data ? live.data.length : '—'}
              hint={t('learnPage.playStatLiveHint')}
            />
            <StatCard
              variant="stacked"
              accent="gray"
              icon={History}
              label={t('learnPage.playStatFinishedToday')}
              value={today.data ? finishedToday : '—'}
              hint={t('learnPage.playStatFinishedTodayHint')}
            />
            <StatCard
              variant="stacked"
              accent="orange"
              icon={Users}
              label={t('learnPage.playStatOnline')}
              value={onlineStudents.length}
              hint={t('learnPage.playStatOnlineHint')}
            />
          </>
        )}
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Banner đánh với máy: gradient màu chính + họa tiết ô cờ của Dương Sinh */}
        <section className="relative flex flex-col justify-center gap-4 overflow-hidden rounded-card bg-gradient-to-br from-primary to-blue-light p-6 text-text-on-primary shadow-sm">
          <div
            className="chess-pattern pointer-events-none absolute inset-0 opacity-10 invert"
            aria-hidden="true"
          />
          <div className="relative flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              {t('learnPage.botChipLevels')}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              {t('learnPage.botChipElo')}
            </span>
          </div>
          <h2 className="relative text-3xl font-bold">{t('learnPage.botBannerTitle')}</h2>
          <p className="relative max-w-lg text-sm opacity-90">{t('learnPage.botBannerDesc')}</p>
          <Link
            to="/a/$slug/play/bot"
            params={{ slug: academy.slug }}
            className="relative inline-flex items-center gap-2 self-start rounded-lg bg-orange px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-orange-hover"
          >
            <Bot className="size-5" aria-hidden="true" />
            {t('play.playBot')}
          </Link>
        </section>
        {academy.role !== 'parent' && (
          <QuickPairCard
            academyId={academy.id}
            onMatched={(id) =>
              void navigate({ to: '/a/$slug/play/$id', params: { slug: academy.slug, id } })
            }
          />
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Tabs
            variant="pills"
            value={tab}
            onChange={setTab}
            items={[
              {
                value: 'students',
                label: t('learnPage.playTabStudents'),
                count: students.length,
              },
              { value: 'history', label: t('learnPage.playTabHistory') },
              { value: 'live', label: t('learnPage.playTabLive'), count: live.data?.length },
            ]}
          />
          <Card>
            {tab === 'students' ? (
              <Roster students={students} onlineIds={onlineIds} loading={members.isPending} />
            ) : tab === 'live' ? (
              <GameList
                games={live.data}
                pending={live.isPending}
                error={live.error}
                empty={t('play.noLive')}
                name={name}
              />
            ) : (
              <>
                {(staff || academy.role === 'parent') && (
                  <div className="flex justify-end">
                    <select
                      aria-label={t('play.allStudents')}
                      value={player}
                      onChange={(e) => setPlayer(e.target.value)}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
                    >
                      <option value="">{t('play.allStudents')}</option>
                      {students.map((m) => (
                        <option key={m.profile.id} value={m.profile.id}>
                          {m.profile.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <GameList
                  games={history.data}
                  pending={history.isPending}
                  error={history.error}
                  empty={t('play.noHistory')}
                  name={name}
                />
              </>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* Học viên online + thách đấu nhanh */}
          <Card title={t('play.onlineStudents', { count: onlineStudents.length })}>
            {onlineStudents.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('learnPage.onlineEmpty')}
                description={t('learnPage.onlineEmptyDesc')}
              />
            ) : (
              <ul className="flex flex-col divide-y divide-text-muted/10">
                {onlineStudents.map((o) => {
                  const studentName = name(o.userId) !== '?' ? name(o.userId) : o.name;
                  const isMe = o.userId === session.user.id;
                  return (
                    <li key={o.userId} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full bg-green ring-4 ring-green/20"
                        />
                        <span className="truncate text-sm font-medium text-text">
                          {studentName} {isMe && '(Bạn)'}
                        </span>
                      </div>
                      {!isMe && (
                        <Button
                          variant="ghost"
                          onClick={() => setChallengeTarget({ id: o.userId, name: studentName })}
                          className="shrink-0 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          ⚔️ Thách đấu
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Form ghép cặp thủ công cho HLV: bật bằng nút Ghép cặp ở đầu trang */}
          {staff && pairing && <PairForm onlineIds={onlineIds} />}
        </div>
      </div>

      {/* Modal Thách đấu 1 chạm */}
      {challengeTarget && (
        <ChallengeModal opponent={challengeTarget} onClose={() => setChallengeTarget(null)} />
      )}
    </>
  );
}

/** Danh sách học viên của học viện kèm chấm trạng thái online. */
function Roster({
  students,
  onlineIds,
  loading,
}: {
  students: Member[];
  onlineIds: Set<string>;
  loading: boolean;
}) {
  const { t } = useT();
  if (loading) return <Spinner />;
  if (students.length === 0) {
    return <EmptyState dashed icon={Users} title={t('learnPage.rosterEmpty')} />;
  }
  const sorted = [...students].sort(
    (a, b) => Number(onlineIds.has(b.profile.id)) - Number(onlineIds.has(a.profile.id)),
  );
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {sorted.map((m) => {
        const on = onlineIds.has(m.profile.id);
        return (
          <li
            key={m.profile.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary"
            >
              {(m.profile.display_name.trim().charAt(0) || '?').toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{m.profile.display_name}</span>
            <span
              className={`flex items-center gap-1.5 text-xs ${on ? 'text-green' : 'text-text-muted'}`}
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${on ? 'bg-green' : 'bg-text-muted/40'}`}
              />
              {on ? t('learnPage.rosterOnline') : t('learnPage.rosterOffline')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ChallengeModal({
  opponent,
  onClose,
}: {
  opponent: { id: string; name: string };
  onClose: () => void;
}) {
  const { academy, session } = useAcademy();
  const { challenge } = useGameMutations(academy.id, session.user.id);
  const navigate = useNavigate();

  const [preset, setPreset] = useState<string>(TIME_PRESETS[1].id); // 5+0
  const [color, setColor] = useState<'w' | 'b' | 'random'>('random');
  const [rated, setRated] = useState(true);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tc = TIME_PRESETS.find((p) => p.id === preset);

    // Màu ngẫu nhiên do server bốc thăm
    challenge.mutate(
      {
        opponentId: opponent.id,
        color,
        baseMs: tc?.baseMs ?? null,
        incMs: tc?.incMs ?? 0,
        rated: rated && !!tc,
      },
      {
        onSuccess: (id) => {
          onClose();
          void navigate({ to: '/a/$slug/play/$id', params: { slug: academy.slug, id } });
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-text-muted/20 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-text-muted/15 pb-3">
          <h3 className="text-lg font-bold text-text">
            Thách đấu với <span className="text-primary">{opponent.name}</span>
          </h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <span className="block text-xs font-semibold text-text-muted">Kiểm soát thời gian</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`rounded-lg border py-2 text-center text-xs font-semibold transition ${
                    preset === p.id
                      ? 'border-primary bg-primary text-white'
                      : 'border-text-muted/20 bg-white text-text hover:bg-bg'
                  }`}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-text-muted">Màu quân của bạn</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setColor('w')}
                className={`rounded-lg border py-2 text-center text-xs font-semibold transition ${
                  color === 'w'
                    ? 'border-primary bg-primary text-white'
                    : 'border-text-muted/20 bg-white text-text hover:bg-bg'
                }`}
              >
                Trắng
              </button>
              <button
                type="button"
                onClick={() => setColor('random')}
                className={`rounded-lg border py-2 text-center text-xs font-semibold transition ${
                  color === 'random'
                    ? 'border-primary bg-primary text-white'
                    : 'border-text-muted/20 bg-white text-text hover:bg-bg'
                }`}
              >
                🎲 Ngẫu nhiên
              </button>
              <button
                type="button"
                onClick={() => setColor('b')}
                className={`rounded-lg border py-2 text-center text-xs font-semibold transition ${
                  color === 'b'
                    ? 'border-primary bg-primary text-white'
                    : 'border-text-muted/20 bg-white text-text hover:bg-bg'
                }`}
              >
                Đen
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={rated}
              onChange={(e) => setRated(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary"
            />
            Tính Elo rating ván đấu này
          </label>

          <ErrorText error={challenge.error} />

          <div className="mt-2 flex gap-3">
            <Button
              type="submit"
              variant="cta"
              className="flex-1 py-2.5 font-bold"
              disabled={challenge.isPending}
            >
              {challenge.isPending ? 'Đang tạo ván...' : 'Bắt đầu ván đấu'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Huỷ
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GameList({
  games,
  pending,
  error,
  empty,
  name,
}: {
  games: GameRow[] | undefined;
  pending: boolean;
  error: unknown;
  empty: string;
  name: (id: string | null) => string;
}) {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  if (pending) return <Spinner />;
  if (error) return <ErrorText error={error} />;
  if (!games?.length) return <EmptyState dashed icon={History} title={empty} />;
  const side = (id: string | null, botElo: number | null) =>
    id ? name(id) : botElo ? t('play.bot', { elo: botElo }) : t('play.botMax');
  return (
    <ul className="flex flex-col divide-y divide-text-muted/15">
      {games.map((g) => (
        <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <Link
            to="/a/$slug/play/$id"
            params={{ slug: academy.slug, id: g.id }}
            className="font-semibold text-primary hover:underline"
          >
            {side(g.white_id, g.bot_elo)} – {side(g.black_id, g.bot_elo)}
          </Link>
          <span className="text-xs text-text-muted">
            {resultText(g, t)} · {formatDateTime(g.created_at, i18n.language)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PairForm({ onlineIds }: { onlineIds: Set<string> }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const members = useMembers(academy.id);
  const { pair } = useGameMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [white, setWhite] = useState('');
  const [black, setBlack] = useState('');
  const [preset, setPreset] = useState<string>(TIME_PRESETS[2].id);
  const [rated, setRated] = useState(true);
  const [random, setRandom] = useState(true);
  const players = [...(members.data ?? [])]
    .filter((m) => m.role !== 'parent')
    .sort((a, b) => Number(onlineIds.has(b.profile.id)) - Number(onlineIds.has(a.profile.id)));
  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!white || !black || white === black) return;
    const swap = random && Math.random() < 0.5;
    const tc = TIME_PRESETS.find((p) => p.id === preset);
    pair.mutate(
      {
        whiteId: swap ? black : white,
        blackId: swap ? white : black,
        baseMs: tc?.baseMs ?? null,
        incMs: tc?.incMs ?? 0,
        rated: rated && !!tc,
      },
      {
        onSuccess: (g) =>
          void navigate({ to: '/a/$slug/play/$id', params: { slug: academy.slug, id: g.id } }),
      },
    );
  }

  const option = (m: (typeof players)[number]) => (
    <option key={m.profile.id} value={m.profile.id}>
      {m.profile.display_name}
      {onlineIds.has(m.profile.id) ? ` · ${t('play.online')}` : ''}
    </option>
  );

  return (
    <Card title="Ghép cặp học viên">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('play.white')}</span>
          <select
            value={white}
            onChange={(e) => setWhite(e.target.value)}
            className={select}
            required
          >
            <option value="">—</option>
            {players.map(option)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('play.black')}</span>
          <select
            value={black}
            onChange={(e) => setBlack(e.target.value)}
            className={select}
            required
          >
            <option value="">—</option>
            {players.map(option)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('play.time')}</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={select}>
            {TIME_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
            <option value="">{t('play.unlimited')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} />
          {t('play.randomColor')}
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={rated && !!preset}
            disabled={!preset}
            onChange={(e) => setRated(e.target.checked)}
          />
          {t('play.rated')}
        </label>
        {white && white === black && (
          <p role="alert" className="text-sm text-danger">
            {t('play.samePlayer')}
          </p>
        )}
        <ErrorText error={pair.error} />
        <Button
          type="submit"
          variant="cta"
          className="self-start"
          disabled={pair.isPending || !white || !black || white === black}
        >
          {t('play.pairNow')}
        </Button>
      </form>
    </Card>
  );
}
