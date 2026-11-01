import { TIME_PRESETS } from '@erpchess/api';
import { useMembers, useSimulMutations, useSimuls } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Plus, Search, Swords } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { TargetPicker } from '../components/assign/TargetPicker';
import {
  Button,
  Card,
  type DateRange,
  DateRangeFields,
  EmptyState,
  ErrorText,
  Field,
  FilterBar,
  PageHeader,
  Pagination,
  PeriodQuickPick,
  SearchInput,
  Spinner,
  StatCard,
  StatusChips,
  type ViewMode,
  ViewToggle,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime, localInputToIso } from '../lib/format';
import { inDateRange, paginate } from '../lib/list-tools';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/simuls/')({
  component: SimulsPage,
});

const STATUSES = ['active', 'upcoming', 'finished'] as const;
type StatusFilter = 'all' | (typeof STATUSES)[number];

function SimulsPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const simuls = useSimuls(academy.id);
  const members = useMembers(academy.id);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [view, setView] = useState<ViewMode>('list');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const name = (id: string) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '?';

  if (creating) return <SimulForm onDone={() => setCreating(false)} />;

  // Mọi thay đổi bộ lọc đưa về trang 1
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const list = simuls.data ?? [];
  const needle = q.trim().toLowerCase();
  const shown = list
    .filter((s) => status === 'all' || s.status === status)
    .filter((s) => inDateRange(s.starts_at ?? s.created_at, range.from, range.to))
    .filter((s) => !needle || `${s.title} ${s.description}`.toLowerCase().includes(needle));
  const filtered = needle !== '' || status !== 'all' || range.from !== '' || range.to !== '';
  const count = (st: string) => list.filter((x) => x.status === st).length;

  const createButton = staff && (
    <Button variant="cta" icon={Plus} onClick={() => setCreating(true)}>
      {t('simul.create')}
    </Button>
  );

  return (
    <>
      <PageHeader
        icon={Swords}
        title={t('simul.title')}
        subtitle={t('play.title')}
        actions={
          <>
            <Link
              to="/a/$slug/play"
              params={{ slug: academy.slug }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 font-medium hover:bg-primary-soft"
            >
              ← {t('play.title')}
            </Link>
            {createButton}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard accent="blue" icon={Swords} label={t('simul.total')} value={list.length} />
        <StatCard accent="green" label={t('simul.active')} value={count('active')} />
        <StatCard accent="orange" label={t('simul.upcoming')} value={count('upcoming')} />
        <StatCard accent="gray" label={t('simul.finished')} value={count('finished')} />
      </div>
      <FilterBar>
        <SearchInput value={q} onChange={reset(setQ)} placeholder={t('simul.search')} />
        <DateRangeFields value={range} onChange={reset(setRange)} />
        <PeriodQuickPick onPick={reset(setRange)} />
        <StatusChips
          value={status}
          onChange={reset(setStatus)}
          options={[
            { value: 'all', label: t('tournament.all') },
            ...STATUSES.map((s) => ({ value: s, label: t(`simul.${s}`) })),
          ]}
        />
        <ViewToggle value={view} onChange={setView} views={['list', 'grid']} />
      </FilterBar>
      {simuls.isPending ? (
        <Spinner />
      ) : simuls.error ? (
        <ErrorText error={simuls.error} />
      ) : shown.length === 0 ? (
        <EmptyState
          dashed
          icon={filtered ? Search : Swords}
          title={filtered ? t('learnPage.noMatch') : t('simul.none')}
          action={filtered ? undefined : createButton}
        />
      ) : (
        <Card>
          <ul
            className={
              view === 'grid'
                ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
                : 'flex flex-col divide-y divide-text-muted/15'
            }
          >
            {paginate(shown, page, pageSize).map((s) => (
              <li
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-2 ${
                  view === 'grid' ? 'rounded-lg border border-border p-4' : 'py-3'
                }`}
              >
                <div className="flex flex-col">
                  <Link
                    to="/a/$slug/simuls/$id"
                    params={{ slug: academy.slug, id: s.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {s.title}
                  </Link>
                  <span className="text-sm text-text-muted">
                    {name(s.host_id)} · {t('simul.boards', { count: s.boardCount })}
                    {s.starts_at && ` · ${formatDateTime(s.starts_at, i18n.language)}`}
                  </span>
                </div>
                <span className="text-sm">
                  {t(`simul.${s.status as (typeof STATUSES)[number]}`)}
                </span>
              </li>
            ))}
          </ul>
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
        </Card>
      )}
    </>
  );
}

function SimulForm({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const members = useMembers(academy.id);
  const { create } = useSimulMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hostId, setHostId] = useState(session.user.id);
  const [hostColor, setHostColor] = useState<'w' | 'b'>('w');
  const [startsAt, setStartsAt] = useState('');
  const [preset, setPreset] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const hosts = (members.data ?? []).filter((m) => m.role === 'owner' || m.role === 'coach');
  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tc = TIME_PRESETS.find((p) => p.id === preset);
    create.mutate(
      {
        title,
        description,
        hostId,
        hostColor,
        startsAt: localInputToIso(startsAt) ?? null,
        baseMs: tc?.baseMs ?? null,
        incMs: tc?.incMs ?? 0,
        groupIds,
        studentIds,
      },
      {
        onSuccess: (s) =>
          void navigate({ to: '/a/$slug/simuls/$id', params: { slug: academy.slug, id: s.id } }),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card title={t('simul.create')}>
        <Field
          label={t('simul.name')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={160}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('simul.description')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('simul.host')}</span>
          <select value={hostId} onChange={(e) => setHostId(e.target.value)} className={select}>
            {hosts.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.display_name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-2 font-medium">{t('simul.hostColor')}</legend>
          {(['w', 'b'] as const).map((c) => (
            <label key={c} className="flex items-center gap-2">
              <input
                type="radio"
                name="hostColor"
                checked={hostColor === c}
                onChange={() => setHostColor(c)}
              />
              {c === 'w' ? t('play.white') : t('play.black')}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('play.time')}</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={select}>
            <option value="">{t('play.unlimited')}</option>
            {TIME_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
          {preset && <span className="text-xs text-text-muted">{t('simul.hostClockNote')}</span>}
        </label>
        <Field
          label={t('simul.startsAt')}
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        {create.error instanceof Error && create.error.message === 'targets' ? (
          <p role="alert" className="text-sm text-danger">
            {t('simul.noTargets')}
          </p>
        ) : (
          <ErrorText error={create.error} />
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="cta"
            disabled={create.isPending || groupIds.length + studentIds.length === 0}
          >
            {t('simul.create')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </Card>
      <Card title={t('simul.participants')}>
        <TargetPicker
          groupIds={groupIds}
          studentIds={studentIds}
          onGroups={setGroupIds}
          onStudents={setStudentIds}
        />
      </Card>
    </form>
  );
}
