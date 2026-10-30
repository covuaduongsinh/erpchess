import {
  inCheck,
  kingSquare,
  legalDests,
  type Puzzle,
  type PuzzleSession,
  puzzleSideToMove,
} from '@erpchess/chess-core';
import { usePuzzleSession } from '@erpchess/chess-core/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useT } from '../../lib/use-t';
import { PreferredBoard } from '../board/PreferredBoard';
import { Button } from '../ui';

/**
 * Bàn cờ làm một puzzle. Đặt `key` theo id câu ở nơi dùng để đổi câu là bắt đầu phiên mới.
 * `onTryEnd` nhận lượt thử vừa kết thúc (sai hoặc giải xong) để nộp lên server.
 */
export function PuzzleSolver({
  puzzle,
  onTryEnd,
  children,
}: {
  puzzle: Puzzle;
  onTryEnd?: (session: PuzzleSession) => void;
  /** Nội dung thêm dưới dòng trạng thái (trạng thái lưu, nút câu tiếp…). */
  children?: ReactNode;
}) {
  const { t } = useT();
  const { session, play, retry } = usePuzzleSession(puzzle, onTryEnd);
  const side = puzzleSideToMove(puzzle);
  const dests = useMemo(() => legalDests(session.fen), [session.fen]);
  const moved = session.moves.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <PreferredBoard
        fen={session.fen}
        orientation={side}
        lastMove={session.lastMove}
        check={inCheck(session.fen) ? kingSquare(session.fen) : undefined}
        movable={session.status === 'playing' ? { color: side, dests } : undefined}
        onMove={(from, to, promo) => play(`${from}${to}${promo ?? ''}`)}
        label={t(`puzzle.toMove_${side}`)}
      />
      <div className="flex min-h-10 flex-wrap items-center gap-3" aria-live="polite">
        {session.status === 'playing' && (
          <span className={moved ? 'font-medium text-green' : 'text-text-muted'}>
            {moved ? t('puzzle.correct') : t(`puzzle.toMove_${side}`)}
          </span>
        )}
        {session.status === 'wrong' && (
          <>
            <span role="status" className="font-bold text-danger">
              {t('puzzle.wrong')}
            </span>
            <Button onClick={retry}>{t('puzzle.retry')}</Button>
          </>
        )}
        {session.status === 'solved' && (
          <span role="status" className="font-bold text-green">
            {t('puzzle.solved')}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
