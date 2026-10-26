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

type FilterType = 'all' | 'todo' | 'done';

function ChapterPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const chapter = usePracticeChapter(id);
  const staff = isStaff(academy.role);
  const [playing, setPlaying] = useState<PracticePosition | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
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

  // Tính thống kê hoàn thành cho học viên hiện tại
  const myResults = results.data?.filter((r) => r.student_id === session.user.id) ?? [];
  const completedCount = c.positions.filter((p) =>
    myResults.some((r) => r.position_id === p.id && (r.result === 'win' || r.result === 'draw')),
  ).length;
  const progressPercent =
    c.positions.length > 0 ? Math.round((completedCount / c.positions.length) * 100) : 0;

  // Lọc danh sách thế cờ
  const filteredPositions = c.positions.filter((p) => {
    const isDone = myResults.some(
      (r) => r.position_id === p.id && (r.result === 'win' || r.result === 'draw'),
    );
    if (filter === 'todo') return !isDone;
    if (filter === 'done') return isDone;
    return true;
  });

  const currentIndex = playing ? c.positions.findIndex((p) => p.id === playing.id) : -1;
  const prevPosition = currentIndex > 0 ? c.positions[currentIndex - 1] : null;
  const nextPosition =
    currentIndex >= 0 && currentIndex < c.positions.length - 1
      ? c.positions[currentIndex + 1]
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/a/$slug/practice"
            params={{ slug: academy.slug }}
            className="self-start text-sm text-primary hover:underline"
          >
            ← {t('practice.title')}
          </Link>
          <h2 className="mt-1 text-2xl font-bold text-primary">{c.title}</h2>
        </div>

        {/* Thanh tiến độ chương */}
        {c.positions.length > 0 && (
          <div className="flex min-w-[220px] flex-col gap-1 rounded-lg border border-primary/20 bg-white p-3 shadow-xs">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-text-muted">Tiến độ của bạn</span>
              <span className="text-primary font-bold">
                {completedCount}/{c.positions.length} ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card title={t('practice.positions')}>
          {/* Bộ lọc thế cờ */}
          {c.positions.length > 0 && (
            <div className="mb-3 flex rounded-md bg-bg p-1 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`flex-1 rounded-sm py-1 font-medium transition ${
                  filter === 'all'
                    ? 'bg-white shadow-xs text-primary'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Tất cả ({c.positions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('todo')}
                className={`flex-1 rounded-sm py-1 font-medium transition ${
                  filter === 'todo'
                    ? 'bg-white shadow-xs text-primary'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Chưa giải ({c.positions.length - completedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('done')}
                className={`flex-1 rounded-sm py-1 font-medium transition ${
                  filter === 'done'
                    ? 'bg-white shadow-xs text-primary'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Đã xong ({completedCount})
              </button>
            </div>
          )}

          {c.positions.length === 0 && (
            <p className="text-text-muted">{t('practice.noPositions')}</p>
          )}

          {filteredPositions.length === 0 && c.positions.length > 0 && (
            <p className="py-4 text-center text-sm text-text-muted">
              Không có thế cờ nào theo bộ lọc này.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {filteredPositions.map((p) => {
              const mine = myResults.filter((r) => r.position_id === p.id);
              const best = mine.some((r) => r.result === 'win')
                ? 'win'
                : mine.some((r) => r.result === 'draw')
                  ? 'draw'
                  : null;
              const isSelected = playing?.id === p.id;
              const originalIndex = c.positions.findIndex((pos) => pos.id === p.id);

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setAdding(false);
                      setPlaying(p);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-text-muted/15 hover:border-primary/40 hover:bg-bg'
                    }`}
                  >
                    <div className="w-14 shrink-0 rounded-sm overflow-hidden shadow-xs">
                      <Board
                        fen={p.fen}
                        orientation={p.side === 'b' ? 'b' : 'w'}
                        coordinates={false}
                        label={p.title || `#${originalIndex + 1}`}
                      />
                    </div>
                    <div className="flex flex-1 flex-col overflow-hidden text-sm">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-semibold text-text">
                          {p.title || `Thế cờ #${originalIndex + 1}`}
                        </span>
                        {best === 'win' && (
                          <span className="shrink-0 rounded-full bg-green/10 px-1.5 py-0.5 text-[11px] font-bold text-green">
                            ✓ Thắng
                          </span>
                        )}
                        {best === 'draw' && (
                          <span className="shrink-0 rounded-full bg-orange/10 px-1.5 py-0.5 text-[11px] font-bold text-orange">
                            ½ Hoà
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 text-xs text-text-muted">
                        {p.goal === 'win' ? t('studies.goalWin') : t('studies.goalDraw')} ·{' '}
                        {p.elo ? `Elo ${p.elo}` : t('studies.fullStrength')}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {canEdit && (
            <Button
              variant="ghost"
              className="mt-3 self-start"
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
            <div className="flex flex-col gap-4">
              <PlayPosition
                key={playing.id}
                position={playing}
                chapterId={id}
                canEdit={canEdit}
                onDeleted={() => setPlaying(null)}
              />

              {/* Thanh điều hướng bài trước / bài tiếp theo */}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-text-muted/15 bg-white p-3 shadow-xs">
                <Button
                  variant="ghost"
                  disabled={!prevPosition}
                  onClick={() => prevPosition && setPlaying(prevPosition)}
                >
                  ← Bài trước
                </Button>
                <span className="text-xs text-text-muted">
                  Thế cờ {currentIndex + 1} / {c.positions.length}
                </span>
                <Button
                  variant="cta"
                  disabled={!nextPosition}
                  onClick={() => nextPosition && setPlaying(nextPosition)}
                >
                  Bài kế tiếp →
                </Button>
              </div>
            </div>
          )}

          {!adding && !playing && (
            <Card title={t('practice.pick')}>
              <div className="py-6 text-center">
                <p className="text-text-muted">{t('practice.pickHint')}</p>
                {c.positions.length > 0 && (
                  <Button
                    variant="cta"
                    className="mt-4"
                    onClick={() => {
                      // Tự động chọn thế cờ đầu tiên chưa hoàn thành, hoặc thế cờ đầu tiên
                      const firstTodo =
                        c.positions.find(
                          (p) =>
                            !myResults.some(
                              (r) =>
                                r.position_id === p.id &&
                                (r.result === 'win' || r.result === 'draw'),
                            ),
                        ) ?? c.positions[0];
                      if (firstTodo) setPlaying(firstTodo);
                    }}
                  >
                    Bắt đầu bài tập đầu tiên
                  </Button>
                )}
              </div>
            </Card>
          )}

          {staff && (results.data?.length ?? 0) > 0 && (
            <Card title={t('practice.results')}>
              <ul className="flex flex-col gap-1 text-sm">
                {results.data?.slice(0, 30).map((r) => {
                  const pos = c.positions.find((p) => p.id === r.position_id);
                  return (
                    <li
                      key={r.id}
                      className="flex justify-between gap-2 border-b border-text-muted/10 py-1.5 last:border-0"
                    >
                      <span>
                        {name(r.student_id)} · {pos?.title || '#'}
                      </span>
                      <span
                        className={`font-semibold ${
                          r.result === 'win'
                            ? 'text-green'
                            : r.result === 'loss'
                              ? 'text-danger'
                              : 'text-text-muted'
                        }`}
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
