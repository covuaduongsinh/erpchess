import type { PracticePosition } from '@erpchess/api';
import {
  useMembers,
  usePracticeChapter,
  usePracticeMutations,
  usePracticeResults,
} from '@erpchess/api/react';
import { Board, BoardEditor } from '@erpchess/board-web';
import { isValidFen, START_FEN } from '@erpchess/chess-core';
import { isStaff } from '@erpchess/domain';
import { BOT_LEVELS } from '@erpchess/engine';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { EngineGame } from '../components/study/ActivityPlayer';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/practice/$id')({
  component: ChapterPage,
});

function ChapterPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const chapter = usePracticeChapter(id);
  const staff = isStaff(academy.role);
  const [playing, setPlaying] = useState<PracticePosition | null>(null);
  const [adding, setAdding] = useState(false);
  const positionIds = useMemo(() => chapter.data?.positions.map((p) => p.id) ?? [], [chapter.data]);
  const results = usePracticeResults(positionIds);
  const members = useMembers(academy.id);

  if (chapter.isPending) return <Spinner />;
  if (chapter.error) return <ErrorText error={chapter.error} />;
  const c = chapter.data;
  const canEdit =
    academy.role === 'owner' || (academy.role === 'coach' && c.created_by === session.user.id);
  const name = (sid: string) =>
    members.data?.find((m) => m.profile.id === sid)?.profile.display_name ?? '?';

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/a/$slug/practice"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('practice.title')}
      </Link>
      <h2 className="text-2xl font-bold text-primary">{c.title}</h2>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card title={t('practice.positions')}>
          {c.positions.length === 0 && (
            <p className="text-text-muted">{t('practice.noPositions')}</p>
          )}
          <ul className="flex flex-col gap-2">
            {c.positions.map((p, i) => {
              const mine =
                results.data?.filter(
                  (r) => r.position_id === p.id && r.student_id === session.user.id,
                ) ?? [];
              const best = mine.some((r) => r.result === 'win')
                ? 'win'
                : mine.some((r) => r.result === 'draw')
                  ? 'draw'
                  : null;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={playing?.id === p.id}
                    onClick={() => {
                      setAdding(false);
                      setPlaying(p);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-bg aria-pressed:bg-primary/10"
                  >
                    <div className="w-16 shrink-0">
                      <Board
                        fen={p.fen}
                        orientation={p.side === 'b' ? 'b' : 'w'}
                        coordinates={false}
                        label={p.title || `#${i + 1}`}
                      />
                    </div>
                    <span className="flex flex-col text-sm">
                      <span className="font-medium">{p.title || `#${i + 1}`}</span>
                      <span className="text-text-muted">
                        {p.goal === 'win' ? t('studies.goalWin') : t('studies.goalDraw')} ·{' '}
                        {p.elo ? `Elo ${p.elo}` : t('studies.fullStrength')}
                        {best && ` · ${t(`player.result_${best}`)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {canEdit && (
            <Button
              variant="ghost"
              className="self-start"
              onClick={() => {
                setPlaying(null);
                setAdding(true);
              }}
            >
              + {t('practice.addPosition')}
            </Button>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          {adding && canEdit && (
            <AddPosition
              chapterId={id}
              position={(c.positions.at(-1)?.position ?? -1) + 1}
              onDone={() => setAdding(false)}
            />
          )}
          {playing && (
            <PlayPosition
              key={playing.id}
              position={playing}
              chapterId={id}
              canEdit={canEdit}
              onDeleted={() => setPlaying(null)}
            />
          )}
          {!adding && !playing && (
            <Card title={t('practice.pick')}>
              <p className="text-text-muted">{t('practice.pickHint')}</p>
            </Card>
          )}
          {staff && (results.data?.length ?? 0) > 0 && (
            <Card title={t('practice.results')}>
              <ul className="flex flex-col gap-1 text-sm">
                {results.data?.slice(0, 30).map((r) => {
                  const pos = c.positions.find((p) => p.id === r.position_id);
                  return (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span>
                        {name(r.student_id)} · {pos?.title || '#'}
                      </span>
                      <span
                        className={
                          r.result === 'win'
                            ? 'text-green'
                            : r.result === 'loss'
                              ? 'text-danger'
                              : ''
                        }
                      >
                        {t(`player.result_${r.result as 'win' | 'draw' | 'loss'}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayPosition({
  position,
  chapterId,
  canEdit,
  onDeleted,
}: {
  position: PracticePosition;
  chapterId: string;
  canEdit: boolean;
  onDeleted: () => void;
}) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { recordResult, deletePosition } = usePracticeMutations(academy.id, session.user.id);
  return (
    <Card title={position.title || t('practice.position')}>
      <EngineGame
        payload={{
          fen: position.fen,
          side: position.side === 'b' ? 'b' : 'w',
          elo: position.elo,
          goal: position.goal === 'draw' ? 'draw' : 'win',
        }}
        disabled={false}
        onFinish={(result) => recordResult.mutate({ positionId: position.id, result, moves: 0 })}
      />
      <div className="flex gap-2">
        {canEdit && (
          <Button
            variant="ghost"
            className="ml-auto text-danger"
            disabled={deletePosition.isPending}
            onClick={() =>
              deletePosition.mutate({ chapterId, id: position.id }, { onSuccess: onDeleted })
            }
          >
            {t('studies.delete')}
          </Button>
        )}
      </div>
      <ErrorText error={recordResult.error ?? deletePosition.error} />
    </Card>
  );
}

function AddPosition({
  chapterId,
  position,
  onDone,
}: {
  chapterId: string;
  position: number;
  onDone: () => void;
}) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { addPosition } = usePracticeMutations(academy.id, session.user.id);
  const [fen, setFen] = useState(START_FEN);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<'win' | 'draw'>('win');
  const [elo, setElo] = useState(String(BOT_LEVELS[0].elo));
  const side = fen.split(' ')[1] === 'b' ? 'b' : 'w';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    addPosition.mutate(
      { chapterId, position, input: { title, fen, side, goal, elo: elo ? Number(elo) : null } },
      { onSuccess: onDone },
    );
  }

  return (
    <Card title={t('practice.addPosition')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field
          label={t('studies.activityTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
        />
        <BoardEditor
          fen={fen}
          onChange={setFen}
          labels={{
            board: t('studies.editorBoard'),
            eraser: t('studies.eraser'),
            start: t('studies.startPosition'),
            clear: t('studies.clearBoard'),
            flip: t('database.flip'),
            sideToMove: t('practice.studentSide'),
            white: t('studies.white'),
            black: t('studies.black'),
          }}
        />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            {t('studies.engineLevel')}
            <select
              value={elo}
              onChange={(e) => setElo(e.target.value)}
              className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
            >
              {BOT_LEVELS.map(({ id, elo: e }) => (
                <option key={id} value={e === null ? '' : String(e)}>
                  {e === null ? t('studies.fullStrength') : `Elo ${e}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            {t('studies.goal')}
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value === 'draw' ? 'draw' : 'win')}
              className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
            >
              <option value="win">{t('studies.goalWin')}</option>
              <option value="draw">{t('studies.goalDraw')}</option>
            </select>
          </label>
        </div>
        {!isValidFen(fen) && <p className="text-sm text-danger">{t('studies.errFen')}</p>}
        <ErrorText error={addPosition.error} />
        <div className="flex gap-2">
          <Button type="submit" variant="cta" disabled={addPosition.isPending || !isValidFen(fen)}>
            {t('common.save')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
