import { formatSanList, type MoveNotation, sanLine, sideToMove } from '@erpchess/chess-core';
import { formatScore, type Score, toWhitePov } from '@erpchess/engine';
import type { TranslationKey } from '@erpchess/i18n';
import { useEffect } from 'react';
import { useEngine } from '../../lib/engine';
import { useAnalysis } from '../../lib/use-analysis';
import { useT } from '../../lib/use-t';

const MULTI_PV = 3;
const MB = 1024 * 1024;

function parseScoreKey(key: string): Score | null {
  if (!key) return null;
  const [kind, value] = key.split(':');
  return { kind: kind === 'mate' ? 'mate' : 'cp', value: Number(value) };
}

/**
 * Phần engine của bàn phân tích. Chỉ mount khi người dùng bật engine, để không tải
 * file NNUE (~25 MB) khi chưa cần. Tháo component thì engine dừng tìm kiếm.
 */
export function EngineLines({
  fen,
  onPlay,
  onScore,
  notation = 'letters',
}: {
  fen: string;
  onPlay: (uci: string) => void;
  onScore: (score: Score | null) => void;
  notation?: MoveNotation;
}) {
  const { t } = useT();
  const state = useEngine();
  const engine = state.status === 'ready' ? state.engine : null;
  const lines = useAnalysis(engine, fen, true, MULTI_PV);
  const side = sideToMove(fen);
  const best = lines[0]?.score ? toWhitePov(lines[0].score, side) : null;
  // Báo điểm lên thanh đánh giá theo khoá chuỗi ổn định: object `best` mới sau mỗi lần
  // render, nếu dùng làm dependency sẽ gây vòng lặp setState ↔ render ở component cha
  const bestKey = best ? `${best.kind}:${best.value}` : '';

  useEffect(() => onScore(parseScoreKey(bestKey)), [bestKey, onScore]);
  useEffect(() => () => onScore(null), [onScore]);

  if (state.status === 'unsupported') {
    return (
      <p role="alert" className="text-sm text-danger">
        {t('engine.unavailable', {
          reason: t(`engine.reason_${state.reason.replaceAll('-', '_')}` as TranslationKey),
        })}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-danger">
        {t('engine.error', { message: state.message })}
      </p>
    );
  }
  if (state.status === 'loading') {
    const p = state.progress;
    return (
      <p role="status" className="text-sm text-text-muted">
        {!p
          ? t('engine.loading')
          : p.total
            ? t('engine.downloadingOf', {
                loaded: (p.loaded / MB).toFixed(1),
                total: (p.total / MB).toFixed(1),
              })
            : t('engine.downloading', { loaded: (p.loaded / MB).toFixed(1) })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {lines[0] && (
        <p className="text-xs text-text-muted">
          {t('engine.depth', { depth: lines[0].depth })}
          {lines[0].nps ? ` · ${t('engine.nps', { nps: lines[0].nps.toLocaleString() })}` : ''}
        </p>
      )}
      <ol data-testid="analysis-lines" className="flex flex-col gap-1 font-mono text-sm">
        {lines.map((info) => (
          <li key={info.multipv}>
            <button
              type="button"
              className="flex w-full gap-2 rounded-sm px-1 text-left hover:bg-primary/10"
              onClick={() => info.pv[0] && onPlay(info.pv[0])}
            >
              <span className="w-14 shrink-0 font-bold">
                {info.score ? formatScore(toWhitePov(info.score, side)) : '…'}
              </span>
              <span className="truncate">
                {formatSanList(sanLine(fen, info.pv.slice(0, 8)), notation).join(' ')}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
