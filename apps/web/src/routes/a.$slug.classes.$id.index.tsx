import {
  useClassroom,
  useClassroomMutations,
  useClassroomRoster,
  useJoinClassroom,
  useMembers,
} from '@erpchess/api/react';
import { type AttendanceStatus, attendanceStatuses, isStaff } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/classes/$id/')({
  component: ClassroomPage,
});

const BADGE: Record<AttendanceStatus, string> = {
  present: 'bg-green/15 text-green',
  late: 'bg-yellow/20 text-orange',
  absent: 'bg-danger/10 text-danger',
  excused: 'bg-text-muted/15 text-text-muted',
};

function ClassroomPage() {
  const { t, i18n } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const classroom = useClassroom(id);
  const navigate = useNavigate();
  const { remove, removeUpcomingSeries } = useClassroomMutations(academy.id, session.user.id);
  const [confirm, setConfirm] = useState<'one' | 'series' | null>(null);
  const [copied, setCopied] = useState(false);

  if (classroom.isPending) return <Spinner />;
  if (classroom.error) return <ErrorText error={classroom.error} />;
  const c = classroom.data;
  const back = () => void navigate({ to: '/a/$slug/classes', params: { slug: academy.slug } });

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/a/$slug/classes"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('classroom.title')}
      </Link>
      <Card title={c.title}>
        <p className="text-text-muted">
          {formatDateTime(c.starts_at, i18n.language)} · {c.minutes}′ ·{' '}
          {t(`classroom.kind_${c.kind === 'offline' ? 'offline' : 'online'}`)}
          {c.kind === 'online' &&
            ` · ${t(`classroom.video_${c.video_mode as 'performance' | 'standard' | 'none'}`)}`}
          {c.is_public && ` · ${t('classroom.public')}`}
          {c.series_id && ` · ${t('classroom.series')}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {c.kind === 'online' && (
            <Link
              to="/a/$slug/classes/$id/room"
              params={{ slug: academy.slug, id: c.id }}
              className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
            >
              {t('classroom.enterRoom')}
            </Link>
          )}
          {c.kind === 'online' && (
            <Link
              to="/a/$slug/classes/$id/replay"
              params={{ slug: academy.slug, id: c.id }}
              className="rounded-md px-4 py-2 font-medium text-primary hover:bg-primary/10"
            >
              {t('classroom.replay')}
            </Link>
          )}
        </div>
        {!staff && c.kind === 'offline' && <JoinPanel classroomId={c.id} />}
        {staff && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href);
                setCopied(true);
              }}
            >
              {copied ? t('classroom.copied') : t('classroom.copyLink')}
            </Button>
            <Button
              variant="ghost"
              className="ml-auto text-danger"
              disabled={remove.isPending}
              onClick={() =>
                confirm === 'one' ? remove.mutate(c.id, { onSuccess: back }) : setConfirm('one')
              }
            >
              {confirm === 'one' ? t('classroom.confirm') : t('classroom.delete')}
            </Button>
            {c.series_id && (
              <Button
                variant="ghost"
                className="text-danger"
                disabled={removeUpcomingSeries.isPending}
                onClick={() =>
                  confirm === 'series'
                    ? removeUpcomingSeries.mutate(c.series_id ?? '', { onSuccess: back })
                    : setConfirm('series')
                }
              >
                {confirm === 'series' ? t('classroom.confirm') : t('classroom.deleteSeries')}
              </Button>
            )}
          </div>
        )}
        <ErrorText error={remove.error ?? removeUpcomingSeries.error} />
      </Card>
      {staff && <AttendanceSheet classroomId={c.id} />}
    </div>
  );
}

function JoinPanel({ classroomId }: { classroomId: string }) {
  const { t } = useT();
  const join = useJoinClassroom(classroomId);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="cta" disabled={join.isPending} onClick={() => join.mutate()}>
        {t('classroom.join')}
      </Button>
      {join.isSuccess && (
        <p role="status" className="text-sm">
          {join.data
            ? t('classroom.joined', { status: t(`classroom.status_${join.data}`) })
            : t('classroom.notInvited')}
        </p>
      )}
      <ErrorText error={join.error} />
    </div>
  );
}

function AttendanceSheet({ classroomId }: { classroomId: string }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const classroom = useClassroom(classroomId);
  const roster = useClassroomRoster(classroom.data);
  const members = useMembers(academy.id);
  const { setAttendance } = useClassroomMutations(academy.id, session.user.id);
  const marked = new Map(classroom.data?.attendance.map((a) => [a.student_id, a.status]));
  // Gồm cả người tự vào lớp công khai mà không có trong danh sách giao
  const ids = [...new Set([...(roster.data ?? []), ...marked.keys()])];
  const name = (sid: string) =>
    members.data?.find((m) => m.profile.id === sid)?.profile.display_name ?? '?';

  return (
    <Card title={t('classroom.attendance')}>
      {roster.isPending ? (
        <Spinner />
      ) : ids.length === 0 ? (
        <p className="text-text-muted">{t('classroom.noStudents')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-text-muted/15">
          {ids
            .sort((a, b) => name(a).localeCompare(name(b)))
            .map((sid) => {
              const status = marked.get(sid) as AttendanceStatus | undefined;
              return (
                <li key={sid} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{name(sid)}</span>
                  <fieldset className="flex flex-wrap gap-1" aria-label={name(sid)}>
                    {attendanceStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={status === s}
                        disabled={setAttendance.isPending}
                        onClick={() =>
                          setAttendance.mutate({ classroomId, studentId: sid, status: s })
                        }
                        className={`rounded-full px-3 py-1 text-sm ${status === s ? BADGE[s] : 'text-text-muted hover:bg-bg'}`}
                      >
                        {t(`classroom.status_${s}`)}
                      </button>
                    ))}
                  </fieldset>
                </li>
              );
            })}
        </ul>
      )}
      <ErrorText error={roster.error ?? setAttendance.error} />
    </Card>
  );
}
