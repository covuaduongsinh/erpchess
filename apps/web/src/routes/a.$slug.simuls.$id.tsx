import { useMembers, useSimul, useSimulMutations } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { replayGame } from '@erpchess/chess-core';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { resultText } from '../components/play/gameText';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/simuls/$id')({
  component: SimulPage,
});

/** Chủ simul thấy lưới bàn, bàn đang chờ mình đi lên trước; bấm vào bàn để đi. */
function SimulPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const simul = useSimul(id);
  const members = useMembers(academy.id);
  const { start, remove } = useSimulMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const me = session.user.id;

  if (simul.isPending) return <Spinner />;
  if (simul.error) return <ErrorText error={simul.error} />;
  const s = simul.data;
  const host = s.host_id === me;
  const canRun = host || academy.role === 'owner';
  const name = (uid: string | null) =>
    members.data?.find((m) => m.profile.id === uid)?.profile.display_name ?? '?';
  const boards = s.games.map((g) => {
    const replay = replayGame(g.initial_fen, g.moves);
    const hostSide = g.white_id === s.host_id ? 'w' : 'b';
    const waiting = g.status === 'active' && replay?.turn === hostSide;
    return { g, replay, waiting, student: hostSide === 'w' ? g.black_id : g.white_id };
  });
  // Bàn đang chờ chủ simul lên trước, rồi bàn đang chơi, bàn đã xong cuối cùng
  const rank = (b: (typeof boards)[number]) => (b.waiting ? 0 : b.g.status === 'active' ? 1 : 2);
  boards.sort((a, b) => rank(a) - rank(b));
  const mine = boards.find((b) => b.student === me);
  const done = s.games.filter((g) => g.status === 'finished');
  const hostWon = done.filter(
    (g) =>
      (g.result === '1-0' && g.white_id === s.host_id) ||
      (g.result === '0-1' && g.black_id === s.host_id),
  ).length;
  const draws = done.filter((g) => g.result === '1/2-1/2').length;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/a/$slug/simuls"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('simul.title')}
      </Link>
      <Card title={s.title}>
        {s.description && <p className="whitespace-pre-wrap text-sm">{s.description}</p>}
        <p className="text-sm text-text-muted">
          {t('simul.host')}: {name(s.host_id)} ·{' '}
          {t(`simul.${s.status as 'active' | 'upcoming' | 'finished'}`)} ·{' '}
          {t('simul.boards', { count: s.games.length })}
        </p>
        {done.length > 0 && (
          <p className="text-sm">
            {t('simul.score', { w: hostWon, d: draws, l: done.length - hostWon - draws })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {canRun && s.status === 'upcoming' && (
            <Button variant="cta" disabled={start.isPending} onClick={() => start.mutate(s.id)}>
              {t('simul.start')}
            </Button>
          )}
          {mine && (
            <Link
              to="/a/$slug/play/$id"
              params={{ slug: academy.slug, id: mine.g.id }}
              className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
            >
              {t('simul.yourBoard')}
            </Link>
          )}
          {canRun && s.status !== 'active' && (
            <Button
              variant="ghost"
              className="ml-auto text-danger"
              disabled={remove.isPending}
              onClick={() =>
                confirm
                  ? remove.mutate(s.id, {
                      onSuccess: () =>
                        void navigate({ to: '/a/$slug/simuls', params: { slug: academy.slug } }),
                    })
                  : setConfirm(true)
              }
            >
              {confirm ? t('simul.confirm') : t('simul.delete')}
            </Button>
          )}
        </div>
        <ErrorText error={start.error ?? remove.error} />
      </Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {boards.map(({ g, replay, waiting, student }) => (
          <Link
            key={g.id}
            to="/a/$slug/play/$id"
            params={{ slug: academy.slug, id: g.id }}
            className={`flex flex-col gap-1 rounded-lg bg-white p-2 shadow-sm hover:ring-2 hover:ring-primary ${
              waiting && host ? 'ring-2 ring-orange' : ''
            }`}
          >
            <Board
              fen={replay?.fen ?? g.fen}
              orientation={g.white_id === s.host_id ? 'w' : 'b'}
              coordinates={false}
              lastMove={
                g.moves.length
                  ? [g.moves.at(-1)?.slice(0, 2) ?? '', g.moves.at(-1)?.slice(2, 4) ?? '']
                  : undefined
              }
              label={name(student)}
            />
            <span className="text-sm font-medium">{name(student)}</span>
            <span
              className={`text-xs ${waiting && host ? 'font-medium text-orange' : 'text-text-muted'}`}
            >
              {waiting && host ? t('simul.waiting') : resultText(g, t)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
