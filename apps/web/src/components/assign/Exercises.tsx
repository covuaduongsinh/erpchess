import type { ExerciseSummary } from '@erpchess/api';
import { useExerciseMutations, useExercises, useLevels } from '@erpchess/api/react';
import { type FormEvent, useState } from 'react';
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
  const { remove } = useExerciseMutations(academy.id, session.user.id);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  if (creating) return <ExerciseForm onDone={() => setCreating(false)} />;

  return (
    <Card title={t('exercise.title')}>
      <Button variant="cta" className="self-start" onClick={() => setCreating(true)}>
        {t('exercise.create')}
      </Button>
      {exercises.isPending ? (
        <Spinner />
      ) : exercises.error ? (
        <ErrorText error={exercises.error} />
      ) : exercises.data.length === 0 ? (
        <p className="text-text-muted">{t('exercise.none')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-text-muted/15">
          {exercises.data.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-sm text-text-muted">
                    {t('assignments.puzzleCount', { count: e.puzzleIds.length })} ·{' '}
                    {t('exercise.assignedTimes', { count: e.assignedCount })}
                    {e.tags.length > 0 && ` · ${e.tags.join(', ')}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="text-sm"
                    onClick={() => setAssigning(assigning === e.id ? null : e.id)}
                  >
                    {t('exercise.assign')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-sm text-danger"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(e.id)}
                  >
                    {t('studies.delete')}
                  </Button>
                </div>
              </div>
              {assigning === e.id && <AssignForm exercise={e} onDone={() => setAssigning(null)} />}
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={remove.error} />
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md bg-bg p-3">
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
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="cta"
          disabled={assign.isPending || groupIds.length + studentIds.length === 0}
        >
          {t('exercise.assignNow')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
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
