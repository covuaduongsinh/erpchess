import { type GameRow, TIME_PRESETS } from '@erpchess/api';
import { useGameMutations, useMembers, usePlayGames } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { resultText } from '../components/play/gameText';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
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
  const { academy, online = [] } = useAcademy();
  const staff = isStaff(academy.role);
  const members = useMembers(academy.id);
  const [since] = useState(startOfToday);
  const [player, setPlayer] = useState('');
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Card title={t('play.todayGames')}>
            <p className="text-3xl font-bold text-primary">{today.data?.length ?? '—'}</p>
          </Card>
          <Link
            to="/a/$slug/play/bot"
            params={{ slug: academy.slug }}
            className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
          >
            {t('play.playBot')}
          </Link>
          <Link
            to="/a/$slug/simuls"
            params={{ slug: academy.slug }}
            className="rounded-md px-4 py-2 font-medium text-primary hover:bg-primary/10"
          >
            {t('simul.title')}
          </Link>
        </div>
        <Card title={t('play.liveGames')}>
          <GameList
            games={live.data}
            pending={live.isPending}
            error={live.error}
            empty={t('play.noLive')}
            name={name}
          />
        </Card>
        <Card title={t('play.history')}>
          {(staff || academy.role === 'parent') && (
            <select
              aria-label={t('play.allStudents')}
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              className="self-start rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm"
            >
              <option value="">{t('play.allStudents')}</option>
              {students.map((m) => (
                <option key={m.profile.id} value={m.profile.id}>
                  {m.profile.display_name}
                </option>
              ))}
            </select>
          )}
          <GameList
            games={history.data}
            pending={history.isPending}
            error={history.error}
            empty={t('play.noHistory')}
            name={name}
          />
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card title={t('play.onlineStudents', { count: onlineStudents.length })}>
          {onlineStudents.length === 0 ? (
            <p className="text-sm text-text-muted">{t('play.noneOnline')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {onlineStudents.map((o) => (
                <li key={o.userId} className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-full bg-green" />
                  {name(o.userId) !== '?' ? name(o.userId) : o.name}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {staff && <PairForm onlineIds={new Set(online.map((o) => o.userId))} />}
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
  if (!games?.length) return <p className="text-text-muted">{empty}</p>;
  const side = (id: string | null, botElo: number | null) =>
    id ? name(id) : botElo ? t('play.bot', { elo: botElo }) : t('play.botMax');
  return (
    <ul className="flex flex-col divide-y divide-text-muted/15">
      {games.map((g) => (
        <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <Link
            to="/a/$slug/play/$id"
            params={{ slug: academy.slug, id: g.id }}
            className="font-medium text-primary hover:underline"
          >
            {side(g.white_id, g.bot_elo)} – {side(g.black_id, g.bot_elo)}
          </Link>
          <span className="text-text-muted">
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
  // Học viên online lên trước; HLV/owner cũng có thể chơi (ví dụ HLV đấu với học viên)
  const players = [...(members.data ?? [])]
    .filter((m) => m.role !== 'parent')
    .sort((a, b) => Number(onlineIds.has(b.profile.id)) - Number(onlineIds.has(a.profile.id)));
  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';

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
    <Card title={t('play.pair')}>
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} />
          {t('play.randomColor')}
        </label>
        <label className="flex items-center gap-2 text-sm">
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
