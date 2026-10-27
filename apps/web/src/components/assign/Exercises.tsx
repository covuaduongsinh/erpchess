import type { ExerciseSummary } from '@erpchess/api';
import { useExerciseMutations, useExercises, useLevels } from '@erpchess/api/react';
import { type FormEvent, useMemo, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { localInputToIso } from '../../lib/format';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText, Field, Spinner } from '../ui';
import { PuzzlePicker } from './PuzzlePicker';
import { TargetPicker, toggle } from './TargetPicker';

/** Exercise: soạn một lần (tên, mô tả, cấp, thẻ, puzzle), giao nhiều lần cho lớp/học viên. */
export function Exercises() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const exercises = useExercises(academy.id);
  const levels = useLevels(academy.id);
  const { remove } = useExerciseMutations(academy.id, session.user.id);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');

  const filteredExercises = useMemo(() => {
    return (exercises.data ?? []).filter((e) => {
      if (selectedLevelId && e.level_id !== selectedLevelId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchTags = e.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchTags) return false;
      }
      return true;
    });
  }, [exercises.data, selectedLevelId, searchQuery]);

  if (creating) return <ExerciseForm onDone={() => setCreating(false)} />;

  return (
    <Card title={t('exercise.title')}>
      <div className="flex flex-col gap-4">
        {/* Thanh công cụ: Tạo bài tập & Bộ lọc tìm kiếm */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <Button variant="cta" onClick={() => setCreating(true)}>
            + {t('exercise.create')}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              aria-label="Tìm bài tập"
              placeholder="Tìm theo tên bài tập, thẻ tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-hidden"
            />

            <select
              aria-label="Lọc theo cấp độ"
              value={selectedLevelId}
              onChange={(e) => setSelectedLevelId(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-primary focus:outline-hidden"
            >
              <option value="">Tất cả cấp độ</option>
              {levels.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {exercises.isPending ? (
          <Spinner />
        ) : exercises.error ? (
          <ErrorText error={exercises.error} />
        ) : filteredExercises.length === 0 ? (
          <p className="text-xs text-text-muted py-6 text-center">
            {exercises.data?.length === 0
              ? t('exercise.none')
              : 'Không tìm thấy bài tập nào phù hợp với bộ lọc.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {filteredExercises.map((e) => {
              const levelName = levels.data?.find((l) => l.id === e.level_id)?.name;

              return (
                <li key={e.id} className="flex flex-col gap-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl mt-0.5" aria-hidden="true">
                        🧩
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{e.title}</span>
                          {levelName && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                              {levelName}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1">
                          <span className="font-medium text-gray-700">
                            {t('assignments.puzzleCount', { count: e.puzzleIds.length })}
                          </span>
                          <span>·</span>
                          <span>{t('exercise.assignedTimes', { count: e.assignedCount })}</span>
                          {e.tags.length > 0 && (
                            <>
                              <span>·</span>
                              <div className="flex flex-wrap gap-1">
                                {e.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        className="text-xs px-3 py-1.5"
                        onClick={() => setAssigning(assigning === e.id ? null : e.id)}
                      >
                        {assigning === e.id ? t('common.cancel') : t('exercise.assign')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs text-danger hover:bg-red-50 px-2.5 py-1.5"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(e.id)}
                      >
                        {t('studies.delete')}
                      </Button>
                    </div>
                  </div>

                  {assigning === e.id && (
                    <AssignForm exercise={e} onDone={() => setAssigning(null)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <ErrorText error={remove.error} />
      </div>
    </Card>
  );
}

function AssignForm({ exercise, onDone }: { exercise: ExerciseSummary; onDone: () => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { assign } = useExerciseMutations(academy.id, session.user.id);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [due, setDue] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    assign.mutate(
      { exercise, dueAt: localInputToIso(due), groupIds, studentIds },
      { onSuccess: onDone },
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/70 p-4"
    >
      <TargetPicker
        groupIds={groupIds}
        studentIds={studentIds}
        onGroups={setGroupIds}
        onStudents={setStudentIds}
      />
      <Field
        label={t('assignments.due')}
        type="datetime-local"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <ErrorText error={assign.error} />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onDone} className="text-xs px-3 py-1.5">
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="cta"
          disabled={assign.isPending || groupIds.length + studentIds.length === 0}
          className="text-xs px-3 py-1.5"
        >
          {t('exercise.assignNow')}
        </Button>
      </div>
    </form>
  );
}

function ExerciseForm({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const levels = useLevels(academy.id);
  const { create } = useExerciseMutations(academy.id, session.user.id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [levelId, setLevelId] = useState('');
  const [tags, setTags] = useState('');
  const [puzzleIds, setPuzzleIds] = useState<string[]>([]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        title,
        description,
        levelId: levelId || null,
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        puzzleIds,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={t('assignments.pickPuzzles')}>
        <PuzzlePicker selected={puzzleIds} onToggle={(id) => setPuzzleIds((l) => toggle(l, id))} />
      </Card>
      <Card title={t('exercise.create')}>
        <Field
          label={t('exercise.name')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={160}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('studies.description')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('groups.level')}</span>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">{t('groups.noLevel')}</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('exercise.tags')}
          hint={t('exercise.tagsHint')}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <p className="text-sm text-text-muted">
          {t('assignments.selected', { count: puzzleIds.length })}
        </p>
        <ErrorText error={create.error} />
        <div className="flex gap-2">
          <Button type="submit" variant="cta" disabled={create.isPending || puzzleIds.length === 0}>
            {t('exercise.create')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </Card>
    </form>
  );
}
