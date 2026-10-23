import { useCreateAssignment } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ZodError } from 'zod';
import { PuzzlePicker } from '../components/assign/PuzzlePicker';
import { TargetPicker, toggle } from '../components/assign/TargetPicker';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { localInputToIso } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/assignments/new')({
  component: NewAssignmentPage,
});

function NewAssignmentPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const navigate = useNavigate();
  const create = useCreateAssignment(academy.id);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [due, setDue] = useState('');
  const [puzzleIds, setPuzzleIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);

  if (!isStaff(academy.role)) return <p className="text-text-muted">{t('academy.none')}</p>;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        title,
        instructions: instructions || undefined,
        dueAt: localInputToIso(due),
        puzzleIds,
        groupIds,
        studentIds,
      },
      {
        onSuccess: (a) =>
          void navigate({
            to: '/a/$slug/assignments/$id',
            params: { slug: academy.slug, id: a.id },
          }),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card title={t('assignments.pickPuzzles')}>
        <PuzzlePicker selected={puzzleIds} onToggle={(id) => setPuzzleIds((l) => toggle(l, id))} />
      </Card>

      <div className="flex flex-col gap-6">
        <Card title={t('assignments.create')}>
          <Field
            label={t('assignments.name')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('assignments.instructions')}</span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              maxLength={2000}
              className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base"
            />
          </label>
          <Field
            label={t('assignments.due')}
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Card>

        <Card title={t('assignments.assignTo')}>
          <TargetPicker
            groupIds={groupIds}
            studentIds={studentIds}
            onGroups={setGroupIds}
            onStudents={setStudentIds}
          />
        </Card>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            {t('assignments.selected', { count: puzzleIds.length })}
          </p>
          <Button type="submit" variant="cta" disabled={create.isPending}>
            {t('assignments.create')}
          </Button>
          <AssignmentError error={create.error} />
        </div>
      </div>
    </form>
  );
}

/** Lỗi validate riêng của form bài tập (thiếu puzzle / thiếu đối tượng giao). */
function AssignmentError({ error }: { error: unknown }) {
  const { t } = useT();
  if (error instanceof ZodError) {
    const code = error.issues[0]?.message;
    if (code === 'puzzles' || code === 'targets')
      return (
        <p role="alert" className="text-sm text-danger">
          {t(code === 'puzzles' ? 'assignments.needPuzzles' : 'assignments.needTargets')}
        </p>
      );
  }
  return <ErrorText error={error} />;
}
