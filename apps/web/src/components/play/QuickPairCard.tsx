import { TIME_PRESETS } from '@erpchess/api';
import { useState } from 'react';
import { useQuickPair } from '../../lib/use-quick-pair';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText } from '../ui';

/** Nút "Tìm trận nhanh": chọn mức thời gian, chờ ghép theo Elo, ghép xong thì vào ván (Giai đoạn 22c). */
export function QuickPairCard({
  academyId,
  onMatched,
}: {
  academyId: string;
  onMatched: (gameId: string) => void;
}) {
  const { t } = useT();
  const [presetId, setPresetId] = useState<string>(TIME_PRESETS[1].id);
  const { state, start, cancel } = useQuickPair(academyId, onMatched);
  const searching = state.phase === 'searching';

  return (
    <Card title={t('play.quickPairTitle')}>
      <p className="text-xs text-text-muted">{t('play.quickPairHint')}</p>
      <div className="grid grid-cols-3 gap-2">
        {TIME_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={presetId === p.id}
            disabled={searching}
            onClick={() => setPresetId(p.id)}
            className="rounded-lg border border-text-muted/20 bg-white py-2 text-center text-xs font-semibold text-text transition hover:bg-bg disabled:opacity-60 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
          >
            {p.id}
          </button>
        ))}
      </div>

      {searching ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <span className="inline-block size-3 animate-ping rounded-full bg-primary" />
            {t('play.quickPairSearching', { seconds: Math.floor(state.waitedMs / 1000) })}
          </p>
          {state.rating !== null && state.window !== null && (
            <p className="text-xs text-text-muted">
              {t('play.quickPairWindow', { rating: state.rating, window: state.window })}
            </p>
          )}
          <Button variant="ghost" className="self-start" onClick={() => void cancel()}>
            {t('play.quickPairCancel')}
          </Button>
        </div>
      ) : (
        <Button
          variant="cta"
          className="self-start"
          onClick={() => {
            const tc = TIME_PRESETS.find((p) => p.id === presetId);
            if (tc) start(tc);
          }}
        >
          ⚡ {t('play.quickPairStart')}
        </Button>
      )}
      {state.phase === 'error' && <ErrorText error={state.error} />}
    </Card>
  );
}
