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
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  Eraser,
  FlipVertical2,
  Grid2x2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBoardPreferences } from '../../lib/use-board-preferences';
import { useT } from '../../lib/use-t';
import { autoFlipOrientation, PreferredBoard } from '../board/PreferredBoard';
import { Button, Card, IconButton, PageHeader, Tabs } from '../ui';
import { EngineLines } from './EngineLines';
import { EvalBar } from './EvalBar';
import { MasterbasePanel } from './MasterbasePanel';
import { MoveList } from './MoveList';

const NO_DRAWINGS: Drawings = { arrows: [], highlights: [] };

export function AnalysisBoard({
  initialFen,
  initialPgn,
  notation = 'letters',
  showMasterbase = false,
}: {
  initialFen?: string;
  /** Ván PGN nạp sẵn khi mở (vd. thẻ ván chia sẻ trong chat). */
  initialPgn?: string;
  /** Hiện kho ván cao thủ (cần đăng nhập vì `search_masterbase` không mở cho khách). */
  showMasterbase?: boolean;
  notation?: MoveNotation;
}) {
  const { t } = useT();
  const { preferences } = useBoardPreferences();
  const game = useGameTree(initialFen);
  const { tree, current } = game;
  const { load } = game;
  // Nạp ván một lần khi mở; trang đổi `key` khi PGN khác nên không cần theo dõi thay đổi
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ nạp lúc mở
  useEffect(() => {
    if (initialPgn) load(initialPgn);
  }, []);
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
  const [tab, setTab] = useState<'analysis' | 'engine' | 'masterbase'>('analysis');

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

  const toolbar = 'flex flex-wrap items-center gap-1 rounded-card bg-surface p-2 shadow-sm';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
      <div className="flex min-w-0 gap-2">
        {engineOn && (
          <EvalBar score={bestScore} orientation={boardOrientation} label={t('analysis.eval')} />
        )}
        {/* Bàn cờ không vượt quá chiều cao màn hình để thanh công cụ luôn nằm trong tầm nhìn */}
        <div
          className="mx-auto flex min-w-0 flex-1 flex-col gap-3"
          style={{ maxWidth: 'min(100%, calc(100vh - 11rem))' }}
        >
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
          {/* Thanh công cụ icon dưới bàn: gom các thao tác sẵn có */}
          <div role="toolbar" aria-label={t('analysis.toolbar')} className={toolbar}>
            <IconButton icon={ChevronsLeft} label={t('analysis.start')} onClick={game.toStart} />
            <IconButton icon={ChevronLeft} label={t('analysis.prev')} onClick={game.back} />
            <IconButton icon={ChevronRight} label={t('analysis.next')} onClick={game.forward} />
            <IconButton icon={ChevronsRight} label={t('analysis.end')} onClick={game.toEnd} />
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
            <IconButton
              icon={FlipVertical2}
              label={t('analysis.flip')}
              onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
            />
            <IconButton
              icon={Eraser}
              label={t('analysis.clearDrawings')}
              disabled={drawings.arrows.length === 0 && drawings.highlights.length === 0}
              onClick={() => setDrawings(NO_DRAWINGS)}
            />
            <IconButton
              icon={Cpu}
              label={engineOn ? t('analysis.engineOff') : t('analysis.engineOn')}
              aria-pressed={engineOn}
              className={engineOn ? 'bg-primary text-text-on-primary hover:bg-primary' : ''}
              onClick={() => setEngineOn((v) => !v)}
            />
            {status !== 'ongoing' && (
              <span role="status" className="ml-auto px-2 font-bold text-danger">
                {t(`analysis.status_${status}` as TranslationKey)}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">{t('analysis.shortcuts')}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          compact
          icon={Grid2x2}
          title={t('analysis.title')}
          subtitle={t('analysis.subtitle')}
        />
        <Tabs
          variant="pills"
          ariaLabel={t('analysis.panels')}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'analysis', label: t('analysis.tabAnalysis') },
            { value: 'engine', label: t('analysis.tabEngine') },
            ...(showMasterbase
              ? [{ value: 'masterbase' as const, label: t('analysis.tabMasterbase') }]
              : []),
          ]}
        />

        {tab === 'analysis' && (
          <Card title={t('analysis.moves')}>
            {tree.root.children.length === 0 ? (
              <p className="text-sm text-text-muted">{t('analysis.noMoves')}</p>
            ) : (
              <MoveList
                tree={tree}
                currentId={current.id}
                onSelect={game.goTo}
                notation={notation}
              />
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
        )}

        {/* Engine vẫn chạy khi chuyển tab để thanh đánh giá bên bàn cờ không bị đứng */}
        <div hidden={tab !== 'engine'}>
          <Card>
            <Button
              className="self-start"
              variant={engineOn ? 'primary' : 'cta'}
              onClick={() => setEngineOn((v) => !v)}
            >
              {engineOn ? t('analysis.engineOff') : t('analysis.engineOn')}
            </Button>
            {engineOn ? (
              <EngineLines fen={fen} onPlay={game.play} onScore={onScore} notation={notation} />
            ) : (
              <p className="text-sm text-text-muted">{t('analysis.engineIdle')}</p>
            )}
          </Card>
        </div>

        {tab === 'masterbase' && showMasterbase && (
          <MasterbasePanel fen={fen} onLoadPgn={(pgn) => game.load(pgn)} />
        )}

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
                  setTab('analysis');
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
