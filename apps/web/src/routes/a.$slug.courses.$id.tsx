import type { CourseDetail } from '@erpchess/api';
import {
  useCertificateMutations,
  useCertificates,
  useCourse,
  useCourseCompletions,
  useCourseMutations,
  useCourseProgress,
  useLevels,
  useMembers,
  useStudies,
  useStudyProgress,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TargetPicker } from '../components/assign/TargetPicker';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/courses/$id')({
  component: CoursePage,
});

function CoursePage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy } = useAcademy();
  const course = useCourse(id);
  if (course.isPending) return <Spinner />;
  if (course.error) return <ErrorText error={course.error} />;
  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/a/$slug/courses"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('course.title')}
      </Link>
      {isStaff(academy.role) ? (
        <CourseEditor course={course.data} />
      ) : (
        <CourseLearner course={course.data} />
      )}
    </div>
  );
}

/** Học viên: lộ trình, tiến độ từng học liệu, nút học tiếp. */
function CourseLearner({ course }: { course: CourseDetail }) {
  const { t, i18n } = useT();
  const { academy, session } = useAcademy();
  const studyIds = course.items.map((i) => i.study_id);
  const progress = useStudyProgress(studyIds);
  const done = useCourseCompletions([course.id]);
  const certs = useCertificates({
    academyId: academy.id,
    studentId: session.user.id,
    courseId: course.id,
  });
  const cert = certs.data?.find((c) => !c.revoked_at);
  const mine = (sid: string) =>
    progress.data?.find((p) => p.studyId === sid && p.studentId === session.user.id);
  const isDone = (sid: string) => {
    const p = mine(sid);
    return !!p && (p.totalActivities ?? 0) > 0 && (p.completed ?? 0) >= (p.totalActivities ?? 0);
  };
  const required = course.items.filter((i) => i.required);
  const pct = required.length
    ? Math.round((required.filter((i) => isDone(i.study_id)).length / required.length) * 100)
    : 0;
  const next = course.items.find((i) => !isDone(i.study_id));
  const completion = done.data?.find((c) => c.student_id === session.user.id);

  return (
    <Card title={course.title}>
      {course.description && <p className="whitespace-pre-wrap text-sm">{course.description}</p>}
      <div className="flex items-center gap-2">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
          <div className="h-full bg-green" style={{ width: `${completion ? 100 : pct}%` }} />
        </div>
        <span className="text-sm font-medium">
          {completion
            ? t('course.completedAt', {
                date: formatDateTime(completion.completed_at, i18n.language),
              })
            : t('course.percent', { percent: pct })}
        </span>
      </div>
      {cert && (
        <Link
          to="/a/$slug/certificates/$id"
          params={{ slug: academy.slug, id: cert.id }}
          className="self-start rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90"
        >
          🎓 {t('cert.view')}
        </Link>
      )}
      {next?.study && (
        <Link
          to="/a/$slug/studies/$id"
          params={{ slug: academy.slug, id: next.study.id }}
          className="self-start rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
        >
          {t('course.continue')}: {next.study.title}
        </Link>
      )}
      <ol className="flex flex-col gap-2">
        {course.items.map((it, i) => {
          const p = mine(it.study_id);
          return (
            <li key={it.study_id} className="flex items-center gap-3 rounded-md bg-bg px-3 py-2">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${isDone(it.study_id) ? 'bg-green text-white' : 'bg-white text-text-muted'}`}
              >
                {isDone(it.study_id) ? '✓' : i + 1}
              </span>
              <Link
                to="/a/$slug/studies/$id"
                params={{ slug: academy.slug, id: it.study_id }}
                className="flex-1 font-medium text-primary hover:underline"
              >
                {it.study?.title ?? '?'}
              </Link>
              <span className="text-xs text-text-muted">
                {p?.completed ?? 0}/{it.study?.activityCount ?? 0} ·{' '}
                {it.required ? t('course.required') : t('course.optional')}
              </span>
            </li>
          );
        })}
      </ol>
      {course.items.length === 0 && <p className="text-text-muted">{t('course.noStudies')}</p>}
    </Card>
  );
}

/** HLV: thông tin khoá, lộ trình (thêm, sắp xếp, bắt buộc), người học, tiến độ. */
function CourseEditor({ course }: { course: CourseDetail }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const levels = useLevels(academy.id);
  const m = useCourseMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [items, setItems] = useState(() =>
    course.items.map((i) => ({
      studyId: i.study_id,
      required: i.required,
      title: i.study?.title ?? '?',
    })),
  );
  const [groupIds, setGroupIds] = useState(
    course.targets.flatMap((x) => (x.group_id ? [x.group_id] : [])),
  );
  const [studentIds, setStudentIds] = useState(
    course.targets.flatMap((x) => (x.student_id ? [x.student_id] : [])),
  );
  const [confirm, setConfirm] = useState(false);
  const move = (i: number, d: number) =>
    setItems((xs) => {
      const next = [...xs];
      const [x] = next.splice(i, 1);
      if (x) next.splice(Math.max(0, Math.min(next.length, i + d)), 0, x);
      return next;
    });
  const published = course.status === 'published';
  const select = 'rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm';

  return (
    <div className="flex flex-col gap-6">
      <Card title={course.title}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={published ? 'text-green' : 'text-text-muted'}>
            {published ? t('course.published') : t('course.draft')}
          </span>
          <select
            aria-label={t('course.level')}
            value={course.level_id ?? ''}
            onChange={(e) =>
              m.update.mutate({ id: course.id, patch: { level_id: e.target.value || null } })
            }
            className={select}
          >
            <option value="">{t('course.noLevel')}</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={course.open_to_all}
              onChange={(e) =>
                m.update.mutate({ id: course.id, patch: { open_to_all: e.target.checked } })
              }
            />
            {t('course.openToAll')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={course.auto_certificate}
              onChange={(e) =>
                m.update.mutate({ id: course.id, patch: { auto_certificate: e.target.checked } })
              }
            />
            {t('course.autoCertificate')}
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={published ? 'ghost' : 'cta'}
            disabled={m.update.isPending}
            onClick={() =>
              m.update.mutate({
                id: course.id,
                patch: { status: published ? 'draft' : 'published' },
              })
            }
          >
            {published ? t('course.unpublish') : t('course.publish')}
          </Button>
          <Button
            variant="ghost"
            className="ml-auto text-danger"
            disabled={m.remove.isPending}
            onClick={() =>
              confirm
                ? m.remove.mutate(course.id, {
                    onSuccess: () =>
                      void navigate({ to: '/a/$slug/courses', params: { slug: academy.slug } }),
                  })
                : setConfirm(true)
            }
          >
            {confirm ? t('course.confirmDelete') : t('course.delete')}
          </Button>
        </div>
        <ErrorText error={m.update.error ?? m.remove.error} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('course.studies')}>
          {items.length === 0 && <p className="text-text-muted">{t('course.noStudies')}</p>}
          <ol className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li
                key={it.studyId}
                className="flex flex-wrap items-center gap-2 rounded-md bg-bg px-3 py-2 text-sm"
              >
                <span className="w-6 text-text-muted">{i + 1}.</span>
                <span className="flex-1 font-medium">{it.title}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={it.required}
                    onChange={(e) =>
                      setItems((xs) =>
                        xs.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)),
                      )
                    }
                  />
                  {t('course.required')}
                </label>
                <Button
                  variant="ghost"
                  className="px-2 py-0 text-xs"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  {t('course.up')}
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-0 text-xs"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  {t('course.down')}
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-0 text-xs text-danger"
                  onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                >
                  {t('course.remove')}
                </Button>
              </li>
            ))}
          </ol>
          <Button
            variant="cta"
            className="self-start"
            disabled={m.setItems.isPending}
            onClick={() =>
              m.setItems.mutate({
                id: course.id,
                items: items.map(({ studyId, required }) => ({ studyId, required })),
              })
            }
          >
            {t('course.saveOrder')}
          </Button>
          {m.setItems.isSuccess && (
            <p role="status" className="text-sm text-green">
              {t('course.saved')}
            </p>
          )}
          <ErrorText error={m.setItems.error} />
          <StudyPicker
            levelId={course.level_id}
            taken={new Set(items.map((x) => x.studyId))}
            onPick={(s) =>
              setItems((xs) => [...xs, { studyId: s.id, required: true, title: s.title }])
            }
          />
        </Card>
        <Card title={t('course.assign')}>
          <TargetPicker
            groupIds={groupIds}
            studentIds={studentIds}
            onGroups={setGroupIds}
            onStudents={setStudentIds}
          />
          <Button
            variant="cta"
            className="self-start"
            disabled={m.setTargets.isPending}
            onClick={() => m.setTargets.mutate({ id: course.id, groupIds, studentIds })}
          >
            {t('course.saveTargets')}
          </Button>
          {m.setTargets.isSuccess && (
            <p role="status" className="text-sm text-green">
              {t('course.saved')}
            </p>
          )}
          <ErrorText error={m.setTargets.error} />
        </Card>
      </div>
      <ProgressTable course={course} />
    </div>
  );
}

function StudyPicker({
  levelId,
  taken,
  onPick,
}: {
  levelId: string | null;
  taken: Set<string>;
  onPick: (s: { id: string; title: string }) => void;
}) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const [scope, setScope] = useState<'academy' | 'public' | 'mine'>('academy');
  const [sameLevel, setSameLevel] = useState(!!levelId);
  const studies = useStudies({ scope, academyId: academy.id, userId: session.user.id });
  const list = (studies.data ?? []).filter(
    (s) => !taken.has(s.id) && (!sameLevel || !levelId || s.level_id === levelId),
  );
  return (
    <div className="flex flex-col gap-2 border-t border-text-muted/15 pt-3">
      <p className="text-sm font-medium">{t('course.addStudies')}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(['academy', 'public', 'mine'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            onClick={() => setScope(s)}
            className="rounded-full px-3 py-1 text-text-muted aria-pressed:bg-primary aria-pressed:text-text-on-primary"
          >
            {t(`course.scope_${s}`)}
          </button>
        ))}
        {levelId && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={sameLevel}
              onChange={(e) => setSameLevel(e.target.checked)}
            />
            {t('course.level')}
          </label>
        )}
      </div>
      <p className="text-xs text-text-muted">{t('course.pickHint')}</p>
      {studies.isPending ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-1">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-full bg-bg px-3 py-1 text-sm hover:bg-primary/10"
            >
              + {s.title} <span className="text-text-muted">({s.activityCount})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Học viên × học liệu: số hoạt động đã giải / tổng; dấu ✓ khi hoàn thành khoá. */
function ProgressTable({ course }: { course: CourseDetail }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  const progress = useStudyProgress(course.items.map((i) => i.study_id));
  const summary = useCourseProgress([course.id]);
  const done = useCourseCompletions([course.id]);
  const certs = useCertificates({ academyId: academy.id, courseId: course.id });
  const { issue } = useCertificateMutations(academy.id);
  const studentIds = [
    ...new Set(summary.data?.map((r) => r.student_id).filter((x): x is string => !!x)),
  ];
  const name = (id: string) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '?';
  if (studentIds.length === 0 || course.items.length === 0) return null;
  return (
    <Card title={t('course.progress')}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-text-muted">
            <tr>
              <th className="py-1 pr-3">{t('course.students')}</th>
              {course.items.map((it, i) => (
                <th key={it.study_id} className="py-1 pr-3" title={it.study?.title}>
                  {i + 1}
                </th>
              ))}
              <th className="py-1">{t('course.done')}</th>
            </tr>
          </thead>
          <tbody>
            {studentIds
              .sort((a, b) => name(a).localeCompare(name(b)))
              .map((sid) => (
                <tr key={sid} className="border-t border-text-muted/15">
                  <td className="py-1 pr-3 font-medium">{name(sid)}</td>
                  {course.items.map((it) => {
                    const p = progress.data?.find(
                      (x) => x.studyId === it.study_id && x.studentId === sid,
                    );
                    const full =
                      !!p &&
                      (p.totalActivities ?? 0) > 0 &&
                      (p.completed ?? 0) >= (p.totalActivities ?? 0);
                    return (
                      <td
                        key={it.study_id}
                        className={`py-1 pr-3 ${full ? 'text-green' : 'text-text-muted'}`}
                      >
                        {p ? `${p.completed}/${p.totalActivities}` : '—'}
                      </td>
                    );
                  })}
                  <td className="py-1">
                    <DoneCell
                      done={!!done.data?.some((c) => c.student_id === sid)}
                      certId={certs.data?.find((c) => c.student_id === sid && !c.revoked_at)?.id}
                      onIssue={() => issue.mutate({ studentId: sid, courseId: course.id })}
                      issuing={issue.isPending}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <ErrorText error={issue.error} />
    </Card>
  );
}

function DoneCell({
  done,
  certId,
  onIssue,
  issuing,
}: {
  done: boolean;
  certId: string | undefined;
  onIssue: () => void;
  issuing: boolean;
}) {
  const { t } = useT();
  const { academy } = useAcademy();
  if (!done) return null;
  return (
    <span className="flex items-center gap-2">
      ✓
      {certId ? (
        <Link
          to="/a/$slug/certificates/$id"
          params={{ slug: academy.slug, id: certId }}
          className="text-primary hover:underline"
          title={t('cert.view')}
        >
          🎓
        </Link>
      ) : (
        <button
          type="button"
          onClick={onIssue}
          disabled={issuing}
          className="text-xs text-primary underline"
        >
          {t('cert.issue')}
        </button>
      )}
    </span>
  );
}
