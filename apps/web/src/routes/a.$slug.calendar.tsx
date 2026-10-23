import type { CalendarEvent } from '@erpchess/api';
import {
  useCalendarEvents,
  useCalendarMutations,
  useClassrooms,
  useCoachAvailability,
  useGroupMemberships,
  useGroups,
  useMembers,
} from '@erpchess/api/react';
import {
  type CalendarEventKind,
  calendarEventKinds,
  freeCoaches,
  isStaff,
  weekDays,
} from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { localInputToIso } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/calendar')({
  component: CalendarPage,
});

const KIND_STYLE: Record<CalendarEventKind, string> = {
  class: 'border-primary bg-primary/10',
  trial: 'border-teal bg-teal/10',
  meeting: 'border-blue-light bg-blue-light/10',
  leave: 'border-orange bg-yellow/15',
  other: 'border-text-muted bg-text-muted/10',
};
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const select = 'rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm';

function hhmm(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function CalendarPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const [anchor, setAnchor] = useState(() => new Date());
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const from = days[0] ?? new Date();
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  const events = useCalendarEvents(academy.id, from, to);
  const classes = useClassrooms(academy.id, { from, to });
  const members = useMembers(academy.id);
  const groups = useGroups(academy.id);
  const memberships = useGroupMemberships(academy.id);
  const availability = useCoachAvailability(academy.id);
  const [coach, setCoach] = useState('');
  const [kind, setKind] = useState('');
  const [batch, setBatch] = useState('');
  const [student, setStudent] = useState('');

  if (!isStaff(academy.role)) return <p className="text-text-muted">{t('classroom.notInvited')}</p>;

  const coaches = (members.data ?? []).filter((m) => m.role === 'owner' || m.role === 'coach');
  const students = (members.data ?? []).filter((m) => m.role === 'student');
  const batches = (groups.data ?? []).filter((g) => g.kind === 'batch');
  const name = (id: string | null) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '';
  const classById = new Map(classes.data?.map((c) => [c.id, c]));
  const studentGroups = new Set(
    memberships.data?.filter((m) => m.studentId === student).map((m) => m.groupId),
  );

  function visible(e: CalendarEvent) {
    if (coach && e.coach_id !== coach) return false;
    if (kind && e.kind !== kind) return false;
    if (!batch && !student) return true;
    const c = e.classroom_id ? classById.get(e.classroom_id) : undefined;
    if (!c) return false;
    if (batch && c.group_id !== batch && !c.targets.some((x) => x.group_id === batch)) return false;
    if (
      student &&
      !c.is_public &&
      !c.targets.some(
        (x) => x.student_id === student || (x.group_id && studentGroups.has(x.group_id)),
      )
    )
      return false;
    return true;
  }

  const list = (events.data ?? []).filter(visible);
  const shift = (n: number) =>
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + n));

  return (
    <div className="flex flex-col gap-6">
      <Card title={t('calendar.title')}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => shift(-7)}>
            {t('calendar.prevWeek')}
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-sm"
            onClick={() => setAnchor(new Date())}
          >
            {t('calendar.thisWeek')}
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => shift(7)}>
            {t('calendar.nextWeek')}
          </Button>
          <span className="text-sm text-text-muted">
            {t('calendar.timezone', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t('classroom.coach')}
            value={coach}
            onChange={(e) => setCoach(e.target.value)}
            className={select}
          >
            <option value="">{t('calendar.allCoaches')}</option>
            {coaches.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.display_name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('calendar.eventKind')}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={select}
          >
            <option value="">{t('calendar.allKinds')}</option>
            {calendarEventKinds.map((k) => (
              <option key={k} value={k}>
                {t(`calendar.kind_${k}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('classroom.batch')}
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className={select}
          >
            <option value="">{t('calendar.allBatches')}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('students.title')}
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            className={select}
          >
            <option value="">{t('calendar.allStudents')}</option>
            {students.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.display_name}
              </option>
            ))}
          </select>
        </div>
        {events.isPending ? (
          <Spinner />
        ) : (
          <div className="grid gap-2 md:grid-cols-7">
            {days.map((d) => {
              const dayEvents = list.filter(
                (e) => new Date(e.starts_at).toDateString() === d.toDateString(),
              );
              const slots = (availability.data ?? []).filter(
                (a) => a.day === d.getDay() && (!coach || a.coach_id === coach),
              );
              return (
                <section
                  key={d.toISOString()}
                  className="flex min-h-24 flex-col gap-1 rounded-md bg-bg p-2"
                >
                  <h3
                    className={`text-sm font-bold ${d.toDateString() === new Date().toDateString() ? 'text-orange' : 'text-primary'}`}
                  >
                    {d.toLocaleDateString(i18n.language, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'numeric',
                    })}
                  </h3>
                  {dayEvents.map((e) => (
                    <EventChip key={e.id} event={e} coachName={name(e.coach_id)} />
                  ))}
                  {slots.map((a) => (
                    <p
                      key={a.id}
                      className="rounded border border-dashed border-green px-1 text-xs text-green"
                    >
                      {t('calendar.free')} {a.start} · {a.minutes}′ · {name(a.coach_id)}
                    </p>
                  ))}
                </section>
              );
            })}
          </div>
        )}
        {!events.isPending && list.length === 0 && (
          <p className="text-text-muted">{t('calendar.noEvents')}</p>
        )}
        <ErrorText error={events.error ?? classes.error} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <NewEvent coaches={coaches.map((m) => m.profile)} />
        <Availability coaches={coaches.map((m) => m.profile)} />
        <FindFree name={name} />
      </div>
    </div>
  );
}

function EventChip({ event, coachName }: { event: CalendarEvent; coachName: string }) {
  const { t, i18n } = useT();
  const { academy, session } = useAcademy();
  const { removeEvent } = useCalendarMutations(academy.id, session.user.id);
  const body = (
    <>
      <span className="font-medium">
        {hhmm(event.starts_at, i18n.language)}–{hhmm(event.ends_at, i18n.language)} {event.title}
      </span>
      <span className="text-text-muted">
        {t(`calendar.kind_${event.kind as CalendarEventKind}`)}
        {coachName && ` · ${coachName}`}
      </span>
    </>
  );
  return (
    <div
      className={`flex flex-col rounded border-l-4 px-1 py-0.5 text-xs ${KIND_STYLE[event.kind as CalendarEventKind]}`}
    >
      {event.classroom_id ? (
        <Link
          to="/a/$slug/classes/$id"
          params={{ slug: academy.slug, id: event.classroom_id }}
          className="flex flex-col hover:underline"
        >
          {body}
        </Link>
      ) : (
        <>
          {body}
          <button
            type="button"
            className="self-end text-danger hover:underline"
            disabled={removeEvent.isPending}
            onClick={() => removeEvent.mutate(event.id)}
          >
            {t('studies.delete')}
          </button>
        </>
      )}
    </div>
  );
}

type Person = { id: string; display_name: string };

function NewEvent({ coaches }: { coaches: Person[] }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { addEvent } = useCalendarMutations(academy.id, session.user.id);
  const [kind, setKind] = useState<Exclude<CalendarEventKind, 'class'>>('meeting');
  const [title, setTitle] = useState('');
  const [coachId, setCoachId] = useState(academy.role === 'coach' ? session.user.id : '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const s = localInputToIso(start);
    const en = localInputToIso(end);
    if (!s || !en) return;
    addEvent.mutate(
      { kind, title, coachId: coachId || null, startsAt: new Date(s), endsAt: new Date(en) },
      { onSuccess: () => setTitle('') },
    );
  }

  return (
    <Card title={t('calendar.newEvent')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('calendar.eventKind')}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className={select}
          >
            {calendarEventKinds
              .filter((k) => k !== 'class')
              .map((k) => (
                <option key={k} value={k}>
                  {t(`calendar.kind_${k}`)}
                </option>
              ))}
          </select>
        </label>
        <Field
          label={t('calendar.eventTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={160}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('classroom.coach')}</span>
          <select
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
            className={select}
            disabled={academy.role === 'coach'}
          >
            <option value="">—</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('calendar.start')}
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
        <Field
          label={t('calendar.end')}
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
        />
        <ErrorText error={addEvent.error} />
        <Button type="submit" variant="cta" className="self-start" disabled={addEvent.isPending}>
          {t('calendar.newEvent')}
        </Button>
      </form>
    </Card>
  );
}

function Availability({ coaches }: { coaches: Person[] }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const availability = useCoachAvailability(academy.id);
  const { addAvailability, removeAvailability } = useCalendarMutations(academy.id, session.user.id);
  const owner = academy.role === 'owner';
  const [coachId, setCoachId] = useState(session.user.id);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('17:00');
  const [minutes, setMinutes] = useState(180);
  const slots = (availability.data ?? []).filter((a) => a.coach_id === coachId);

  function onAdd(e: FormEvent) {
    e.preventDefault();
    addAvailability.mutate({ coachId, day, start, minutes });
  }

  return (
    <Card title={t('calendar.availability')}>
      <p className="text-sm text-text-muted">{t('calendar.availabilityHint')}</p>
      {owner && (
        <select
          aria-label={t('classroom.coach')}
          value={coachId}
          onChange={(e) => setCoachId(e.target.value)}
          className={select}
        >
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      )}
      {slots.length === 0 ? (
        <p className="text-sm text-text-muted">{t('calendar.noAvailability')}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {slots.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span>
                {t(`weekday.d${a.day as 0 | 1 | 2 | 3 | 4 | 5 | 6}`)} {a.start} · {a.minutes}′
              </span>
              <button
                type="button"
                className="text-danger hover:underline"
                disabled={removeAvailability.isPending}
                onClick={() => removeAvailability.mutate(a.id)}
              >
                {t('groups.removeSlot')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2">
        <select
          aria-label={t('groups.schedule')}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className={select}
        >
          {WEEKDAYS.map((d) => (
            <option key={d} value={d}>
              {t(`weekday.d${d}`)}
            </option>
          ))}
        </select>
        <input
          type="time"
          aria-label={t('calendar.start')}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={select}
          required
        />
        <input
          type="number"
          aria-label={t('groups.minutes')}
          min={15}
          max={720}
          step={15}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className={`${select} w-20`}
        />
        <Button
          type="submit"
          variant="ghost"
          className="text-sm"
          disabled={addAvailability.isPending}
        >
          {t('calendar.addSlot')}
        </Button>
      </form>
      <ErrorText error={addAvailability.error ?? removeAvailability.error ?? availability.error} />
    </Card>
  );
}

function FindFree({ name }: { name: (id: string) => string }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const availability = useCoachAvailability(academy.id);
  const [start, setStart] = useState('');
  const [minutes, setMinutes] = useState(60);
  const startIso = localInputToIso(start);
  const s = startIso ? new Date(startIso) : null;
  const e = s ? new Date(s.getTime() + minutes * 60_000) : null;
  const dayStart = s ? new Date(s.getFullYear(), s.getMonth(), s.getDate()) : new Date();
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
  const events = useCalendarEvents(academy.id, dayStart, dayEnd);
  const free =
    s && e && availability.data && events.data
      ? freeCoaches(
          availability.data.map((a) => ({
            coachId: a.coach_id,
            day: a.day,
            start: a.start,
            minutes: a.minutes,
          })),
          events.data.map((x) => ({
            coachId: x.coach_id,
            startsAt: new Date(x.starts_at),
            endsAt: new Date(x.ends_at),
          })),
          s,
          e,
        )
      : null;

  return (
    <Card title={t('calendar.findFree')}>
      <Field
        label={t('calendar.start')}
        type="datetime-local"
        value={start}
        onChange={(ev) => setStart(ev.target.value)}
      />
      <Field
        label={t('classroom.minutes')}
        type="number"
        min={15}
        max={600}
        step={15}
        value={minutes}
        onChange={(ev) => setMinutes(Number(ev.target.value))}
      />
      {free && (
        <p role="status" className="text-sm">
          {free.length === 0
            ? t('calendar.noneFree')
            : t('calendar.freeCoaches', { names: free.map(name).join(', ') })}
        </p>
      )}
    </Card>
  );
}
