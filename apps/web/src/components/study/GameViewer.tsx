import { Board } from '@erpchess/board-web';
import { type GameTree, type MoveNode, parsePgn } from '@erpchess/chess-core';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useT } from '../../lib/use-t';
import { MoveList } from '../analysis/MoveList';
import { Button } from '../ui';

/**
 * Xem một ván PGN (có biến và chú thích): bàn chỉ xem, danh sách nước, nút và phím mũi tên để đi.
 * `children` nhận thế cờ đang xem để gắn thêm thao tác (mở bàn phân tích, tạo puzzle…).
 */
export function GameViewer({
  pgn,
  children,
}: {
  pgn: string;
  children?: (fen: string) => ReactNode;
}) {
  const { t } = useT();
  const tree = useMemo<GameTree | null>(() => {
    try {
      return parsePgn(pgn)[0] ?? null;
    } catch {
      return null;
    }
  }, [pgn]);
  const [currentId, setCurrentId] = useState('root');
  const [flipped, setFlipped] = useState(false);

  // Ván mới thì về đầu
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ đặt lại khi đổi ván
  useEffect(() => setCurrentId('root'), [tree]);

  useEffect(() => {
    if (!tree) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!tree) return;
      if (e.key === 'ArrowRight') setCurrentId((id) => tree.next(id)?.id ?? id);
      else if (e.key === 'ArrowLeft') setCurrentId((id) => tree.parentOf(id)?.id ?? id);
      else if (e.key === 'ArrowUp') setCurrentId('root');
      else if (e.key === 'ArrowDown') setCurrentId(tree.mainline().at(-1)?.id ?? 'root');
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tree]);

  if (!tree) return <p className="text-danger">{t('database.badPgn')}</p>;
  const node = tree.get(currentId) ?? tree.root;
  const move = currentId === 'root' ? null : (node as MoveNode);
  const side = tree.root.fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const orientation = flipped ? (side === 'w' ? 'b' : 'w') : side;
  const headers = tree.headers;

  return (
    <div className="flex flex-col gap-3">
      {(headers.White || headers.Black) && (
        <p className="text-sm font-medium">
          {headers.White || '?'} – {headers.Black || '?'}
          {headers.Result && headers.Result !== '*' && ` · ${headers.Result}`}
          {headers.Event && <span className="text-text-muted"> · {headers.Event}</span>}
        </p>
      )}
      <Board
        fen={node.fen}
        orientation={orientation}
        lastMove={move ? [move.uci.slice(0, 2), move.uci.slice(2, 4)] : undefined}
        label={t('database.viewer')}
      />
      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          aria-label={t('database.first')}
          onClick={() => setCurrentId('root')}
        >
          ⏮
        </Button>
        <Button
          variant="ghost"
          aria-label={t('database.prev')}
          onClick={() => setCurrentId(tree.parentOf(currentId)?.id ?? currentId)}
        >
          ◀
        </Button>
        <Button
          variant="ghost"
          aria-label={t('database.next')}
          onClick={() => setCurrentId(tree.next(currentId)?.id ?? currentId)}
        >
          ▶
        </Button>
        <Button
          variant="ghost"
          aria-label={t('database.last')}
          onClick={() => setCurrentId(tree.mainline().at(-1)?.id ?? 'root')}
        >
          ⏭
        </Button>
        <Button
          variant="ghost"
          aria-label={t('database.flip')}
          onClick={() => setFlipped((f) => !f)}
        >
          ⇅
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md bg-bg p-2">
        <MoveList tree={tree} currentId={currentId} onSelect={setCurrentId} />
      </div>
      {children?.(node.fen)}
    </div>
  );
}
