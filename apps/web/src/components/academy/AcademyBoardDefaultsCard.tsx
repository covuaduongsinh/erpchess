import { useUpdateAcademyBoardDefaults } from '@erpchess/api/react';
import { BOARD_THEMES, Board, PIECE_SETS } from '@erpchess/board-web';
import {
  BOARD_THEME_KEYS,
  type BoardPreferences,
  DEFAULT_BOARD_PREFERENCES,
  normalizeBoardPreferences,
  PIECE_SET_KEYS,
} from '@erpchess/domain';
import { useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText } from '../ui';

const PREVIEW_FEN = 'r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQ1RK1 w kq - 3 9';

/**
 * Chủ học viện đặt bàn cờ mặc định cho mọi thành viên (Giai đoạn 23f, đặc tả REA: Platform
 * Branding → Board Preferences). Thành viên đã tự chỉnh trong hồ sơ thì vẫn dùng của mình.
 */
export function AcademyBoardDefaultsCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const update = useUpdateAcademyBoardDefaults(academy.id);
  const stored = academy.board_defaults;
  const hasDefaults = !!stored && typeof stored === 'object' && Object.keys(stored).length > 0;
  const [value, setValue] = useState<BoardPreferences>(
    hasDefaults ? normalizeBoardPreferences(stored) : DEFAULT_BOARD_PREFERENCES,
  );
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<BoardPreferences>) => {
    setSaved(false);
    setValue((v) => ({ ...v, ...patch }));
  };

  return (
    <Card title={t('boardDefaults.title')}>
      <p className="text-sm text-text-muted">{t('boardDefaults.hint')}</p>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {BOARD_THEME_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={value.theme === k}
                onClick={() => set({ theme: k })}
                className="flex items-center gap-2 rounded-md border border-text-muted/30 px-2 py-1 text-xs aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/20"
              >
                <span className="flex h-4 w-8 overflow-hidden rounded-sm">
                  <span className="w-1/2" style={{ backgroundColor: BOARD_THEMES[k].light }} />
                  <span className="w-1/2" style={{ backgroundColor: BOARD_THEMES[k].dark }} />
                </span>
                {t(`profile.boardTheme_${k}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PIECE_SET_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={value.pieceSet === k}
                onClick={() => set({ pieceSet: k })}
                className="flex items-center gap-2 rounded-md border border-text-muted/30 px-2 py-1 text-xs aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/20"
              >
                <img src={PIECE_SETS[k].wN} alt="" className="size-5" />
                {t(`profile.boardPieceSet_${k}`)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.coordinates}
              onChange={(e) => set({ coordinates: e.target.checked })}
            />
            {t('profile.boardCoordinates')}
          </label>
        </div>
        <div className="overflow-hidden rounded-md border border-text-muted/20">
          <Board
            fen={PREVIEW_FEN}
            theme={value.theme}
            pieceSet={value.pieceSet}
            coordinates={value.coordinates}
            label={t('profile.liveBoardPreview')}
          />
        </div>
      </div>
      <ErrorText error={update.error} />
      {saved && (
        <p role="status" className="text-sm text-green">
          {t('boardDefaults.saved')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="cta"
          disabled={update.isPending}
          onClick={() => update.mutate(value, { onSuccess: () => setSaved(true) })}
        >
          {t('common.save')}
        </Button>
        {hasDefaults && (
          <Button
            variant="ghost"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(null, {
                onSuccess: () => {
                  setValue(DEFAULT_BOARD_PREFERENCES);
                  setSaved(true);
                },
              })
            }
          >
            {t('boardDefaults.clear')}
          </Button>
        )}
      </div>
    </Card>
  );
}
