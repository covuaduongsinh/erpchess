import {
  BOT_LEVELS,
  type EngineInfo,
  formatScore,
  sideToMoveFromFen,
  toWhitePov,
  type UciEngine,
} from '@erpchess/engine';
import { engineSupport } from '@erpchess/engine/web';
import type { TranslationKey } from '@erpchess/i18n';
import { useState } from 'react';
import { useEngine } from '../lib/engine';
import { useT } from '../lib/use-t';
import { Button, Card, Field } from './ui';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MB = 1024 * 1024;

/** Trang thử engine trên trình duyệt: kiểm hỗ trợ, tải NNUE, phân tích MultiPV, bot theo Elo. */
export function EngineLab() {
  const { t } = useT();
  const state = useEngine();

  return (
    <Card title={t('engine.title')}>
      {state.status === 'unsupported' && (
        <p role="alert" className="text-danger">
          {t('engine.unavailable', {
            reason: t(`engine.reason_${state.reason.replaceAll('-', '_')}` as TranslationKey),
          })}
        </p>
      )}
      {state.status === 'loading' && (
        <p role="status" className="text-text-muted">
          {!state.progress
            ? t('engine.loading')
            : state.progress.total
              ? t('engine.downloadingOf', {
                  loaded: (state.progress.loaded / MB).toFixed(1),
                  total: (state.progress.total / MB).toFixed(1),
                })
              : t('engine.downloading', { loaded: (state.progress.loaded / MB).toFixed(1) })}
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-danger">
          {t('engine.error', { message: state.message })}
        </p>
      )}
      {state.status === 'ready' && <EnginePanel engine={state.engine} />}
    </Card>
  );
}

function EnginePanel({ engine }: { engine: UciEngine }) {
  const { t } = useT();
  const [fen, setFen] = useState(START_FEN);
  const [multiPv, setMultiPv] = useState(3);
  const [lines, setLines] = useState<Map<number, EngineInfo>>(new Map());
  const [running, setRunning] = useState(false);
  const [elo, setElo] = useState<number>(BOT_LEVELS[0].elo);
  const [bot, setBot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cùng giá trị createBrowserEngine đã đặt cho option Threads
  const support = engineSupport();
  const threads = support.ok ? support.threads : 1;

  async function analyse() {
    setLines(new Map());
    setError(null);
    setRunning(true);
    try {
      // Không giới hạn: chạy tới khi bấm Dừng
      await engine.analyse(fen, { multiPv }, (info) =>
        setLines((prev) => new Map(prev).set(info.multipv, info)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function botMove() {
    setBot(null);
    setError(null);
    try {
      const best = await engine.play(fen, { elo, movetimeMs: 800 });
      setBot(t('engine.botResult', { elo, move: best.move ?? '—' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const side = sideToMoveFromFen(fen);
  const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
  const nps = sorted[0]?.nps;

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm text-green">
        {t('engine.ready', { name: engine.name, threads })}
      </p>
      <Field label={t('engine.fen')} value={fen} onChange={(e) => setFen(e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('engine.lines')}</span>
          <select
            value={multiPv}
            onChange={(e) => setMultiPv(Number(e.target.value))}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <Button onClick={() => engine.stop()}>{t('engine.stop')}</Button>
        ) : (
          <Button variant="cta" onClick={() => void analyse()}>
            {t('engine.analyse')}
          </Button>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('engine.botElo')}</span>
          <select
            value={elo}
            onChange={(e) => setElo(Number(e.target.value))}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            {BOT_LEVELS.map((l) => (
              <option key={l.id} value={l.elo ?? 3450}>
                {l.elo ?? 3450}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" disabled={running} onClick={() => void botMove()}>
          {t('engine.botMove')}
        </Button>
      </div>

      {sorted.length > 0 && (
        <div className="flex flex-col gap-1 font-mono text-sm">
          <p className="text-text-muted">
            {t('engine.depth', { depth: sorted[0]?.depth ?? 0 })}
            {nps ? ` · ${t('engine.nps', { nps: nps.toLocaleString() })}` : ''}
          </p>
          <ol data-testid="engine-lines" className="flex flex-col gap-1">
            {sorted.map((info) => (
              <li key={info.multipv} className="flex gap-3">
                <span className="w-16 font-bold">
                  {info.score ? formatScore(toWhitePov(info.score, side)) : '…'}
                </span>
                <span className="truncate">{info.pv.slice(0, 10).join(' ')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {bot && (
        <p role="status" data-testid="bot-move">
          {bot}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {t('engine.error', { message: error })}
        </p>
      )}
    </div>
  );
}
