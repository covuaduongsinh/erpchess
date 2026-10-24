import { teamStandings, tournamentStandings } from '@erpchess/api';
import { useMembers, useTournament, useTournamentMutations } from '@erpchess/api/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { resultText } from '../components/play/gameText';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/tournaments/$id')({
  component: TournamentPage,
});

const ERRORS = ['not_enough_players', 'players_without_team', 'round_in_progress'] as const;

function TournamentPage() {
  const { t, i18n } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const tour = useTournament(id);
  const members = useMembers(academy.id);
  const m = useTournamentMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [round, setRound] = useState<number | null>(null);
  const me = session.user.id;

  if (tour.isPending) return <Spinner />;
  if (tour.error) return <ErrorText error={tour.error} />;
  const d = tour.data;
  const runner = academy.role === 'owner' || (academy.role === 'coach' && d.created_by === me);
  const joined = d.players.some((p) => p.player_id === me);
  const name = (uid: string | null) =>
    members.data?.find((x) => x.profile.id === uid)?.profile.display_name ?? '?';
  const table = tournamentStandings(d);
  const teams = d.format === 'team_swiss' ? teamStandings(d) : [];
  const shownRound = round ?? d.current_round;
  const roundGames = d.games.filter((g) => g.round === shownRound);
  const roundByes = d.byes.filter((b) => b.round === shownRound);
  const myGame = d.games.find(
    (g) => g.status === 'active' && (g.white_id === me || g.black_id === me),
  );
  const withdrawn = new Set(d.players.filter((p) => p.withdrawn).map((p) => p.player_id));
  const errCode = (m.act.error as { code?: string } | null)?.code;
  const errKey = ERRORS.find((e) => e === errCode);
  const busy = m.act.isPending;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/a/$slug/tournaments"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('tournament.title')}
      </Link>
      <Card title={d.title}>
        <p className="text-sm text-text-muted">
          {t(`tournament.format_${d.format as 'swiss'}`)} ·{' '}
          {d.base_ms === null
            ? t('tournament.unlimited')
            : `${d.base_ms / 60_000}+${d.inc_ms / 1000}`}{' '}
          · {t('tournament.playerCount', { count: d.players.length })} ·{' '}
          {t(`tournament.${d.status as 'active'}`)}
          {d.status !== 'upcoming' &&
            ` · ${t('tournament.roundN', { n: d.current_round })}/${d.rounds}`}
          {d.location && ` · ${d.location}`}
          {d.starts_at && ` · ${formatDateTime(d.starts_at, i18n.language)}`}
        </p>
        {d.description && <p className="whitespace-pre-wrap text-sm">{d.description}</p>}
        <div className="flex flex-wrap gap-2">
          {myGame && (
            <Link
              to="/a/$slug/play/$id"
              params={{ slug: academy.slug, id: myGame.id }}
              className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
            >
              {t('tournament.myGame')}
            </Link>
          )}
          {d.is_public && d.status === 'upcoming' && academy.role === 'student' && (
            <Button
              variant={joined ? 'ghost' : 'cta'}
              disabled={m.join.isPending || m.leave.isPending}
              onClick={() => (joined ? m.leave.mutate(d.id) : m.join.mutate(d.id))}
            >
              {joined ? t('tournament.leave') : t('tournament.join')}
            </Button>
          )}
          {runner && d.status === 'upcoming' && (
            <Button
              variant="cta"
              disabled={busy}
              onClick={() => m.act.mutate({ id: d.id, action: 'start' })}
            >
              {t('tournament.start')}
            </Button>
          )}
          {runner && d.status === 'active' && d.current_round < d.rounds && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => m.act.mutate({ id: d.id, action: 'next_round' })}
            >
              {t('tournament.nextRound')}
            </Button>
          )}
          {runner && d.status === 'active' && (
            <Button
              variant="ghost"
              className="text-danger"
              disabled={busy}
              onClick={() =>
                confirm ? m.act.mutate({ id: d.id, action: 'finish' }) : setConfirm(true)
              }
            >
              {confirm ? t('tournament.confirmFinish') : t('tournament.finish')}
            </Button>
          )}
          {runner && d.status !== 'active' && (
            <Button
              variant="ghost"
              className="ml-auto text-danger"
              disabled={m.remove.isPending}
              onClick={() =>
                m.remove.mutate(d.id, {
                  onSuccess: () =>
                    void navigate({ to: '/a/$slug/tournaments', params: { slug: academy.slug } }),
                })
              }
            >
              {t('tournament.delete')}
            </Button>
          )}
        </div>
        {errKey ? (
          <p role="alert" className="text-sm text-danger">
            {t(`tournament.error_${errKey}`)}
          </p>
        ) : (
          <ErrorText error={m.act.error ?? m.join.error ?? m.leave.error ?? m.remove.error} />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('tournament.standings')}>
          {teams.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1">#</th>
                  <th className="py-1">{t('tournament.teams')}</th>
                  <th className="py-1">{t('tournament.matchPoints')}</th>
                  <th className="py-1">{t('tournament.gamePoints')}</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((r, i) => (
                  <tr key={r.teamId} className="border-t border-text-muted/15">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1 font-medium">{r.name}</td>
                    <td className="py-1">{r.matchPoints}</td>
                    <td className="py-1">{r.gamePoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.players.length === 0 ? (
            <p className="text-text-muted">{t('tournament.noPlayers')}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1">#</th>
                  <th className="py-1">{t('tournament.players')}</th>
                  <th className="py-1">{t('tournament.points')}</th>
                  <th className="py-1">{t('tournament.buchholz')}</th>
                  <th className="py-1">{t('tournament.sb')}</th>
                  <th className="py-1">{t('tournament.wins')}</th>
                  {runner && d.status === 'active' && <th />}
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-text-muted/15 ${r.id === me ? 'bg-primary/5' : ''}`}
                  >
                    <td className="py-1">{r.rank}</td>
                    <td
                      className={`py-1 font-medium ${withdrawn.has(r.id) ? 'text-text-muted line-through' : ''}`}
                    >
                      {name(r.id)}
                    </td>
                    <td className="py-1">{r.points}</td>
                    <td className="py-1">{r.buchholzCut1}</td>
                    <td className="py-1">{r.sonneborn}</td>
                    <td className="py-1">{r.wins}</td>
                    {runner && d.status === 'active' && (
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() =>
                            m.withdraw.mutate({
                              id: d.id,
                              playerId: r.id,
                              withdrawn: !withdrawn.has(r.id),
                            })
                          }
                        >
                          {withdrawn.has(r.id)
                            ? t('tournament.reinstate')
                            : t('tournament.withdraw')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={t('tournament.pairings')}>
          {d.roundList.length > 0 && (
            <div role="tablist" className="flex flex-wrap gap-1">
              {d.roundList.map((r) => (
                <button
                  key={r.round}
                  type="button"
                  role="tab"
                  aria-selected={shownRound === r.round}
                  onClick={() => setRound(r.round)}
                  className="rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary"
                  title={t(`tournament.roundStatus_${r.status as 'pending'}`)}
                >
                  {r.round}
                </button>
              ))}
            </div>
          )}
          {roundGames.length === 0 && roundByes.length === 0 ? (
            <p className="text-sm text-text-muted">{t('tournament.roundStatus_pending')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-text-muted/15 text-sm">
              {roundGames.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link
                    to="/a/$slug/play/$id"
                    params={{ slug: academy.slug, id: g.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {g.board_no}. {name(g.white_id)} – {name(g.black_id)}
                  </Link>
                  <span className="text-text-muted">{resultText(g, t)}</span>
                </li>
              ))}
              {roundByes.map((b) => (
                <li key={`${b.player_id ?? b.team_id}`} className="py-2 text-text-muted">
                  {b.player_id ? name(b.player_id) : d.teams.find((x) => x.id === b.team_id)?.name}{' '}
                  — {t('tournament.bye')}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
