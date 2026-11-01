import type { StudyScope, StudySummary } from '@erpchess/api';
import {
  useCollectionMutations,
  useCollections,
  useStudies,
  useStudyMutations,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Download, FileText, Library, Plus, Search, Settings } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { LichessImportDialog } from '../components/study/LichessImportDialog';
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
  SelectField,
  Spinner,
  Tabs,
  type ViewMode,
  ViewToggle,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { inDateRange, paginate } from '../lib/list-tools';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/studies/')({
  component: StudiesPage,
});

const SCOPES: StudyScope[] = ['mine', 'academy', 'public'];
type Sort = 'newest' | 'oldest' | 'title';

function StudiesPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const [tab, setTab] = useState<'list' | 'collections'>('list');
  const [scope, setScope] = useState<StudyScope>(staff ? 'mine' : 'academy');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<ViewMode>('list');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [importing, setImporting] = useState(false);

  const base = { academyId: academy.id, userId: session.user.id };
  const byScope = {
    mine: useStudies({ scope: 'mine', ...base }),
    academy: useStudies({ scope: 'academy', ...base }),
    public: useStudies({ scope: 'public', ...base }),
  };
  const studies = byScope[scope];
  const visibleScopes = SCOPES.filter((s) => staff || s !== 'mine');

  // Mọi thay đổi bộ lọc đưa về trang 1
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const needle = search.trim().toLowerCase();
  const shown = (studies.data ?? [])
    .filter(
      (x) =>
        (!needle || `${x.title} ${x.description}`.toLowerCase().includes(needle)) &&
        inDateRange(x.created_at, range.from, range.to),
    )
    .sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'oldest'
          ? a.created_at.localeCompare(b.created_at)
          : b.created_at.localeCompare(a.created_at),
    );
  const filtered = needle !== '' || range.from !== '' || range.to !== '';

  const headerActions = staff && (
    <>
      <Link
        to="/a/$slug/studies/defaults"
        params={{ slug: academy.slug }}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 font-medium hover:bg-primary-soft"
      >
        <Settings className="size-4" aria-hidden="true" />
        {t('activityDefaults.open')}
      </Link>
      <Button variant="secondary" icon={Download} onClick={() => setImporting(true)}>
        {t('lichessImport.open')}
      </Button>
      <Link
        to="/a/$slug/studies/new"
        params={{ slug: academy.slug }}
        className="inline-flex items-center gap-2 rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('studies.create')}
      </Link>
    </>
  );

  return (
    <>
      {importing && <LichessImportDialog onClose={() => setImporting(false)} />}
      <PageHeader
        icon={FileText}
        title={t('studies.title')}
        subtitle={t('learnPage.studiesSubtitle')}
        actions={headerActions}
      />
      {staff && (
        <Tabs
          variant="underline"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'list', label: t('learnPage.studiesTabList'), icon: FileText },
            { value: 'collections', label: t('learnPage.studiesTabCollections'), icon: Library },
          ]}
        />
      )}
      {staff && tab === 'collections' ? (
        <div className="max-w-xl">
          <CollectionsCard />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              variant="pills"
              ariaLabel={t('learnPage.scopeGroup')}
              value={scope}
              onChange={reset(setScope)}
              items={visibleScopes.map((s) => ({
                value: s,
                label: t(`studies.scope_${s}`),
                count: byScope[s].data?.length,
              }))}
            />
            <span className="text-sm font-medium text-text-muted">
              {t('learnPage.studiesTotal', { count: shown.length })}
            </span>
          </div>
          <FilterBar>
            <SearchInput
              value={search}
              onChange={reset(setSearch)}
              placeholder={t('learnPage.studiesSearch')}
            />
            <DateRangeFields value={range} onChange={reset(setRange)} />
            <PeriodQuickPick onPick={reset(setRange)} />
            <SelectField
              label={t('learnPage.sort')}
              value={sort}
              onChange={reset(setSort)}
              options={[
                { value: 'newest', label: t('learnPage.sortNewest') },
                { value: 'oldest', label: t('learnPage.sortOldest') },
                { value: 'title', label: t('learnPage.sortTitle') },
              ]}
            />
            <ViewToggle value={view} onChange={setView} views={['list', 'grid']} />
          </FilterBar>
          {studies.isPending ? (
            <Spinner />
          ) : studies.error ? (
            <ErrorText error={studies.error} />
          ) : shown.length === 0 ? (
            <EmptyState
              dashed
              icon={filtered ? Search : FileText}
              title={filtered ? t('learnPage.noMatch') : t('studies.none')}
              description={filtered || !staff ? undefined : t('learnPage.studiesEmptyDesc')}
            />
          ) : (
            <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm">
              <ul
                className={
                  view === 'grid'
                    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
                    : 'flex flex-col divide-y divide-border'
                }
              >
                {paginate(shown, page, pageSize).map((x) => (
                  <StudyRow key={x.id} study={x} card={view === 'grid'} />
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
            </div>
          )}
        </>
      )}
    </>
  );
}

function StudyRow({ study, card = false }: { study: StudySummary; card?: boolean }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { remove } = useStudyMutations(session.user.id);
  const [confirm, setConfirm] = useState(false);
  const editable =
    study.academy_id === academy.id &&
    (academy.role === 'owner' ||
      (academy.role === 'coach' && study.created_by === session.user.id));

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 ${
        card ? 'rounded-lg border border-border p-4' : 'py-3'
      }`}
    >
      <div className="flex flex-col">
        <Link
          to="/a/$slug/studies/$id"
          params={{ slug: academy.slug, id: study.id }}
          className="font-medium text-primary hover:underline"
        >
          {study.title}
        </Link>
        <span className="text-sm text-text-muted">
          {t('studies.activityCount', { count: study.activityCount })} ·{' '}
          {t(`studies.visibility_${study.visibility as 'private' | 'academy' | 'public'}`)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {editable && (
          <>
            <Link
              to="/a/$slug/quizzes/new"
              params={{ slug: academy.slug }}
              search={{ studyId: study.id }}
              className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10"
            >
              {t('quiz.fromThisStudy')}
            </Link>
            <Link
              to="/a/$slug/studies/$id/edit"
              params={{ slug: academy.slug, id: study.id }}
              className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10"
            >
              {t('studies.edit')}
            </Link>
            <Button
              variant="ghost"
              className="text-sm text-danger"
              disabled={remove.isPending}
              onClick={() => (confirm ? remove.mutate(study.id) : setConfirm(true))}
            >
              {confirm ? t('studies.confirmDelete') : t('studies.delete')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function CollectionsCard() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const collections = useCollections(academy.id);
  const mine = useStudies({ scope: 'academy', academyId: academy.id, userId: session.user.id });
  const { create, toggle, remove } = useCollectionMutations(academy.id, session.user.id);
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate(name, { onSuccess: () => setName('') });
  }

  return (
    <Card title={t('studies.collections')}>
      {collections.data?.length === 0 && (
        <p className="text-sm text-text-muted">{t('studies.noCollections')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {collections.data?.map((c) => (
          <li key={c.id} className="flex flex-col gap-1">
            <button
              type="button"
              aria-expanded={open === c.id}
              onClick={() => setOpen(open === c.id ? null : c.id)}
              className="flex justify-between text-left font-medium"
            >
              {c.name}
              <span className="text-sm text-text-muted">{c.studyIds.length}</span>
            </button>
            {open === c.id && (
              <div className="flex flex-col gap-1 pl-2 text-sm">
                {mine.data?.length === 0 && (
                  <p className="text-text-muted">{t('studies.collectionHint')}</p>
                )}
                {mine.data?.map((s) => (
                  <label key={s.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.studyIds.includes(s.id)}
                      onChange={(e) =>
                        toggle.mutate({
                          collectionId: c.id,
                          studyId: s.id,
                          included: e.target.checked,
                        })
                      }
                    />
                    {s.title}
                  </label>
                ))}
                <Button
                  variant="ghost"
                  className="self-start text-danger"
                  onClick={() => remove.mutate(c.id)}
                >
                  {t('studies.deleteCollection')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={onCreate} className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label={t('studies.collectionName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="ghost" disabled={create.isPending}>
          {t('common.create')}
        </Button>
      </form>
      <ErrorText error={create.error ?? toggle.error ?? remove.error} />
    </Card>
  );
}
