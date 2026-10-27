import type { GameRow } from '@erpchess/api';
import { useMembers, useSimul, useSimulMutations } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { replayGame } from '@erpchess/chess-core';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { resultText } from '../components/play/gameText';
import { SimulQuickPlayModal } from '../components/simul/SimulQuickPlayModal';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/simuls/$id')({
  component: SimulPage,
});

type BoardFilter = 'all' | 'my_turn' | 'opponent_turn' | 'finished';

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
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const [activeQuickGame, setActiveQuickGame] = useState<GameRow | null>(null);
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

  const waitingBoards = boards.filter((b) => b.waiting);
  const activeOpponentBoards = boards.filter((b) => b.g.status === 'active' && !b.waiting);
  const finishedBoards = boards.filter((b) => b.g.status === 'finished');

  const filteredBoards = boards.filter((b) => {
    if (boardFilter === 'my_turn') return b.waiting;
    if (boardFilter === 'opponent_turn') return b.g.status === 'active' && !b.waiting;
    if (boardFilter === 'finished') return b.g.status === 'finished';
    return true;
  });

  const handleNextActiveBoard = () => {
    if (!activeQuickGame) return;
    const currentIdx = waitingBoards.findIndex((b) => b.g.id === activeQuickGame.id);
    const nextBoard = waitingBoards[(currentIdx + 1) % waitingBoards.length] ?? waitingBoards[0];
    if (nextBoard) {
      setActiveQuickGame(nextBoard.g);
    } else {
      setActiveQuickGame(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/a/$slug/simuls"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('simul.title')}
      </Link>

      <Card title={s.title}>
        {s.description && (
          <p className="whitespace-pre-wrap text-sm text-text-muted">{s.description}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm mt-1">
          <p className="text-text-muted">
            {t('simul.host')}: <span className="font-semibold text-primary">{name(s.host_id)}</span>{' '}
            ·{' '}
            <span className="font-medium">
              {t(`simul.${s.status as 'active' | 'upcoming' | 'finished'}`)}
            </span>{' '}
            · {t('simul.boards', { count: s.games.length })}
          </p>

          {done.length > 0 && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-1 font-semibold text-xs border border-slate-200 dark:border-slate-700">
              {t('simul.score', { w: hostWon, d: draws, l: done.length - hostWon - draws })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {canRun && s.status === 'upcoming' && (
            <Button variant="cta" disabled={start.isPending} onClick={() => start.mutate(s.id)}>
              {t('simul.start')}
            </Button>
          )}
          {mine && (
            <Link
              to="/a/$slug/play/$id"
              params={{ slug: academy.slug, id: mine.g.id }}
              className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover shadow-xs"
            >
              ♟️ {t('simul.yourBoard')}
            </Link>
          )}
          {host && waitingBoards.length > 0 && (
            <Button
              variant="cta"
              onClick={() => setActiveQuickGame(waitingBoards[0]?.g ?? null)}
              className="flex items-center gap-1.5 bg-orange hover:bg-orange/90 text-white"
            >
              <span>⚡</span>
              <span>{t('simul.hostTurnBanner', { count: waitingBoards.length })}</span>
            </Button>
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

      {/* Thanh bộ lọc bàn cề */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setBoardFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              boardFilter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-muted/10'
            }`}
          >
            {t('simul.filterAll', { count: boards.length })}
          </button>
          <button
            type="button"
            onClick={() => setBoardFilter('my_turn')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              boardFilter === 'my_turn'
                ? 'bg-orange text-white shadow-xs font-bold'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-muted/10'
            }`}
          >
            <span>⚡</span>
            <span>{t('simul.filterMyTurn', { count: waitingBoards.length })}</span>
          </button>
          <button
            type="button"
            onClick={() => setBoardFilter('opponent_turn')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              boardFilter === 'opponent_turn'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-muted/10'
            }`}
          >
            {t('simul.filterOpponentTurn', { count: activeOpponentBoards.length })}
          </button>
          <button
            type="button"
            onClick={() => setBoardFilter('finished')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              boardFilter === 'finished'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-muted/10'
            }`}
          >
            {t('simul.filterDone', { count: finishedBoards.length })}
          </button>
        </div>

        <span className="text-xs text-text-muted">
          Hiển thị {filteredBoards.length}/{boards.length} bàn cờ
        </span>
      </div>

      {/* Lưới các bàn cờ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filteredBoards.map(({ g, replay, waiting, student }, idx) => {
          const isHostTurn = waiting && host;
          return (
            <div
              key={g.id}
              className={`flex flex-col gap-2 rounded-xl bg-white dark:bg-slate-800/80 p-3 shadow-xs border transition-all ${
                isHostTurn
                  ? 'border-orange ring-2 ring-orange/40 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500 uppercase">
                  {t('simul.boardNumber', { n: idx + 1 })}
                </span>
                {isHostTurn && (
                  <span className="rounded-full bg-orange/20 px-2 py-0.5 font-bold text-orange text-[10px] animate-pulse">
                    ⚡ Lượt của bạn
                  </span>
                )}
              </div>

              {/* Bấm vào bàn cờ: nếu host thì mở modal đi nước nhanh, nếu học viên thì vào ván */}
              <button
                type="button"
                onClick={() => {
                  if (host && g.status === 'active') {
                    setActiveQuickGame(g);
                  } else {
                    void navigate({
                      to: '/a/$slug/play/$id',
                      params: { slug: academy.slug, id: g.id },
                    });
                  }
                }}
                className="w-full text-left cursor-pointer overflow-hidden rounded-lg hover:opacity-95"
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
              </button>

              <div className="flex items-center justify-between text-xs mt-1">
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                  {name(student)}
                </span>
                <span className={`${isHostTurn ? 'font-bold text-orange' : 'text-text-muted'}`}>
                  {isHostTurn ? t('simul.waiting') : resultText(g, t)}
                </span>
              </div>

              {host && g.status === 'active' && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <Button
                    variant="ghost"
                    onClick={() => setActiveQuickGame(g)}
                    className="flex-1 text-xs py-1 text-primary hover:bg-primary/10"
                  >
                    ⚡ {t('simul.quickPlay')}
                  </Button>
                  <Link
                    to="/a/$slug/play/$id"
                    params={{ slug: academy.slug, id: g.id }}
                    className="text-xs text-text-muted hover:text-primary px-1.5 py-1"
                    title={t('simul.openGamePage')}
                  >
                    ↗
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Play Modal tương tác trực tiếp */}
      {activeQuickGame && (
        <SimulQuickPlayModal
          slug={academy.slug}
          hostId={s.host_id}
          game={activeQuickGame}
          studentName={name(
            activeQuickGame.white_id === s.host_id
              ? activeQuickGame.black_id
              : activeQuickGame.white_id,
          )}
          activeBoardsCount={waitingBoards.length}
          onNextBoard={waitingBoards.length > 1 ? handleNextActiveBoard : undefined}
          onClose={() => setActiveQuickGame(null)}
        />
      )}
    </div>
  );
}
