import { inCheck, kingSquare, legalDests, playMove, sanLine } from '@erpchess/chess-core';
import { useMemo } from 'react';
import { useT } from '../../lib/use-t';
import { PreferredBoard } from '../board/PreferredBoard';
import { Button } from '../ui';

/**
 * Ghi lời giải puzzle: HLV đi lần lượt nước của người giải và nước đáp của đối phương trên bàn.
 * Lời giải hợp lệ khi số nước lẻ (người giải đi nước cuối).
 */
export function SolutionRecorder({
  fen,
  moves,
  onChange,
}: {
  fen: string;
  moves: string[];
  onChange: (moves: string[]) => void;
}) {
  const { t } = useT();
  const current = useMemo(() => {
    let f = fen;
    for (const uci of moves) f = playMove(f, uci)?.fen ?? f;
    return f;
  }, [fen, moves]);
  const dests = useMemo(() => legalDests(current), [current]);
  const san = sanLine(fen, moves);
  const last = moves.at(-1);

  return (
    <div className="flex flex-col gap-2">
      <PreferredBoard
        fen={current}
        orientation={fen.split(' ')[1] === 'b' ? 'b' : 'w'}
        lastMove={last ? [last.slice(0, 2), last.slice(2, 4)] : undefined}
        check={inCheck(current) ? kingSquare(current) : undefined}
        movable={{ color: 'both', dests }}
        onMove={(from, to, promo) => {
          const played = playMove(current, `${from}${to}${promo ?? ''}`);
          if (played) onChange([...moves, played.uci]);
        }}
        label={t('studies.recordSolution')}
      />
      <p className="text-sm">
        {san.length ? (
          san.join(' ')
        ) : (
          <span className="text-text-muted">{t('studies.noMovesYet')}</span>
        )}
      </p>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          disabled={!moves.length}
          onClick={() => onChange(moves.slice(0, -1))}
        >
          {t('studies.undoMove')}
        </Button>
        <Button variant="ghost" disabled={!moves.length} onClick={() => onChange([])}>
          {t('studies.resetMoves')}
        </Button>
      </div>
      {moves.length > 0 && moves.length % 2 === 0 && (
        <p className="text-sm text-danger">{t('studies.solutionMustEndWithSolver')}</p>
      )}
    </div>
  );
}
