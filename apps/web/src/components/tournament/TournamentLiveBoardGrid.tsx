import type { GameRow } from '@erpchess/api';
import { Board } from '@erpchess/board-web';
import { replayGame } from '@erpchess/chess-core';
import { Link } from '@tanstack/react-router';
import { useT } from '../../lib/use-t';
import { resultText } from '../play/gameText';

export interface TournamentLiveBoardGridProps {
  slug: string;
  games: GameRow[];
  getName: (uid: string | null) => string;
  filter?: 'all' | 'active' | 'finished';
}

export function TournamentLiveBoardGrid({
  slug,
  games,
  getName,
  filter = 'all',
}: TournamentLiveBoardGridProps) {
  const { t } = useT();

  const filteredGames = games.filter((g) => {
    if (filter === 'active') return g.status === 'active';
    if (filter === 'finished') return g.status !== 'active';
    return true;
  });

  if (filteredGames.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        {t('tournament.roundStatus_pending')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredGames.map((g) => {
        const replay = replayGame(g.initial_fen, g.moves);
        const isActive = g.status === 'active';
        const whiteName = getName(g.white_id);
        const blackName = getName(g.black_id);

        return (
          <div
            key={g.id}
            className={`flex flex-col rounded-xl border p-3 transition-shadow hover:shadow-md ${
              isActive
                ? 'border-primary/40 bg-card shadow-sm dark:border-primary/30'
                : 'border-border/60 bg-card/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-slate-600 dark:text-slate-300">
                {t('tournament.board', { n: g.board_no ?? 1 })}
              </span>
              {isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('tournament.livePulse')}
                </span>
              ) : (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {resultText(g, t)}
                </span>
              )}
            </div>

            <Link
              to="/a/$slug/play/$id"
              params={{ slug, id: g.id }}
              className="block cursor-pointer overflow-hidden rounded-lg hover:opacity-95"
            >
              <Board
                fen={replay?.fen ?? g.fen}
                orientation="w"
                coordinates={false}
                lastMove={
                  g.moves.length
                    ? [g.moves.at(-1)?.slice(0, 2) ?? '', g.moves.at(-1)?.slice(2, 4) ?? '']
                    : undefined
                }
              />
            </Link>

            <div className="mt-2.5 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 truncate font-medium text-slate-800 dark:text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-sm border border-slate-400 bg-white inline-block shrink-0" />
                  <span className="truncate">{whiteName}</span>
                </span>
                <span className="font-mono text-[11px] text-text-muted">
                  {g.white_ms !== null ? `${Math.ceil(g.white_ms / 1000)}s` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 truncate font-medium text-slate-800 dark:text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-900 inline-block shrink-0" />
                  <span className="truncate">{blackName}</span>
                </span>
                <span className="font-mono text-[11px] text-text-muted">
                  {g.black_ms !== null ? `${Math.ceil(g.black_ms / 1000)}s` : ''}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 text-center">
              <Link
                to="/a/$slug/play/$id"
                params={{ slug, id: g.id }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {isActive ? t('tournament.myGame') : t('tournament.view_table')} →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
