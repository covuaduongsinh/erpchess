import type { QuizSchedule } from '@erpchess/api';
import {
  useGroups,
  useMembers,
  useQuizScheduleMutations,
  useQuizSchedules,
  useStudies,
} from '@erpchess/api/react';
import { nextScheduledStudy } from '@erpchess/domain';
import { type FormEvent, useMemo, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { formatDateTime } from '../../lib/format';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText, Field, Spinner } from '../ui';

// Thứ hai trước, Chủ nhật cuối (0 = Chủ nhật)
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Lịch quiz tự động (Giai đoạn 24b, đặc tả REA: Quiz → Automated Quiz): danh sách lịch và form tạo.
 * Server (cron 5 phút) tự giao quiz từ study kế tiếp trong chuỗi khi tới giờ.
 */
export function QuizSchedulesPanel() {
  const { t, i18n } = useT();
  const { academy, session } = useAcademy();
  const schedules = useQuizSchedules(academy.id);
  const mine = useStudies({ scope: 'mine', academyId: academy.id, userId: session.user.id });
  const shared = useStudies({ scope: 'academy', academyId: academy.id, userId: session.user.id });
  const { setActive, remove, runNow } = useQuizScheduleMutations(academy.id, session.user.id);
  const [creating, setCreating] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const studies = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of [...(mine.data ?? []), ...(shared.data ?? [])]) byId.set(s.id, s.title);
    return byId;
  }, [mine.data, shared.data]);

  const dayNames = (days: number[]) =>
    WEEK.filter((d) => days.includes(d))
      .map((d) => t(`weekday.d${d}`))
      .join(', ');

  return (
    <div className="flex flex-col gap-4">
      <Card title={t('quizSchedule.title')}>
        <p className="text-sm text-text-muted">{t('quizSchedule.hint')}</p>
        {!creating && (
          <Button variant="cta" className="self-start" onClick={() => setCreating(true)}>
            + {t('quizSchedule.create')}
          </Button>
        )}
        {schedules.isPending ? (
          <Spinner />
        ) : schedules.error ? (
          <ErrorText error={schedules.error} />
        ) : schedules.data.length === 0 ? (
          <p className="text-sm text-text-muted">{t('quizSchedule.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-text-muted/15">
            {schedules.data.map((s: QuizSchedule) => {
              const next = nextScheduledStudy(s.study_ids, s.next_index);
              return (
                <li key={s.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        s.active ? 'bg-green/15 text-green' : 'bg-text-muted/15 text-text-muted'
                      }`}
                    >
                      {s.active ? t('quizSchedule.active') : t('quizSchedule.paused')}
                    </span>
                  </div>
                  <span className="text-sm text-text-muted">
                    {dayNames(s.days)} · {s.at_time.slice(0, 5)} ({s.timezone})
                    {s.expires_on && ` · ${t('quizSchedule.until', { date: s.expires_on })}`}
                  </span>
                  <span className="text-sm">
                    {t('quizSchedule.next', {
                      title: (next && studies.get(next)) || '—',
                      n: (s.next_index % s.study_ids.length) + 1,
                      total: s.study_ids.length,
                    })}
                  </span>
                  {s.last_run_at && (
                    <span className="text-xs text-text-muted">
                      {t('quizSchedule.lastRun', {
                        date: formatDateTime(s.last_run_at, i18n.language),
                      })}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      className="text-xs"
                      disabled={runNow.isPending}
                      onClick={() => runNow.mutate(s.id)}
                    >
                      ▶ {t('quizSchedule.runNow')}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ id: s.id, active: !s.active })}
                    >
                      {s.active ? t('quizSchedule.pause') : t('quizSchedule.resume')}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs text-danger"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirmId === s.id) {
                          remove.mutate(s.id);
                          setConfirmId(null);
                        } else setConfirmId(s.id);
                      }}
                    >
                      {confirmId === s.id
                        ? t('quizSchedule.confirmDelete')
                        : t('quizSchedule.delete')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {runNow.isSuccess && (
          <p role="status" className="text-sm text-green">
            {runNow.data ? t('quizSchedule.ranNow') : t('quizSchedule.ranEmpty')}
          </p>
        )}
        <ErrorText error={runNow.error ?? setActive.error ?? remove.error} />
      </Card>
      {creating && <CreateScheduleForm studies={studies} onDone={() => setCreating(false)} />}
    </div>
  );
}

function CreateScheduleForm({
  studies,
  onDone,
}: {
  studies: Map<string, string>;
  onDone: () => void;
}) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const groups = useGroups(academy.id);
  const members = useMembers(academy.id);
  const { create } = useQuizScheduleMutations(academy.id, session.user.id);
  const [days, setDays] = useState<number[]>([6]);
  const [sequence, setSequence] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const students = (members.data ?? []).filter((m) => m.role === 'student');
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '');
    create.mutate(
      {
        name: text('name'),
        days,
        atTime: text('atTime'),
        timezone: text('timezone'),
        expiresOn: text('expiresOn') || null,
        openHours: Number(text('openHours')) || 24,
        studyIds: sequence,
        groupIds,
        studentIds,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <Card title={t('quizSchedule.create')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('quizSchedule.name')} name="name" required maxLength={120} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('quizSchedule.days')}</legend>
          <div className="flex flex-wrap gap-1">
            {WEEK.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() =>
                  setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
                }
                className="rounded-full border border-text-muted/30 px-3 py-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
              >
                {t(`weekday.d${d}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('quizSchedule.time')}
              name="atTime"
              type="time"
              required
              defaultValue="19:00"
            />
            <Field
              label={t('location.timezone')}
              name="timezone"
              required
              defaultValue="Asia/Ho_Chi_Minh"
            />
            <Field label={t('quizSchedule.expiresOn')} name="expiresOn" type="date" />
            <Field
              label={t('quizSchedule.openHours')}
              name="openHours"
              type="number"
              min={1}
              max={336}
              defaultValue={24}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('quizSchedule.sequence')}</legend>
          {sequence.length > 0 && (
            <ol className="flex flex-col gap-1 text-sm">
              {sequence.map((id, i) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="text-text-muted">{i + 1}.</span>
                  <span className="flex-1">{studies.get(id) ?? '—'}</span>
                  <button
                    type="button"
                    className="text-xs text-danger underline"
                    onClick={() => setSequence((cur) => cur.filter((x) => x !== id))}
                  >
                    {t('quizSchedule.removeStudy')}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <select
            value=""
            aria-label={t('quizSchedule.addStudy')}
            onChange={(e) => e.target.value && setSequence((cur) => [...cur, e.target.value])}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm"
          >
            <option value="">{t('quizSchedule.addStudy')}</option>
            {[...studies.entries()]
              .filter(([id]) => !sequence.includes(id))
              .map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('quizSchedule.assign')}</legend>
          <div className="flex flex-wrap gap-1">
            {(groups.data ?? []).map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={groupIds.includes(g.id)}
                onClick={() => setGroupIds((cur) => toggle(cur, g.id))}
                className="rounded-full border border-text-muted/30 px-3 py-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
              >
                👥 {g.name}
              </button>
            ))}
            {students.map((m) => (
              <button
                key={m.profile.id}
                type="button"
                aria-pressed={studentIds.includes(m.profile.id)}
                onClick={() => setStudentIds((cur) => toggle(cur, m.profile.id))}
                className="rounded-full border border-text-muted/30 px-3 py-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
              >
                {m.profile.display_name || m.profile.username}
              </button>
            ))}
          </div>
        </fieldset>

        <ErrorText error={create.error} />
        <div className="flex gap-2">
          <Button type="submit" variant="cta" disabled={create.isPending}>
            {t('quizSchedule.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            {t('location.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
