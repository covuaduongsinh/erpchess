import type { TournamentSummary } from '@erpchess/api';
import { useMembers, useTournaments } from '@erpchess/api/react';
import {
  type CalendarRange,
  calendarRange,
  calendarRanges,
  isStaff,
  weekDays,
} from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/tournaments/')({
  component: TournamentsPage,
});

const STATUSES = ['all', 'active', 'upcoming', 'finished'] as const;
const VIEWS = ['list', 'table', 'calendar'] as const;
const SORTS = ['date', 'name', 'players'] as const;
type Status = (typeof STATUSES)[number];

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
  const [range, setRange] = useState<CalendarRange | ''>('');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('date');
  const [view, setView] = useState<(typeof VIEWS)[number]>('list');
  const name = (id: string) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '';

  const needle = q.trim().toLowerCase();
  const r = range ? calendarRange(range) : null;
  const shown = (list.data ?? [])
    .filter((x) => status === 'all' || x.status === status)
    .filter((x) => {
      if (!r) return true;
      const at = x.starts_at ? new Date(x.starts_at) : new Date(x.created_at);
      return at >= r.from && at < r.to;
    })
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
  const pill =
    'rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary';
  const select = 'rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm';

  return (
    <Card title={t('tournament.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label={t('tournament.search')}
          placeholder={t('tournament.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-text-muted/30 bg-white px-3 py-2"
        />
        {staff && (
          <Link
            to="/a/$slug/tournaments/new"
            params={{ slug: academy.slug }}
            className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
          >
            {t('tournament.create')}
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={pill}
            >
              {t(`tournament.${s}`)}
            </button>
          ))}
        </div>
        <select
          aria-label={t('classroom.from')}
          value={range}
          onChange={(e) => setRange(e.target.value as CalendarRange | '')}
          className={select}
        >
          <option value="">{t('tournament.all')}</option>
          {calendarRanges.map((k) => (
            <option key={k} value={k}>
              {t(`classroom.range_${k}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('tournament.sort_date')}
          value={sort}
          onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}
          className={select}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`tournament.sort_${s}`)}
            </option>
          ))}
        </select>
        <div role="tablist" className="ml-auto flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={pill}
            >
              {t(`tournament.view_${v}`)}
            </button>
          ))}
        </div>
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.error ? (
        <ErrorText error={list.error} />
      ) : shown.length === 0 && view !== 'calendar' ? (
        <p className="text-text-muted">{t('tournament.none')}</p>
      ) : view === 'list' ? (
        <ListView items={shown} />
      ) : view === 'table' ? (
        <TableView items={shown} />
      ) : (
        <CalendarView items={shown} />
      )}
    </Card>
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
