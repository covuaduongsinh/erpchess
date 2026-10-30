import type { Drawings } from '@erpchess/board-web';
import {
  gameStatus,
  inCheck,
  kingSquare,
  legalDests,
  type MoveNode,
  type MoveNotation,
  sideToMove,
  toPgn,
} from '@erpchess/chess-core';
import { useGameTree } from '@erpchess/chess-core/react';
import type { Score } from '@erpchess/engine';
import type { TranslationKey } from '@erpchess/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBoardPreferences } from '../../lib/use-board-preferences';
import { useT } from '../../lib/use-t';
import { autoFlipOrientation, PreferredBoard } from '../board/PreferredBoard';
import { Button, Card } from '../ui';
import { EngineLines } from './EngineLines';
import { EvalBar } from './EvalBar';
import { MoveList } from './MoveList';

const NO_DRAWINGS: Drawings = { arrows: [], highlights: [] };

export function AnalysisBoard({
  initialFen,
  notation = 'letters',
}: {
  initialFen?: string;
  notation?: MoveNotation;
}) {
  const { t } = useT();
  const { preferences } = useBoardPreferences();
  const game = useGameTree(initialFen);
  const { tree, current } = game;
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  // Hình vẽ gắn với nước đang xem: đổi nước thì tự hết hiệu lực, không cần effect để xoá
  const [drawState, setDrawState] = useState<{ nodeId: string; drawings: Drawings }>({
    nodeId: 'root',
    drawings: NO_DRAWINGS,
  });
  const [engineOn, setEngineOn] = useState(false);
  const [bestScore, setBestScore] = useState<Score | null>(null);
  const onScore = useCallback((s: Score | null) => setBestScore(s), []);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<unknown>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fen = current.fen;
  const side = sideToMove(fen);
  const status = gameStatus(fen);
  const dests = useMemo(() => legalDests(fen), [fen]);
  const lastMove = current.id === 'root' ? undefined : moveSquares(current as MoveNode);
  const boardOrientation = autoFlipOrientation(orientation, side, preferences.autoFlip);

  const drawings = drawState.nodeId === current.id ? drawState.drawings : NO_DRAWINGS;
  const setDrawings = (d: Drawings) => setDrawState({ nodeId: current.id, drawings: d });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'ArrowLeft') game.back();
      else if (e.key === 'ArrowRight') game.forward();
      else if (e.key === 'ArrowUp') game.toStart();
      else if (e.key === 'ArrowDown') game.toEnd();
      else if (e.key === 'f' || e.key === 'F') setOrientation((o) => (o === 'w' ? 'b' : 'w'));
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  async function copy(kind: 'pgn' | 'fen') {
    await navigator.clipboard.writeText(kind === 'pgn' ? toPgn(tree) : fen);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex gap-2">
        {engineOn && (
          <EvalBar score={bestScore} orientation={boardOrientation} label={t('analysis.eval')} />
        )}
        <div className="flex-1">
          <PreferredBoard
            fen={fen}
            orientation={boardOrientation}
            lastMove={lastMove}
            check={inCheck(fen) ? kingSquare(fen) : undefined}
            movable={status === 'ongoing' ? { color: side, dests } : undefined}
            onMove={(from, to, promo) => game.play(`${from}${to}${promo ?? ''}`)}
            drawings={drawings}
            onDrawingsChange={setDrawings}
            label={t('analysis.title')}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="ghost" aria-label={t('analysis.start')} onClick={game.toStart}>
              ⏮
            </Button>
            <Button variant="ghost" aria-label={t('analysis.prev')} onClick={game.back}>
              ◀
            </Button>
            <Button variant="ghost" aria-label={t('analysis.next')} onClick={game.forward}>
              ▶
            </Button>
            <Button variant="ghost" aria-label={t('analysis.end')} onClick={game.toEnd}>
              ⏭
            </Button>
            <Button variant="ghost" onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}>
              {t('analysis.flip')}
            </Button>
            {status !== 'ongoing' && (
              <span role="status" className="font-bold text-danger">
                {t(`analysis.status_${status}` as TranslationKey)}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-text-muted">{t('analysis.shortcuts')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <Button
            className="self-start"
            variant={engineOn ? 'primary' : 'cta'}
            onClick={() => setEngineOn((v) => !v)}
          >
            {engineOn ? t('analysis.engineOff') : t('analysis.engineOn')}
          </Button>
          {engineOn && (
            <EngineLines fen={fen} onPlay={game.play} onScore={onScore} notation={notation} />
          )}
        </Card>

        <Card title={t('analysis.moves')}>
          {tree.root.children.length === 0 ? (
            <p className="text-sm text-text-muted">{t('analysis.noMoves')}</p>
          ) : (
            <MoveList tree={tree} currentId={current.id} onSelect={game.goTo} notation={notation} />
          )}
          {current.id !== 'root' && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('analysis.comment')}</span>
                <textarea
                  key={current.id}
                  defaultValue={current.comment ?? ''}
                  rows={2}
                  onBlur={(e) => game.mutate((tr) => tr.setComment(current.id, e.target.value))}
                  className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="text-sm"
                  onClick={() => game.mutate((tr) => tr.promoteVariation(current.id))}
                >
                  {t('analysis.promote')}
                </Button>
                <Button
                  variant="ghost"
                  className="text-sm"
                  onClick={() => {
                    const parent = tree.parentOf(current.id);
                    game.mutate((tr) => tr.deleteFrom(current.id), parent?.id ?? 'root');
                  }}
                >
                  {t('analysis.delete')}
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('analysis.importLabel')}</span>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={3}
              className="rounded-md border border-text-muted/30 bg-white px-2 py-1 font-mono text-xs"
            />
          </label>
          {importError ? (
            <p role="alert" className="text-sm text-danger">
              {t('analysis.importError', {
                message: importError instanceof Error ? importError.message : String(importError),
              })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!importText.trim()}
              onClick={() => {
                try {
                  game.load(importText);
                  setImportError(null);
                  setImportText('');
                } catch (err) {
                  setImportError(err);
                }
              }}
            >
              {t('analysis.import')}
            </Button>
            <Button variant="ghost" onClick={() => void copy('pgn')}>
              {copied === 'pgn' ? t('common.copied') : t('analysis.exportPgn')}
            </Button>
            <Button variant="ghost" onClick={() => void copy('fen')}>
              {copied === 'fen' ? t('common.copied') : t('analysis.exportFen')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function moveSquares(node: MoveNode): [string, string] {
  return [node.uci.slice(0, 2), node.uci.slice(2, 4)];
}
