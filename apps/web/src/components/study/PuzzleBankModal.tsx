import { usePuzzleBankSearch, useSearchPuzzleBankNow } from '@erpchess/api/react';
import { lichessToStudyPuzzle, sideToMove } from '@erpchess/chess-core';
import {
  type ActivityInput,
  type ActivitySettings,
  PUZZLE_BANK_MAX_LIMIT,
  PUZZLE_THEMES,
  type PuzzleBankRow,
  pickSpread,
  puzzleThemeLabel,
} from '@erpchess/domain';
import { useMemo, useState } from 'react';
import { useT } from '../../lib/use-t';
import { PreferredBoard } from '../board/PreferredBoard';
import { Button, ErrorText, Modal, Spinner } from '../ui';

const PAGE_SIZE = 12;
const MOVES_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10] as const;

/** Đổi một puzzle của kho thành đầu vào hoạt động puzzle của study, theo cấu hình mặc định của học viện (24d). */
export function bankRowToActivity(
  row: PuzzleBankRow,
  settings: ActivitySettings,
  title: string,
): ActivityInput | null {
  const puzzle = lichessToStudyPuzzle(row.fen, row.moves);
  if (!puzzle) return null;
  return {
    kind: 'puzzle',
    payload: puzzle,
    title,
    points: settings.points,
    maxAttempts: settings.maxAttempts,
    timeLimitS: settings.timeLimitS,
    wrongPenalty: settings.wrongPenalty,
    topics: row.themes.slice(0, 20).map((t) => t.slice(0, 40)),
  };
}

const toNumber = (v: string): number | null => {
  const n = Number(v);
  return v.trim() === '' || !Number.isFinite(n) ? null : n;
};

/**
 * "Thêm từ kho puzzle" (Giai đoạn 27c): lọc theo chủ đề / rating / số nước, xem bàn cờ nhỏ, chọn nhiều (cả khi
 * đổi trang hay đổi bộ lọc), chọn ngẫu nhiên trải đều rating thay cho AI, rồi thêm hàng loạt vào học liệu.
 */
export function PuzzleBankModal({
  settings,
  onAdd,
  onClose,
}: {
  /** Cấu hình mặc định của học viện cho hoạt động puzzle (24d). */
  settings: ActivitySettings;
  /** Thêm lần lượt các hoạt động vào study; `progress` báo số đã thêm. */
  onAdd: (inputs: ActivityInput[], progress: (done: number) => void) => Promise<void>;
  onClose: () => void;
}) {
  const { t, i18n } = useT();
  const locale = i18n.language === 'en' ? 'en' : 'vi';
  const [themes, setThemes] = useState<string[]>([]);
  const [ratingMin, setRatingMin] = useState('');
  const [ratingMax, setRatingMax] = useState('');
  const [movesMax, setMovesMax] = useState('');
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Map<number, PuzzleBankRow>>(new Map());
  const [randomN, setRandomN] = useState('10');
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const filter = useMemo(
    () => ({
      themes,
      ratingMin: toNumber(ratingMin),
      ratingMax: toNumber(ratingMax),
      movesMax: toNumber(movesMax),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [themes, ratingMin, ratingMax, movesMax, page],
  );
  const hasFilter =
    themes.length > 0 ||
    filter.ratingMin !== null ||
    filter.ratingMax !== null ||
    filter.movesMax !== null;
  const search = usePuzzleBankSearch(filter);
  const searchNow = useSearchPuzzleBankNow();
  const rows = search.data?.rows ?? [];
  const total = search.data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  function changeFilter(update: () => void) {
    update();
    setPage(0);
    setResult(null);
  }
  function toggleTheme(key: string) {
    changeFilter(() =>
      setThemes((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])),
    );
  }
  function togglePick(row: PuzzleBankRow) {
    setResult(null);
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  }

  async function pickRandom() {
    setError(null);
    setResult(null);
    try {
      const n = Math.min(Math.max(Math.floor(Number(randomN) || 0), 1), PUZZLE_BANK_MAX_LIMIT);
      // Mẫu ứng viên: tối đa 100 puzzle từ một vị trí ngẫu nhiên trong kết quả đang lọc
      const first = await searchNow({ ...filter, limit: 1, offset: 0 });
      const count = first.total;
      if (count === 0) return;
      const offset = Math.floor(Math.random() * Math.max(1, count - PUZZLE_BANK_MAX_LIMIT + 1));
      const pool = await searchNow({ ...filter, limit: PUZZLE_BANK_MAX_LIMIT, offset });
      const usable = pool.rows.filter((r) => lichessToStudyPuzzle(r.fen, r.moves) !== null);
      const chosen = pickSpread(usable, n);
      setPicked((cur) => {
        const next = new Map(cur);
        for (const r of chosen) next.set(r.id, r);
        return next;
      });
    } catch (e) {
      setError(e);
    }
  }

  async function addAll() {
    setError(null);
    setResult(null);
    const inputs: ActivityInput[] = [];
    let skipped = 0;
    for (const row of [...picked.values()].sort((a, b) => a.rating - b.rating)) {
      const input = bankRowToActivity(
        row,
        settings,
        t('puzzleBank.activityTitle', { rating: row.rating }),
      );
      if (input) inputs.push(input);
      else skipped++;
    }
    setBusy({ done: 0, total: inputs.length });
    try {
      await onAdd(inputs, (done) => setBusy({ done, total: inputs.length }));
      setResult({ added: inputs.length, skipped });
      setPicked(new Map());
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title={t('puzzleBank.title')} onClose={onClose} wide>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('puzzleBank.themes')}</legend>
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {PUZZLE_THEMES.map((th) => (
            <button
              key={th.key}
              type="button"
              aria-pressed={themes.includes(th.key)}
              onClick={() => toggleTheme(th.key)}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-muted hover:bg-primary-soft aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
            >
              {th[locale]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('puzzleBank.ratingFrom')}</span>
          <input
            type="number"
            min={100}
            max={4000}
            value={ratingMin}
            placeholder="800"
            onChange={(e) => changeFilter(() => setRatingMin(e.target.value))}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('puzzleBank.ratingTo')}</span>
          <input
            type="number"
            min={100}
            max={4000}
            value={ratingMax}
            placeholder="2800"
            aria-label={`${t('puzzleBank.ratingFrom')} ${t('puzzleBank.ratingTo')}`}
            onChange={(e) => changeFilter(() => setRatingMax(e.target.value))}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('puzzleBank.movesMax')}</span>
          <select
            value={movesMax}
            onChange={(e) => changeFilter(() => setMovesMax(e.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1.5"
          >
            <option value="">{t('puzzleBank.anyMoves')}</option>
            {MOVES_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {t('puzzleBank.movesN', { count: n })}
              </option>
            ))}
          </select>
        </label>
        {hasFilter && (
          <Button
            variant="ghost"
            onClick={() =>
              changeFilter(() => {
                setThemes([]);
                setRatingMin('');
                setRatingMax('');
                setMovesMax('');
              })
            }
          >
            {t('puzzleBank.clearFilters')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md bg-bg p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('puzzleBank.randomCount')}</span>
          <input
            type="number"
            min={1}
            max={PUZZLE_BANK_MAX_LIMIT}
            value={randomN}
            onChange={(e) => setRandomN(e.target.value)}
            className="w-20 rounded-md border border-border bg-surface px-2 py-1.5"
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => void pickRandom()}
          disabled={total === 0 || busy !== null}
        >
          {t('puzzleBank.randomButton')}
        </Button>
        <p className="w-full text-xs text-text-muted sm:min-w-0 sm:flex-1">
          {t('puzzleBank.randomHint')}
        </p>
      </div>

      {search.isPending ? (
        <Spinner />
      ) : search.error ? (
        <ErrorText error={search.error} />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-text-muted">
          {hasFilter ? t('puzzleBank.noMatch') : t('puzzleBank.emptyBank')}
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {rows.map((row) => {
              const puzzle = lichessToStudyPuzzle(row.fen, row.moves);
              const checked = picked.has(row.id);
              const side = puzzle ? sideToMove(puzzle.fen) : 'w';
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-1.5 rounded-md border border-border p-2 data-[picked=true]:border-primary data-[picked=true]:bg-primary-soft"
                  data-picked={checked}
                >
                  {puzzle ? (
                    <PreferredBoard
                      fen={puzzle.fen}
                      orientation={side}
                      coordinates={false}
                      sound={false}
                      label={t('puzzleBank.board', { id: row.lichessId })}
                    />
                  ) : (
                    <div className="aspect-square rounded bg-bg" />
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!puzzle}
                      onChange={() => togglePick(row)}
                      aria-label={t('puzzleBank.pickPuzzle', {
                        id: row.lichessId,
                        rating: row.rating,
                      })}
                    />
                    <span className="font-semibold">
                      {t('puzzleBank.ratingOf', { rating: row.rating })}
                    </span>
                    <span className="ml-auto text-xs text-text-muted">
                      {t('puzzleBank.toMove', {
                        side: t(side === 'w' ? 'puzzleBank.white' : 'puzzleBank.black'),
                      })}
                    </span>
                  </label>
                  <p className="line-clamp-2 text-xs text-text-muted">
                    {row.themes
                      .slice(0, 4)
                      .map((k) => puzzleThemeLabel(k, locale))
                      .join(' · ')}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-text-muted">
              {t('puzzleBank.results', {
                from: page * PAGE_SIZE + 1,
                to: page * PAGE_SIZE + rows.length,
                total,
              })}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                {t('puzzleBank.prev')}
              </Button>
              <Button
                variant="ghost"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('puzzleBank.next')}
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-surface pt-3">
        <ErrorText error={error} />
        {result && (
          <p role="status" className="text-sm text-green">
            {t('puzzleBank.added', { count: result.added })}
            {result.skipped > 0 && ` ${t('puzzleBank.skipped', { count: result.skipped })}`}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {t('puzzleBank.selected', { count: picked.size })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={picked.size === 0 || busy !== null}
              onClick={() => setPicked(new Map())}
            >
              {t('puzzleBank.clearSelection')}
            </Button>
            <Button
              variant="cta"
              disabled={picked.size === 0 || busy !== null}
              onClick={() => void addAll()}
            >
              {busy
                ? t('puzzleBank.adding', { done: busy.done, total: busy.total })
                : t('puzzleBank.add', { count: picked.size })}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
