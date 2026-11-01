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
import { CalendarDays, Download, Plus, School, Video } from 'lucide-react';
import { useState } from 'react';
import { ClassroomForm } from '../components/classroom/ClassroomForm';
import {
  Button,
  Card,
  DateRangeFields,
  EmptyState,
  ErrorText,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Spinner,
  StatCard,
  Tabs,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { downloadCsv } from '../lib/download';
import { formatDateTime } from '../lib/format';
import { paginate } from '../lib/list-tools';
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const needle = search.trim().toLowerCase();
  const rows = (classes.data ?? []).filter(
    (c) => !needle || c.title.toLowerCase().includes(needle),
  );
  const online = rows.filter((c) => c.kind !== 'offline').length;

  const actions = staff && (
    <>
      <Button
        variant="secondary"
        icon={Download}
        onClick={onExport}
        disabled={!classes.data || classes.data.length === 0}
      >
        {t('classroom.exportCsv')}
      </Button>
      <Button variant="cta" icon={Plus} onClick={() => setCreating(true)}>
        {t('classroom.create')}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        icon={School}
        title={t('classroom.title')}
        subtitle={t('learnPage.classesSubtitle')}
        actions={actions}
      />
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          accent="blue"
          icon={CalendarDays}
          label={t('learnPage.classesStatTotal')}
          value={rows.length}
        />
        <StatCard
          accent="green"
          icon={Video}
          label={t('learnPage.classesStatOnline')}
          value={online}
        />
        <StatCard
          accent="orange"
          icon={School}
          label={t('learnPage.classesStatOffline')}
          value={rows.length - online}
        />
      </div>
      {staff && (
        <Tabs
          variant="pills"
          value={mine ? 'mine' : 'all'}
          onChange={(v) => {
            setMine(v === 'mine');
            setPage(1);
          }}
          items={[
            { value: 'all', label: t('classroom.everyone') },
            { value: 'mine', label: t('classroom.mine') },
          ]}
        />
      )}
      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t('learnPage.classesSearch')}
        />
        <DateRangeFields
          value={range}
          onChange={(v) => {
            // Khoảng ngày luôn phải đủ hai đầu để truy vấn được
            if (v.from && v.to) {
              setRange(v);
              setPage(1);
            }
          }}
        />
        <div className="flex gap-1">
          {calendarRanges.map((k) => (
            <Button key={k} variant="secondary" size="sm" onClick={() => quick(k)}>
              {t(`classroom.range_${k}`)}
            </Button>
          ))}
        </div>
      </FilterBar>
      {classes.isPending ? (
        <Spinner />
      ) : classes.error ? (
        <ErrorText error={classes.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          dashed
          icon={CalendarDays}
          title={classes.data.length === 0 ? t('classroom.none') : t('learnPage.noMatch')}
          description={classes.data.length === 0 && staff ? t('classroom.noneHint') : undefined}
          action={
            classes.data.length === 0 && staff ? (
              <Button variant="cta" onClick={() => setCreating(true)}>
                {t('classroom.create')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <ul className="flex flex-col divide-y divide-text-muted/15">
            {paginate(rows, page, pageSize).map((c) => {
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
          <Pagination
            page={page}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </Card>
      )}
    </>
  );
}
