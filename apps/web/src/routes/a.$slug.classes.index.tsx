import type { ClassroomSummary } from '@erpchess/api';
import { useClassrooms, useMembers } from '@erpchess/api/react';
import {
  type CalendarRange,
  calendarRange,
  calendarRanges,
  classesToCsv,
  isStaff,
} from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ClassroomForm } from '../components/classroom/ClassroomForm';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { downloadCsv } from '../lib/download';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/classes/')({
  component: ClassesPage,
});

/** yyyy-mm-dd theo giờ địa phương cho <input type="date">. */
function dateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromDateInput(v: string): Date {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function counts(c: ClassroomSummary) {
  const by = (s: string) => c.attendance.filter((a) => a.status === s).length;
  return { present: by('present'), late: by('late'), absent: by('absent') };
}

function ClassesPage() {
  const { t, i18n } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const [creating, setCreating] = useState(false);
  const [mine, setMine] = useState(false);
  const [range, setRange] = useState(() => {
    const r = calendarRange('month');
    return { from: dateInput(r.from), to: dateInput(new Date(r.to.getTime() - 86_400_000)) };
  });
  const from = fromDateInput(range.from);
  const to = fromDateInput(range.to);
  to.setDate(to.getDate() + 1);
  const classes = useClassrooms(academy.id, {
    from,
    to,
    createdBy: mine ? session.user.id : undefined,
  });
  const members = useMembers(academy.id);
  const name = (id: string | null) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '';

  if (creating) return <ClassroomForm onDone={() => setCreating(false)} />;

  function quick(kind: CalendarRange) {
    const r = calendarRange(kind);
    setRange({ from: dateInput(r.from), to: dateInput(new Date(r.to.getTime() - 86_400_000)) });
  }

  function onExport() {
    const rows = (classes.data ?? []).map((c) => ({
      title: c.title,
      kind: t(`classroom.kind_${c.kind === 'offline' ? 'offline' : 'online'}`),
      startsAt: new Date(c.starts_at),
      minutes: c.minutes,
      coach: name(c.coach_id),
      ...counts(c),
    }));
    downloadCsv(
      `lop-hoc-${academy.slug}-${range.from}-${range.to}.csv`,
      classesToCsv(rows, [
        t('classroom.csvTitle'),
        t('classroom.csvKind'),
        t('classroom.csvStart'),
        t('classroom.csvMinutes'),
        t('classroom.csvCoach'),
        t('classroom.csvPresent'),
        t('classroom.csvLate'),
        t('classroom.csvAbsent'),
      ]),
    );
  }

  const pill =
    'rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary';
  return (
    <Card title={t('classroom.title')}>
      <div className="flex flex-wrap items-end gap-3">
        {staff && (
          <div role="tablist" className="flex gap-1">
            {([false, true] as const).map((m) => (
              <button
                key={String(m)}
                type="button"
                role="tab"
                aria-selected={mine === m}
                onClick={() => setMine(m)}
                className={pill}
              >
                {m ? t('classroom.mine') : t('classroom.everyone')}
              </button>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('classroom.from')}</span>
          <input
            type="date"
            value={range.from}
            onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('classroom.to')}</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
          />
        </label>
        <div className="flex gap-1">
          {calendarRanges.map((k) => (
            <Button key={k} variant="ghost" className="px-2 py-1 text-sm" onClick={() => quick(k)}>
              {t(`classroom.range_${k}`)}
            </Button>
          ))}
        </div>
        {staff && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              onClick={onExport}
              disabled={!classes.data || classes.data.length === 0}
            >
              {t('classroom.exportCsv')}
            </Button>
            <Button variant="cta" onClick={() => setCreating(true)}>
              {t('classroom.create')}
            </Button>
          </div>
        )}
      </div>
      {classes.isPending ? (
        <Spinner />
      ) : classes.error ? (
        <ErrorText error={classes.error} />
      ) : classes.data.length === 0 ? (
        <div className="text-text-muted">
          <p>{t('classroom.none')}</p>
          {staff && <p className="text-sm">{t('classroom.noneHint')}</p>}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-text-muted/15">
          {classes.data.map((c) => {
            const n = counts(c);
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-col">
                  <Link
                    to="/a/$slug/classes/$id"
                    params={{ slug: academy.slug, id: c.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {c.title}
                  </Link>
                  <span className="text-sm text-text-muted">
                    {formatDateTime(c.starts_at, i18n.language)} · {c.minutes}′ ·{' '}
                    {t(`classroom.kind_${c.kind === 'offline' ? 'offline' : 'online'}`)}
                    {c.coach_id && ` · ${name(c.coach_id)}`}
                    {c.is_public && ` · ${t('classroom.public')}`}
                  </span>
                </div>
                {staff && (
                  <span className="text-sm text-text-muted">
                    {t('classroom.status_present')} {n.present + n.late} ·{' '}
                    {t('classroom.status_absent')} {n.absent}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
