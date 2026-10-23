import { quizItemsFromStudy, type StudyScope } from '@erpchess/api';
import { useLevels, usePuzzles, useQuizMutations, useStudies, useStudy } from '@erpchess/api/react';
import { isStaff, type QuizItemInput } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { ZodError } from 'zod';
import { PuzzlePicker } from '../components/assign/PuzzlePicker';
import { TargetPicker } from '../components/assign/TargetPicker';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { localInputToIso } from '../lib/format';
import { useT } from '../lib/use-t';

type Search = { studyId?: string };

export const Route = createFileRoute('/a/$slug/quizzes/new')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    studyId: typeof s.studyId === 'string' ? s.studyId : undefined,
  }),
  component: NewQuizPage,
});

/** Câu hỏi đã chọn kèm nhãn để hiện danh sách. */
type Picked = { key: string; label: string; item: QuizItemInput };

function NewQuizPage() {
  const { t } = useT();
  const { studyId } = Route.useSearch();
  const { academy, session } = useAcademy();
  const navigate = useNavigate();
  const levels = useLevels(academy.id);
  const { create } = useQuizMutations(academy.id, session.user.id);
  const [title, setTitle] = useState('');
  const [levelId, setLevelId] = useState('');
  const [openToAll, setOpenToAll] = useState(true);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [source, setSource] = useState<'study' | 'puzzles'>(studyId ? 'study' : 'puzzles');

  if (!isStaff(academy.role)) return <p className="text-text-muted">{t('academy.none')}</p>;

  const add = (items: Picked[]) =>
    setPicked((list) => [...list, ...items.filter((i) => !list.some((p) => p.key === i.key))]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        title,
        levelId: levelId || null,
        openToAll,
        groupIds: openToAll ? [] : groupIds,
        studentIds: openToAll ? [] : studentIds,
        startsAt: localInputToIso(startsAt) ?? null,
        dueAt: localInputToIso(dueAt) ?? null,
        items: picked.map((p) => p.item),
      },
      {
        onSuccess: (q) =>
          void navigate({ to: '/a/$slug/quizzes/$id', params: { slug: academy.slug, id: q.id } }),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card title={t('quiz.content')}>
        <div role="tablist" className="flex gap-1">
          {(['study', 'puzzles'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={source === s}
              onClick={() => setSource(s)}
              className="rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary"
            >
              {s === 'study' ? t('quiz.fromStudy') : t('quiz.fromPuzzles')}
            </button>
          ))}
        </div>
        {source === 'study' ? (
          <StudySource initialStudyId={studyId} onAdd={add} />
        ) : (
          <PuzzleSource
            picked={picked}
            onAdd={add}
            onRemove={(key) => setPicked((l) => l.filter((p) => p.key !== key))}
          />
        )}
      </Card>

      <div className="flex flex-col gap-6">
        <Card title={t('quiz.create')}>
          <Field
            label={t('quiz.name')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
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
            label={t('quiz.startsAt')}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <Field
            label={t('quiz.dueAt')}
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Card>

        <Card title={t('assignments.assignTo')}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={openToAll}
              onChange={(e) => setOpenToAll(e.target.checked)}
            />
            {t('quiz.openToAllHint')}
          </label>
          {!openToAll && (
            <TargetPicker
              groupIds={groupIds}
              studentIds={studentIds}
              onGroups={setGroupIds}
              onStudents={setStudentIds}
            />
          )}
        </Card>

        <Card title={t('quiz.questions', { count: picked.length })}>
          {picked.length === 0 ? (
            <p className="text-sm text-text-muted">{t('quiz.noQuestions')}</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm">
              {picked.map((p, i) => (
                <li key={p.key} className="flex items-center justify-between gap-2">
                  <span>
                    {i + 1}. {p.label}
                  </span>
                  <Button
                    variant="ghost"
                    className="px-2 text-sm"
                    aria-label={t('quiz.removeQuestion')}
                    onClick={() => setPicked((l) => l.filter((x) => x.key !== p.key))}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <QuizFormError error={create.error} />
          <Button type="submit" variant="cta" disabled={create.isPending || picked.length === 0}>
            {t('quiz.create')}
          </Button>
        </Card>
      </div>
    </form>
  );
}

function QuizFormError({ error }: { error: unknown }) {
  const { t } = useT();
  if (error instanceof ZodError) {
    const code = error.issues[0]?.message;
    const msg =
      code === 'targets'
        ? t('assignments.needTargets')
        : code === 'schedule'
          ? t('quiz.badSchedule')
          : code === 'items'
            ? t('quiz.noQuestions')
            : error.issues[0]?.message;
    return (
      <p role="alert" className="text-sm text-danger">
        {msg}
      </p>
    );
  }
  return <ErrorText error={error} />;
}

function StudySource({
  initialStudyId,
  onAdd,
}: {
  initialStudyId?: string;
  onAdd: (items: Picked[]) => void;
}) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const [scope, setScope] = useState<StudyScope>('mine');
  const [studyId, setStudyId] = useState(initialStudyId ?? '');
  const studies = useStudies({ scope, academyId: academy.id, userId: session.user.id });
  const study = useStudy(studyId || undefined);
  const items = study.data ? quizItemsFromStudy(study.data.activities) : [];
  const toPicked = (item: QuizItemInput, i: number): Picked => ({
    key: `a:${item.sourceActivityId ?? i}`,
    label: `${item.title || t(`activity.${item.kind}`)} — ${study.data?.title ?? ''}`,
    item,
  });

  // Mở từ nút "Tạo quiz" ở học liệu: thêm sẵn mọi câu chấm được
  const [autoAdded, setAutoAdded] = useState(false);
  useEffect(() => {
    if (initialStudyId && study.data && !autoAdded) {
      setAutoAdded(true);
      onAdd(quizItemsFromStudy(study.data.activities).map(toPicked));
    }
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as StudyScope)}
          className="rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm"
        >
          {(['mine', 'academy', 'public'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`studies.scope_${s}`)}
            </option>
          ))}
        </select>
        <select
          value={studyId}
          onChange={(e) => setStudyId(e.target.value)}
          className="min-w-48 flex-1 rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm"
          aria-label={t('studies.title')}
        >
          <option value="">— {t('studies.title')} —</option>
          {studies.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      {study.isFetching && <Spinner />}
      {study.data && (
        <>
          {items.length === 0 ? (
            <p className="text-sm text-text-muted">{t('quiz.studyNoGradable')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {items.map((item, i) => (
                <li
                  key={item.sourceActivityId ?? i}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {t(`activity.${item.kind}`)} · {item.title || '—'}
                  </span>
                  <Button
                    variant="ghost"
                    className="text-sm"
                    onClick={() => onAdd([toPicked(item, i)])}
                  >
                    + {t('quiz.add')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <Button
              variant="ghost"
              className="self-start text-sm"
              onClick={() => onAdd(items.map(toPicked))}
            >
              {t('quiz.addAll', { count: items.length })}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function PuzzleSource({
  picked,
  onAdd,
  onRemove,
}: {
  picked: Picked[];
  onAdd: (items: Picked[]) => void;
  onRemove: (key: string) => void;
}) {
  const { academy } = useAcademy();
  const puzzles = usePuzzles(academy.id);
  const selected = picked.flatMap((p) => (p.key.startsWith('p:') ? [p.key.slice(2)] : []));
  return (
    <PuzzlePicker
      selected={selected}
      onToggle={(id) => {
        if (selected.includes(id)) return onRemove(`p:${id}`);
        const p = puzzles.data?.find((x) => x.id === id);
        if (p) {
          onAdd([
            {
              key: `p:${p.id}`,
              label: p.title,
              item: {
                kind: 'puzzle',
                title: p.title,
                payload: { fen: p.fen, moves: p.moves },
                sourceActivityId: null,
              },
            },
          ]);
        }
      }}
    />
  );
}
