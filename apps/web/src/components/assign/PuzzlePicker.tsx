import type { PuzzleRow } from '@erpchess/api';
import { usePuzzles } from '@erpchess/api/react';
import { puzzleSideToMove } from '@erpchess/chess-core';
import { useMemo, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT, useThemeLabel } from '../../lib/use-t';
import { PreferredBoard } from '../board/PreferredBoard';
import { ErrorText, Spinner } from '../ui';

/** Chọn puzzle từ thư viện (lọc chủ đề, xem trước). Dùng cho bài tập, Exercise, Quiz. */
export function PuzzlePicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useT();
  const themeLabel = useThemeLabel();
  const { academy } = useAcademy();
  const puzzles = usePuzzles(academy.id);
  const [theme, setTheme] = useState('');
  const [preview, setPreview] = useState<PuzzleRow | null>(null);

  const themes = useMemo(
    () => [...new Set((puzzles.data ?? []).flatMap((p) => p.themes))].sort(),
    [puzzles.data],
  );
  if (puzzles.isPending) return <Spinner />;
  if (puzzles.error) return <ErrorText error={puzzles.error} />;
  const list = theme ? puzzles.data.filter((p) => p.themes.includes(theme)) : puzzles.data;
  const shown = preview ?? list[0];

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('assignments.theme')}</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">{t('assignments.allThemes')}</option>
            {themes.map((th) => (
              <option key={th} value={th}>
                {themeLabel(th)}
              </option>
            ))}
          </select>
        </label>
        <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
          {list.map((p) => (
            <li key={p.id}>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-bg"
                onMouseEnter={() => setPreview(p)}
                onFocus={() => setPreview(p)}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(p.id)}
                  onChange={() => onToggle(p.id)}
                />
                <span className="flex flex-col">
                  <span className="font-medium">
                    {selected.includes(p.id) && (
                      <span className="mr-1 text-primary">#{selected.indexOf(p.id) + 1}</span>
                    )}
                    {p.title}
                  </span>
                  <span className="text-xs text-text-muted">
                    {t('puzzle.rating', { rating: p.rating })} ·{' '}
                    {p.themes.map(themeLabel).join(', ')}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      {shown && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
            {t('assignments.preview')}
          </p>
          <PreferredBoard
            fen={shown.fen}
            orientation={puzzleSideToMove(shown)}
            coordinates={false}
            sound={false}
            label={shown.title}
          />
          <p className="text-sm">{shown.title}</p>
          <p className="text-xs text-text-muted">{t(`puzzle.toMove_${puzzleSideToMove(shown)}`)}</p>
        </div>
      )}
    </div>
  );
}
