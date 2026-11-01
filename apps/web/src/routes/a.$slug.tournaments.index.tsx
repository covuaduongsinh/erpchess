import type { TournamentSummary } from '@erpchess/api';
import { useMembers, useTournaments } from '@erpchess/api/react';
import { calendarRange, isStaff, weekDays } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus, Search, Trophy } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Card,
  type DateRange,
  DateRangeFields,
  EmptyState,
  ErrorText,
  FilterBar,
  PageHeader,
  Pagination,
  PeriodQuickPick,
  SearchInput,
  SelectField,
  Spinner,
  StatCard,
  StatusChips,
  type ViewMode,
  ViewToggle,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { inDateRange, paginate } from '../lib/list-tools';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/tournaments/')({
  component: TournamentsPage,
});

const STATUSES = ['all', 'active', 'upcoming', 'finished'] as const;
const SORTS = ['date', 'name', 'players'] as const;
type Status = (typeof STATUSES)[number];
type Sort = (typeof SORTS)[number];

function timeLabel(t: TournamentSummary, unlimited: string) {
  return t.base_ms === null ? unlimited : `${t.base_ms / 60_000}+${t.inc_ms / 1000}`;
}

function TournamentsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const list = useTournaments(academy.id);
  const members = useMembers(academy.id);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [sort, setSort] = useState<Sort>('date');
  const [view, setView] = useState<ViewMode>('list');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const name = (id: string) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '';

  // Mọi thay đổi bộ lọc đưa về trang 1
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const needle = q.trim().toLowerCase();
  const all = list.data ?? [];
  const shown = all
    .filter((x) => status === 'all' || x.status === status)
    .filter((x) => inDateRange(x.starts_at ?? x.created_at, range.from, range.to))
    .filter(
      (x) =>
        !needle ||
        `${x.title} ${x.location} ${x.playerIds.map(name).join(' ')}`
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : sort === 'players'
          ? b.playerIds.length - a.playerIds.length
          : (b.starts_at ?? b.created_at).localeCompare(a.starts_at ?? a.created_at),
    );
  const filtered = needle !== '' || status !== 'all' || range.from !== '' || range.to !== '';
  const count = (s: string) => all.filter((x) => x.status === s).length;
  const paged = view === 'calendar' ? shown : paginate(shown, page, pageSize);

  const createLink = staff && (
    <Link
      to="/a/$slug/tournaments/new"
      params={{ slug: academy.slug }}
      className="inline-flex items-center gap-2 rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
    >
      <Plus className="size-4" aria-hidden="true" />
      {t('tournament.create')}
    </Link>
  );

  return (
    <>
      <PageHeader icon={Trophy} title={t('tournament.title')} actions={createLink} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard accent="blue" icon={Trophy} label={t('simul.total')} value={all.length} />
        <StatCard accent="green" label={t('tournament.active')} value={count('active')} />
        <StatCard accent="orange" label={t('tournament.upcoming')} value={count('upcoming')} />
        <StatCard accent="gray" label={t('tournament.finished')} value={count('finished')} />
      </div>
      <FilterBar>
        <SearchInput value={q} onChange={reset(setQ)} placeholder={t('tournament.search')} />
        <DateRangeFields value={range} onChange={reset(setRange)} />
        <PeriodQuickPick onPick={reset(setRange)} />
        <SelectField
          label={t('learnPage.sort')}
          value={sort}
          onChange={reset(setSort)}
          options={SORTS.map((s) => ({ value: s, label: t(`tournament.sort_${s}`) }))}
        />
        <StatusChips
          value={status}
          onChange={reset(setStatus)}
          options={STATUSES.map((s) => ({ value: s, label: t(`tournament.${s}`) }))}
        />
        <ViewToggle value={view} onChange={setView} views={['list', 'grid', 'table', 'calendar']} />
      </FilterBar>
      {list.isPending ? (
        <Spinner />
      ) : list.error ? (
        <ErrorText error={list.error} />
      ) : shown.length === 0 && view !== 'calendar' ? (
        <EmptyState
          dashed
          icon={filtered ? Search : Trophy}
          title={filtered ? t('learnPage.noMatch') : t('tournament.none')}
          action={filtered ? undefined : createLink}
        />
      ) : (
        <Card>
          {view === 'list' ? (
            <ListView items={paged} />
          ) : view === 'grid' ? (
            <GridView items={paged} />
          ) : view === 'table' ? (
            <TableView items={paged} />
          ) : (
            <CalendarView items={shown} />
          )}
          {view !== 'calendar' && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={shown.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          )}
        </Card>
      )}
    </>
  );
}

/** Chế độ lưới: mỗi giải một thẻ. */
function GridView({ items }: { items: TournamentSummary[] }) {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((x) => (
        <li key={x.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <Link
            to="/a/$slug/tournaments/$id"
            params={{ slug: academy.slug, id: x.id }}
            className="font-semibold text-primary hover:underline"
          >
            {x.title}
          </Link>
          <span className="text-sm text-text-muted">
            {t(`tournament.format_${x.format as 'swiss'}`)} ·{' '}
            {timeLabel(x, t('tournament.unlimited'))}
          </span>
          <span className="text-sm text-text-muted">
            {t('tournament.playerCount', { count: x.playerIds.length })}
            {x.location && ` · ${x.location}`}
          </span>
          {x.starts_at && (
            <span className="text-xs text-text-muted">
              {formatDateTime(x.starts_at, i18n.language)}
            </span>
          )}
          <span className="mt-auto text-sm font-medium">
            {t(`tournament.${x.status as 'active'}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ListView({ items }: { items: TournamentSummary[] }) {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  return (
    <ul className="flex flex-col divide-y divide-text-muted/15">
      {items.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="flex flex-col">
            <Link
              to="/a/$slug/tournaments/$id"
              params={{ slug: academy.slug, id: x.id }}
              className="font-medium text-primary hover:underline"
            >
              {x.title}
            </Link>
            <span className="text-sm text-text-muted">
              {t(`tournament.format_${x.format as 'swiss'}`)} ·{' '}
              {timeLabel(x, t('tournament.unlimited'))} ·{' '}
              {t('tournament.playerCount', { count: x.playerIds.length })}
              {x.location && ` · ${x.location}`}
              {x.starts_at && ` · ${formatDateTime(x.starts_at, i18n.language)}`}
            </span>
          </div>
          <span className="text-sm">{t(`tournament.${x.status as 'active'}`)}</span>
        </li>
      ))}
    </ul>
  );
}

function TableView({ items }: { items: TournamentSummary[] }) {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-text-muted">
          <tr>
            <th className="py-2 pr-3">{t('tournament.name')}</th>
            <th className="py-2 pr-3">{t('tournament.format')}</th>
            <th className="py-2 pr-3">{t('tournament.time')}</th>
            <th className="py-2 pr-3">{t('tournament.players')}</th>
            <th className="py-2 pr-3">{t('tournament.startsAt')}</th>
            <th className="py-2">{t('tournament.status')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x) => (
            <tr key={x.id} className="border-t border-text-muted/15">
              <td className="py-2 pr-3">
                <Link
                  to="/a/$slug/tournaments/$id"
                  params={{ slug: academy.slug, id: x.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {x.title}
                </Link>
              </td>
              <td className="py-2 pr-3">{t(`tournament.format_${x.format as 'swiss'}`)}</td>
              <td className="py-2 pr-3">{timeLabel(x, t('tournament.unlimited'))}</td>
              <td className="py-2 pr-3">{x.playerIds.length}</td>
              <td className="py-2 pr-3">
                {x.starts_at ? formatDateTime(x.starts_at, i18n.language) : '—'}
              </td>
              <td className="py-2">{t(`tournament.${x.status as 'active'}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Lưới tháng (Thứ hai đầu tuần); giải không có giờ bắt đầu thì không hiện trên lịch. */
function CalendarView({ items }: { items: TournamentSummary[] }) {
  const { i18n } = useT();
  const { academy } = useAcademy();
  const [anchor, setAnchor] = useState(() => new Date());
  const month = calendarRange('month', anchor);
  const weeks: Date[][] = [];
  for (
    let d = weekDays(month.from)[0] as Date;
    d < month.to;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
  ) {
    weeks.push(weekDays(d));
  }
  const shift = (n: number) => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + n, 1));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => shift(-1)}>
          ←
        </Button>
        <span className="font-medium">
          {month.from.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}
        </span>
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => shift(1)}>
          →
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {weeks.flat().map((d) => {
          const today = items.filter(
            (x) => x.starts_at && new Date(x.starts_at).toDateString() === d.toDateString(),
          );
          return (
            <div
              key={d.toISOString()}
              className={`min-h-20 rounded bg-bg p-1 ${d.getMonth() === month.from.getMonth() ? '' : 'opacity-40'}`}
            >
              <span className="text-text-muted">{d.getDate()}</span>
              {today.map((x) => (
                <Link
                  key={x.id}
                  to="/a/$slug/tournaments/$id"
                  params={{ slug: academy.slug, id: x.id }}
                  className="mt-1 block truncate rounded bg-primary/10 px-1 text-primary hover:underline"
                  title={x.title}
                >
                  {new Date(x.starts_at as string).toLocaleTimeString(i18n.language, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  {x.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
