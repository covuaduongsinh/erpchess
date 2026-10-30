import {
  fetchLichessStudyPgn,
  fetchLichessUserGames,
  type GameDatabase,
  lichessStudyId,
  lichessUsername,
} from '@erpchess/api';
import { useDatabaseMutations, useDatabases, useGamePgn, useGames } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { GameSyncCard } from '../components/database/GameSyncCards';
import { GameViewer } from '../components/study/GameViewer';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/database')({
  component: DatabasePage,
});

const PAGE_SIZE = 50;

function DatabasePage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const dbs = useDatabases(academy.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const current = dbs.data?.find((d) => d.id === selected) ?? dbs.data?.[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        {academy.role !== 'parent' && (
          <GameSyncCard
            academyId={academy.id}
            userId={session.user.id}
            onSynced={(id) => {
              setSelected(id);
              setGameId(null);
            }}
          />
        )}
        <Card title={t('database.title')}>
          {dbs.isPending ? (
            <Spinner />
          ) : dbs.error ? (
            <ErrorText error={dbs.error} />
          ) : dbs.data.length === 0 ? (
            <p className="text-text-muted">{t('database.none')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {dbs.data.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    aria-pressed={current?.id === d.id}
                    onClick={() => {
                      setSelected(d.id);
                      setGameId(null);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-bg aria-pressed:bg-primary/10"
                  >
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-text-muted">
                      {d.sync_source
                        ? `⟳ ${t('gameSync.synced')}`
                        : d.visibility === 'academy'
                          ? t('database.shared')
                          : t('database.private')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {staff && <CreateDatabaseForm onCreated={setSelected} />}
        </Card>
        {current && <ImportCard key={current.id} database={current} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={current?.name ?? t('database.games')}>
          {current ? (
            <GameList databaseId={current.id} selected={gameId} onSelect={setGameId} />
          ) : (
            <p className="text-text-muted">{t('database.pickDatabase')}</p>
          )}
        </Card>

        <Card title={t('database.viewer')}>
          {gameId ? (
            <SelectedGame gameId={gameId} />
          ) : (
            <p className="text-text-muted">{t('database.pickGame')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function CreateDatabaseForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { create } = useDatabaseMutations(academy.id, session.user.id);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, visibility: shared ? 'academy' : 'private' },
      {
        onSuccess: (db) => {
          setName('');
          onCreated(db.id);
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Field
        label={t('database.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        {t('database.shareWithAcademy')}
      </label>
      <ErrorText error={create.error} />
      <Button type="submit" variant="cta" className="self-start" disabled={create.isPending}>
        {t('database.create')}
      </Button>
    </form>
  );
}

function ImportCard({ database }: { database: GameDatabase }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { importPgn, remove, progress } = useDatabaseMutations(academy.id, session.user.id);
  const [text, setText] = useState('');
  const [lichess, setLichess] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const owned = database.created_by === session.user.id || academy.role === 'owner';

  function run(pgn: string) {
    importPgn.mutate({ databaseId: database.id, text: pgn }, { onSuccess: () => setText('') });
  }

  /** Nhận tên người chơi (lấy 50 ván gần nhất) hoặc link/mã study công khai. */
  async function fromLichess(e: FormEvent) {
    e.preventDefault();
    setFetchError(null);
    const study = lichessStudyId(lichess);
    const user = study ? null : lichessUsername(lichess);
    if (!study && !user) {
      setFetchError(new Error(t('database.lichessInvalid')));
      return;
    }
    setFetching(true);
    try {
      run(study ? await fetchLichessStudyPgn(study) : await fetchLichessUserGames(user ?? '', 50));
      setLichess('');
    } catch (err) {
      setFetchError(err);
    } finally {
      setFetching(false);
    }
  }

  const result = importPgn.data;
  return (
    <Card title={t('database.import')}>
      {owned ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('database.pgnFile')}</span>
            <input
              type="file"
              accept=".pgn,application/x-chess-pgn,text/plain"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) run(await file.text());
                e.target.value = '';
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('database.pastePgn')}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="rounded-md border border-text-muted/30 bg-white px-3 py-2 font-mono text-xs"
            />
          </label>
          <Button
            variant="cta"
            className="self-start"
            disabled={!text.trim() || importPgn.isPending}
            onClick={() => run(text)}
          >
            {t('database.importRun')}
          </Button>
          <form onSubmit={fromLichess} className="flex flex-col gap-2">
            <Field
              label={t('database.lichess')}
              hint={t('database.lichessHint')}
              value={lichess}
              onChange={(e) => setLichess(e.target.value)}
            />
            <Button
              type="submit"
              variant="ghost"
              className="self-start"
              disabled={!lichess.trim() || fetching || importPgn.isPending}
            >
              {fetching ? t('common.loading') : t('database.lichessRun')}
            </Button>
          </form>
          {importPgn.isPending && progress && (
            <p className="text-sm">
              {t('database.importProgress', { done: progress.done, total: progress.total })}
            </p>
          )}
          <ErrorText error={fetchError ?? importPgn.error ?? remove.error} />
          {result && (
            <p role="status" className="text-sm text-green">
              {t('database.importDone', { imported: result.imported, failed: result.failed })}
            </p>
          )}
          <Button
            variant="ghost"
            className="self-start text-danger"
            disabled={remove.isPending}
            onClick={() => (confirmDelete ? remove.mutate(database.id) : setConfirmDelete(true))}
          >
            {confirmDelete ? t('database.confirmDelete') : t('database.delete')}
          </Button>
        </>
      ) : (
        <p className="text-sm text-text-muted">{t('database.readOnly')}</p>
      )}
    </Card>
  );
}

function GameList({
  databaseId,
  selected,
  onSelect,
}: {
  databaseId: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const games = useGames(databaseId, search, page);
  const total = games.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={t('database.search')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      {games.isPending ? (
        <Spinner />
      ) : games.error ? (
        <ErrorText error={games.error} />
      ) : games.data.rows.length === 0 ? (
        <p className="text-text-muted">{t('database.noGames')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-text-muted/10">
          {games.data.rows.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                aria-pressed={selected === g.id}
                onClick={() => onSelect(g.id)}
                className="flex w-full items-start justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-bg aria-pressed:bg-primary/10"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {g.white || '?'}
                    {g.white_elo ? <span className="text-text-muted"> ({g.white_elo})</span> : null}
                    {' – '}
                    {g.black || '?'}
                    {g.black_elo ? <span className="text-text-muted"> ({g.black_elo})</span> : null}
                  </span>
                  {(g.event || g.date) && (
                    <span className="truncate text-xs text-text-muted">
                      {[g.event, g.date].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs">{g.result}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          ◀
        </Button>
        <span>{t('database.page', { page: page + 1, pages, total })}</span>
        <Button variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
          ▶
        </Button>
      </div>
    </div>
  );
}

function SelectedGame({ gameId }: { gameId: string }) {
  const { t } = useT();
  const pgn = useGamePgn(gameId);
  if (pgn.isPending) return <Spinner />;
  if (pgn.error) return <ErrorText error={pgn.error} />;
  return (
    <GameViewer pgn={pgn.data} showAnalysisToggle>
      {(fen) => (
        <Link
          to="/analysis"
          search={{ fen }}
          className="self-start rounded-md px-4 py-2 font-medium text-primary hover:bg-primary/10"
        >
          {t('database.openAnalysis')}
        </Link>
      )}
    </GameViewer>
  );
}
