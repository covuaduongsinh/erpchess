import type { PuzzleRow } from '@erpchess/api';
import { useCreateAssignment, useGroups, useMembers, usePuzzles } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { puzzleSideToMove } from '@erpchess/chess-core';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { ZodError } from 'zod';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { localInputToIso } from '../lib/format';
import { useT, useThemeLabel } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/assignments/new')({
  component: NewAssignmentPage,
});

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function NewAssignmentPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const navigate = useNavigate();
  const create = useCreateAssignment(academy.id);
  const groups = useGroups(academy.id);
  const members = useMembers(academy.id);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [due, setDue] = useState('');
  const [puzzleIds, setPuzzleIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);

  if (!isStaff(academy.role)) return <p className="text-text-muted">{t('academy.none')}</p>;

  const students = members.data?.filter((m) => m.role === 'student') ?? [];

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
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
              {t('assignments.groups')}
            </legend>
            {groups.isPending ? (
              <Spinner />
            ) : (groups.data ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">{t('groups.none')}</p>
            ) : (
              groups.data?.map((g) => (
                <label key={g.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.id)}
                    onChange={() => setGroupIds((l) => toggle(l, g.id))}
                  />
                  <span>{g.name}</span>
                  <span className="text-sm text-text-muted">
                    {t('groups.studentCount', { count: g.studentCount })}
                  </span>
                </label>
              ))
            )}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
              {t('assignments.students')}
            </legend>
            {members.isPending ? (
              <Spinner />
            ) : students.length === 0 ? (
              <p className="text-sm text-text-muted">{t('students.none')}</p>
            ) : (
              students.map(({ profile }) => (
                <label key={profile.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={studentIds.includes(profile.id)}
                    onChange={() => setStudentIds((l) => toggle(l, profile.id))}
                  />
                  <span>{profile.display_name}</span>
                  <span className="text-sm text-text-muted">@{profile.username}</span>
                </label>
              ))
            )}
          </fieldset>
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

function PuzzlePicker({
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
          <Board
            fen={shown.fen}
            orientation={puzzleSideToMove(shown)}
            coordinates={false}
            label={shown.title}
          />
          <p className="text-sm">{shown.title}</p>
          <p className="text-xs text-text-muted">{t(`puzzle.toMove_${puzzleSideToMove(shown)}`)}</p>
        </div>
      )}
    </div>
  );
}
