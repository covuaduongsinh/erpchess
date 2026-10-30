import type { SyncSource } from '@erpchess/api';
import { useProfile, useSyncGames, useUpdateProfile } from '@erpchess/api/react';
import { Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText, Field } from '../ui';

const SOURCES: Array<{ source: SyncSource; label: string }> = [
  { source: 'chesscom', label: 'Chess.com' },
  { source: 'lichess', label: 'Lichess' },
];

/**
 * Hồ sơ: username Chess.com / Lichess để đồng bộ ván (Giai đoạn 23c, giống mục "Sync Games" của
 * Chesslang). Để trống là bỏ liên kết.
 */
export function GameSyncIdsCard({ userId }: { userId: string }) {
  const { t } = useT();
  const profile = useProfile(userId);
  const update = useUpdateProfile(userId);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '').trim();
    setSaved(false);
    update.mutate(
      {
        chesscomUsername: text('chesscom') || null,
        lichessUsername: text('lichess') || null,
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <Card title={t('gameSync.title')}>
      <p className="text-sm text-text-muted">{t('gameSync.hint')}</p>
      <form key={profile.data?.id ?? 'loading'} onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('gameSync.chesscom')}
            name="chesscom"
            maxLength={25}
            defaultValue={profile.data?.chesscom_username ?? ''}
            placeholder="username"
          />
          <Field
            label={t('gameSync.lichess')}
            name="lichess"
            maxLength={30}
            defaultValue={profile.data?.lichess_username ?? ''}
            placeholder="username"
          />
        </div>
        <ErrorText error={update.error} />
        {saved && (
          <p role="status" className="text-sm text-green">
            {t('gameSync.saved')}
          </p>
        )}
        <Button type="submit" variant="cta" className="self-start" disabled={update.isPending}>
          {t('gameSync.saveIds')}
        </Button>
      </form>
    </Card>
  );
}

/** Trang Database: đồng bộ ván mới từ Chess.com / Lichess vào CSDL riêng của mình. */
export function GameSyncCard({
  academyId,
  userId,
  onSynced,
}: {
  academyId: string;
  userId: string;
  onSynced: (databaseId: string) => void;
}) {
  const { t } = useT();
  const profile = useProfile(userId);
  const sync = useSyncGames(academyId, userId);
  const names: Record<SyncSource, string | null> = {
    chesscom: profile.data?.chesscom_username ?? null,
    lichess: profile.data?.lichess_username ?? null,
  };
  const none = !names.chesscom && !names.lichess;

  return (
    <Card title={t('gameSync.title')}>
      {none ? (
        <p className="text-sm text-text-muted">
          {t('gameSync.noIds')}{' '}
          <Link to="/profile" className="text-primary underline">
            {t('profile.title')}
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {SOURCES.filter((s) => names[s.source]).map((s) => (
            <Button
              key={s.source}
              variant="ghost"
              disabled={sync.isPending}
              onClick={() =>
                sync.mutate(
                  { source: s.source, username: names[s.source] ?? '' },
                  { onSuccess: (r) => onSynced(r.databaseId) },
                )
              }
            >
              ⟳ {s.label} · {names[s.source]}
            </Button>
          ))}
        </div>
      )}
      {sync.isPending && <p className="text-sm">{t('gameSync.running')}</p>}
      <ErrorText error={sync.error} />
      {sync.data && (
        <p role="status" className="text-sm text-green">
          {sync.data.fetched === 0
            ? t('gameSync.upToDate')
            : t('gameSync.done', { imported: sync.data.imported, failed: sync.data.failed })}
        </p>
      )}
      <p className="text-[11px] text-text-muted">{t('gameSync.note')}</p>
    </Card>
  );
}
