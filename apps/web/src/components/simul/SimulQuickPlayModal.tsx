import type { GameRow } from '@erpchess/api';
import { useGameAction } from '@erpchess/api/react';
import { inCheck, kingSquare, legalDests, replayGame } from '@erpchess/chess-core';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useT } from '../../lib/use-t';
import { PreferredBoard } from '../board/PreferredBoard';
import { Button, ErrorText } from '../ui';

export interface SimulQuickPlayModalProps {
  slug: string;
  hostId: string;
  game: GameRow;
  studentName: string;
  activeBoardsCount: number;
  onNextBoard?: () => void;
  onClose: () => void;
}

export function SimulQuickPlayModal({
  slug,
  hostId,
  game,
  studentName,
  activeBoardsCount,
  onNextBoard,
  onClose,
}: SimulQuickPlayModalProps) {
  const { t } = useT();
  const act = useGameAction(game.id);
  const [lastMoveUci, setLastMoveUci] = useState<string | null>(null);

  const replay = useMemo(
    () => replayGame(game.initial_fen, game.moves),
    [game.initial_fen, game.moves],
  );

  const currentFen = replay?.fen ?? game.fen;
  const hostSide = game.white_id === hostId ? 'w' : 'b';
  const myTurn = game.status === 'active' && replay?.turn === hostSide && !act.isPending;
  const dests = useMemo(() => legalDests(currentFen), [currentFen]);

  const handleMove = (from: string, to: string, promo?: string) => {
    if (!myTurn) return;
    const uci = `${from}${to}${promo ?? ''}`;
    setLastMoveUci(uci);
    act.mutate(
      { action: 'move', move: uci, ply: game.moves.length },
      {
        onSuccess: () => {
          if (onNextBoard && activeBoardsCount > 1) {
            setTimeout(onNextBoard, 400);
          }
        },
      },
    );
  };

  const lastMove = useMemo(() => {
    if (lastMoveUci) {
      return [lastMoveUci.slice(0, 2), lastMoveUci.slice(2, 4)] as [string, string];
    }
    const last = game.moves.at(-1);
    return last ? ([last.slice(0, 2), last.slice(2, 4)] as [string, string]) : undefined;
  }, [game.moves, lastMoveUci]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Đối thủ: <span className="text-primary">{studentName}</span>
              </h3>
              <p className="text-xs text-text-muted">
                {hostSide === 'w' ? 'Bạn cầm Trắng ♔' : 'Bạn cầm Đen ♚'} ·{' '}
                {myTurn ? (
                  <span className="font-semibold text-orange animate-pulse">
                    ⚡ Đến lượt bạn đi
                  </span>
                ) : (
                  <span className="text-text-muted">Đang chờ học viên...</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full size-8 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Bàn cờ tương tác */}
        <div className="mx-auto w-full max-w-sm">
          <PreferredBoard
            fen={currentFen}
            orientation={hostSide}
            lastMove={lastMove}
            check={inCheck(currentFen) ? kingSquare(currentFen) : undefined}
            movable={myTurn ? { color: hostSide, dests } : undefined}
            onMove={handleMove}
            label={studentName}
          />
        </div>

        {act.error && <ErrorText error={act.error} />}

        {/* Footer điều khiển */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <Link
            to="/a/$slug/play/$id"
            params={{ slug, id: game.id }}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            ↗ {t('simul.openGamePage')}
          </Link>

          <div className="flex items-center gap-2">
            {onNextBoard && activeBoardsCount > 1 && (
              <Button
                variant="cta"
                onClick={onNextBoard}
                className="text-xs px-3 py-1.5 flex items-center gap-1 font-medium"
              >
                <span>{t('simul.nextActiveBoard')}</span>
                <span>⏭️</span>
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} className="text-xs px-3 py-1.5">
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
