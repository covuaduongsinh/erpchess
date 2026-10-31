import {
  type LichessStudySummary,
  listLichessStudies,
  parseLichessStudyInput,
} from '@erpchess/api';
import { useImportLichessStudies } from '@erpchess/api/react';
import { type FormEvent, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { Button, ErrorText, Field } from '../ui';

/**
 * Nhập hàng loạt study Lichess công khai (Giai đoạn 24c, đặc tả REA: Study → Import from Lichess →
 * Public studies): nhập tên người dùng hoặc link study, chọn các study, mỗi study thành một study
 * erpchess; chương từ thế cờ riêng thành puzzle, còn lại thành xem ván.
 */
export function LichessImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const imp = useImportLichessStudies(academy.id, session.user.id);
  const [input, setInput] = useState('');
  const [list, setList] = useState<LichessStudySummary[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<unknown>(null);

  async function browse(e: FormEvent) {
    e.preventDefault();
    setBrowseError(null);
    const parsed = parseLichessStudyInput(input);
    if (!parsed) {
      setBrowseError(new Error(t('lichessImport.invalid')));
      return;
    }
    if (parsed.kind === 'study') {
      setList([{ id: parsed.id, name: parsed.id, updatedAt: 0 }]);
      setPicked([parsed.id]);
      return;
    }
    setBrowsing(true);
    try {
      const rows = await listLichessStudies(parsed.username);
      setList(rows);
      setPicked([]);
    } catch (err) {
      setBrowseError(err);
    } finally {
      setBrowsing(false);
    }
  }

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('lichessImport.title')}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
    >
      <button
        type="button"
        aria-label={t('lichessImport.close')}
        onClick={onClose}
        className="fixed inset-0 bg-black/50"
      />
      <div className="relative z-10 my-8 flex w-full max-w-xl flex-col gap-4 rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-primary">{t('lichessImport.title')}</h2>
        <p className="text-sm text-text-muted">{t('lichessImport.hint')}</p>
        <form onSubmit={browse} className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              label={t('lichessImport.input')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="thibault, @user, https://lichess.org/study/…"
            />
          </div>
          <Button type="submit" variant="ghost" disabled={!input.trim() || browsing}>
            {browsing ? t('common.loading') : t('lichessImport.browse')}
          </Button>
        </form>
        <ErrorText error={browseError} />

        {list && list.length === 0 && (
          <p className="text-sm text-text-muted">{t('lichessImport.none')}</p>
        )}
        {list && list.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-text-muted">
              <span>{t('lichessImport.picked', { count: picked.length })}</span>
              <button
                type="button"
                className="underline"
                onClick={() =>
                  setPicked(picked.length === list.length ? [] : list.map((s) => s.id))
                }
              >
                {picked.length === list.length
                  ? t('lichessImport.none_all')
                  : t('lichessImport.all')}
              </button>
            </div>
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {list.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    <span className="flex-1">{s.name}</span>
                    <span className="font-mono text-xs text-text-muted">{s.id}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {imp.isPending && imp.progress && (
          <p className="text-sm">
            {t('lichessImport.progress', { done: imp.progress.done, total: imp.progress.total })}
          </p>
        )}
        <ErrorText error={imp.error} />
        {imp.data && (
          <ul role="status" className="flex flex-col gap-1 text-sm">
            {imp.data.map((r) => (
              <li key={r.lichessId} className={r.studyId ? 'text-green' : 'text-danger'}>
                {r.studyId
                  ? t('lichessImport.done', {
                      title: r.title,
                      count: r.activities,
                      skipped: r.skipped,
                    })
                  : t('lichessImport.failed', { title: r.title })}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 border-t border-text-muted/15 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('lichessImport.close')}
          </Button>
          <Button
            type="button"
            variant="cta"
            disabled={picked.length === 0 || imp.isPending}
            onClick={() => imp.mutate(picked)}
          >
            {t('lichessImport.import', { count: picked.length })}
          </Button>
        </div>
      </div>
    </div>
  );
}
