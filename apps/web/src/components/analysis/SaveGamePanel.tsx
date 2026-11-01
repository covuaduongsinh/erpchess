import { useDatabaseMutations, useDatabases } from '@erpchess/api/react';
import { Link } from '@tanstack/react-router';
import { Database, Save } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../../lib/use-t';
import { Button, Card, EmptyState, ErrorText, Field, Spinner } from '../ui';

export const NEW_DATABASE = '__new';

/**
 * Tab "CSDL của tôi" ở bàn phân tích: lưu ván đang phân tích (cả các biến) vào một CSDL riêng tư
 * của người dùng; chưa có thì tạo mới. Chỉ nhân sự (owner/coach) mới tạo được CSDL nên chỉ hiện cho họ.
 */
export function SaveGamePanel({
  academyId,
  userId,
  slug,
  pgn,
  canSave,
}: {
  academyId: string;
  userId: string;
  slug: string;
  /** PGN của ván hiện tại (gọi lúc bấm Lưu, không tính trước). */
  pgn: () => string;
  /** Ván đã có ít nhất một nước. */
  canSave: boolean;
}) {
  const { t } = useT();
  const dbs = useDatabases(academyId);
  const { create, importPgn } = useDatabaseMutations(academyId, userId);
  // CSDL tự đồng bộ từ Lichess/Chess.com do hệ thống quản lý nên không cho lưu tay vào
  const mine = (dbs.data ?? []).filter(
    (d) => d.created_by === userId && d.visibility === 'private' && !d.sync_source,
  );
  const [choice, setChoice] = useState<string>('');
  const [newName, setNewName] = useState(t('analysis.defaultDbName'));
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const target = choice || mine[0]?.id || NEW_DATABASE;
  const creating = target === NEW_DATABASE;
  const busy = pending || create.isPending || importPgn.isPending;

  async function onSave() {
    setError(null);
    setSaved(null);
    setPending(true);
    try {
      let databaseId = target;
      let name = mine.find((d) => d.id === target)?.name ?? '';
      if (creating) {
        const db = await create.mutateAsync({ name: newName, visibility: 'private' });
        databaseId = db.id;
        name = db.name;
        setChoice(db.id);
      }
      const result = await importPgn.mutateAsync({ databaseId, text: pgn() });
      if (result.imported < 1) throw new Error(result.firstError ?? 'import');
      setSaved(name);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title={t('analysis.tabMyDb')}>
      {dbs.isPending ? (
        <Spinner />
      ) : dbs.error ? (
        <ErrorText error={dbs.error} />
      ) : (
        <>
          {mine.length === 0 && (
            <EmptyState dashed icon={Database} title={t('analysis.myDbEmpty')} />
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('analysis.saveInto')}</span>
            <select
              value={target}
              onChange={(e) => setChoice(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2"
            >
              {mine.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value={NEW_DATABASE}>{t('analysis.newDatabase')}</option>
            </select>
          </label>
          {creating && (
            <Field
              label={t('analysis.newDatabaseName')}
              value={newName}
              maxLength={120}
              onChange={(e) => setNewName(e.target.value)}
            />
          )}
          {!canSave && <p className="text-sm text-text-muted">{t('analysis.saveNeedMoves')}</p>}
          <Button
            className="self-start"
            variant="cta"
            icon={Save}
            disabled={!canSave || busy || (creating && !newName.trim())}
            onClick={() => void onSave()}
          >
            {busy ? t('analysis.saving') : t('analysis.saveGame')}
          </Button>
          <ErrorText error={error} />
          {saved && (
            <p role="status" className="text-sm text-green">
              {t('analysis.savedTo', { name: saved })}{' '}
              <Link
                to="/a/$slug/database"
                params={{ slug }}
                className="font-medium text-primary underline"
              >
                {t('analysis.openDatabases')}
              </Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
