import {
  useCourseCompletions,
  useCourseMutations,
  useCourseProgress,
  useCourses,
  useLevels,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/courses/')({
  component: CoursesPage,
});

function CoursesPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const list = useCourses(academy.id);
  const levels = useLevels(academy.id);
  const ids = (list.data ?? []).map((c) => c.id);
  const progress = useCourseProgress(staff ? [] : ids);
  const done = useCourseCompletions(staff ? [] : ids);
  const levelName = (id: string | null) => levels.data?.find((l) => l.id === id)?.name;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={t('course.title')}>
        {list.isPending ? (
          <Spinner />
        ) : list.error ? (
          <ErrorText error={list.error} />
        ) : list.data.length === 0 ? (
          <p className="text-text-muted">{t('course.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-text-muted/15">
            {list.data.map((c) => {
              const p = progress.data?.find(
                (x) => x.course_id === c.id && x.student_id === session.user.id,
              );
              const finished = done.data?.some(
                (x) => x.course_id === c.id && x.student_id === session.user.id,
              );
              const pct = p?.required_total
                ? Math.round(((p.required_done ?? 0) / p.required_total) * 100)
                : 0;
              return (
                <li key={c.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to="/a/$slug/courses/$id"
                      params={{ slug: academy.slug, id: c.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.title}
                    </Link>
                    <span className="text-sm text-text-muted">
                      {t('course.studyCount', { count: c.itemCount })}
                      {levelName(c.level_id) && ` · ${levelName(c.level_id)}`}
                      {staff &&
                        ` · ${c.status === 'published' ? t('course.published') : t('course.draft')}`}
                    </span>
                  </div>
                  {!staff && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full bg-green"
                          style={{ width: `${finished ? 100 : pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-muted">
                        {finished ? t('course.completed') : t('course.percent', { percent: pct })}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {staff && <CreateCourse />}
    </div>
  );
}

function CreateCourse() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const levels = useLevels(academy.id);
  const { create } = useCourseMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [levelId, setLevelId] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { title, levelId: levelId || null },
      {
        onSuccess: (c) =>
          void navigate({ to: '/a/$slug/courses/$id', params: { slug: academy.slug, id: c.id } }),
      },
    );
  }

  return (
    <Card title={t('course.create')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field
          label={t('course.name')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={160}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('course.level')}</span>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">{t('course.noLevel')}</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <ErrorText error={create.error} />
        <Button type="submit" variant="cta" className="self-start" disabled={create.isPending}>
          {t('course.create')}
        </Button>
      </form>
    </Card>
  );
}
