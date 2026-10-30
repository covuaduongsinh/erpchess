import {
  BOARD_THEMES,
  Board,
  type BoardTheme,
  PIECE_SETS,
  type PieceSet,
} from '@erpchess/board-web';
import { useBoardPreferences } from '../../lib/use-board-preferences';
import { useT } from '../../lib/use-t';
import { Card } from '../ui';

const PREVIEW_FEN = 'r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQ1RK1 w kq - 3 9';

const THEME_KEYS: BoardTheme[] = ['navy', 'green', 'wood', 'blue', 'charcoal'];
const PIECE_SET_KEYS: PieceSet[] = ['celtic', 'spatial'];

export function BoardPreferencesCard() {
  const { t } = useT();
  const {
    preferences,
    setTheme,
    setPieceSet,
    setCoordinates,
    setSoundEnabled,
    setAutoFlip,
    resetPreferences,
  } = useBoardPreferences();

  return (
    <Card title={t('profile.boardCustomizerTitle')}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: Các tùy chọn cài đặt */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <p className="text-sm text-text-muted">{t('profile.boardCustomizerSubtitle')}</p>
          <p className="text-xs text-text-muted">{t('profile.boardSyncHint')}</p>

          {/* Chọn Theme màu bàn cờ */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t('profile.boardTheme')}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {THEME_KEYS.map((themeKey) => {
                const colors = BOARD_THEMES[themeKey];
                const isSelected = preferences.theme === themeKey;
                return (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => setTheme(themeKey)}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10'
                        : 'border-border/60 hover:border-border hover:bg-surface-2/50'
                    }`}
                  >
                    {/* Swatch màu ô sáng / ô tối */}
                    <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-md border border-slate-300 shadow-xs">
                      <div className="w-1/2 h-full" style={{ backgroundColor: colors.light }} />
                      <div className="w-1/2 h-full" style={{ backgroundColor: colors.dark }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {t(`profile.boardTheme_${themeKey}`)}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-primary">✓ Đang chọn</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chọn bộ quân cờ */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t('profile.boardPieceSet')}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PIECE_SET_KEYS.map((setKey) => {
                const isSelected = preferences.pieceSet === setKey;
                return (
                  <button
                    key={setKey}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setPieceSet(setKey)}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10'
                        : 'border-border/60 hover:border-border hover:bg-surface-2/50'
                    }`}
                  >
                    <img src={PIECE_SETS[setKey].wN} alt="" className="h-8 w-8 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {t(`profile.boardPieceSet_${setKey}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Công tắc Tọa độ bàn cờ */}
          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {t('profile.boardCoordinates')}
              </span>
              <span className="text-xs text-text-muted">{t('profile.boardCoordinatesHint')}</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.coordinates}
              onChange={(e) => setCoordinates(e.target.checked)}
              aria-label={t('profile.boardCoordinates')}
              className="size-4.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          {/* Công tắc Âm thanh */}
          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {t('profile.boardSound')}
              </span>
              <span className="text-xs text-text-muted">{t('profile.boardSoundHint')}</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              aria-label={t('profile.boardSound')}
              className="size-4.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          {/* Công tắc Tự động xoay bàn */}
          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {t('profile.boardAutoFlip')}
              </span>
              <span className="text-xs text-text-muted">{t('profile.boardAutoFlipHint')}</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.autoFlip}
              onChange={(e) => setAutoFlip(e.target.checked)}
              aria-label={t('profile.boardAutoFlip')}
              className="size-4.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={resetPreferences}
              className="text-xs text-text-muted hover:text-danger hover:underline cursor-pointer"
            >
              ↺ Đặt lại thiết lập bàn cờ mặc định
            </button>
          </div>
        </div>

        {/* Cột phải: Live Preview Bàn cờ */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-border/40">
          <span className="text-xs font-semibold text-text-muted mb-2.5 uppercase tracking-wider">
            {t('profile.liveBoardPreview')}
          </span>
          <div className="w-full max-w-[300px] overflow-hidden rounded-lg shadow-sm border border-border/50">
            <Board
              fen={PREVIEW_FEN}
              theme={preferences.theme}
              pieceSet={preferences.pieceSet}
              coordinates={preferences.coordinates}
              orientation="w"
              label={t('profile.liveBoardPreview')}
            />
          </div>
          <span className="text-[11px] text-text-muted mt-2 text-center">
            {t(`profile.boardTheme_${preferences.theme}`)} ·{' '}
            {preferences.coordinates ? 'Tọa độ: Bật' : 'Tọa độ: Tắt'}
          </span>
        </div>
      </div>
    </Card>
  );
}
