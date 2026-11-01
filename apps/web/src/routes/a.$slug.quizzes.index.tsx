import { percent } from '@erpchess/api';
import { useQuizStarted, useQuizzes } from '@erpchess/api/react';
import { isStaff, type QuizStatus, quizStatus } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Brain, Play, Plus, Search, Timer, Trophy } from 'lucide-react';
import { useState } from 'react';
import { AutoQuiz } from '../components/quiz/AutoQuiz';
import { FILTERS, type Filter, filterQuizzes, type Sort } from '../components/quiz/filter-quizzes';
import { QuizBoardTab } from '../components/quiz/QuizBoardTab';
import { QuizSchedulesPanel } from '../components/quiz/QuizSchedulesPanel';
import {
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
  Tabs,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { paginate } from '../lib/list-tools';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/quizzes/')({
  component: QuizzesPage,
});

const BADGE: Record<QuizStatus, string> = {
  open: 'bg-green/15 text-green',
  upcoming: 'bg-yellow/20 text-orange',
  closed: 'bg-text-muted/15 text-text-muted',
};

function QuizzesPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const [tab, setTab] = useState<'list' | 'auto' | 'board'>('list');

  const createLink = staff && (
    <Link
      to="/a/$slug/quizzes/new"
      params={{ slug: academy.slug }}
      search={{}}
      className="inline-flex items-center gap-2 rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
    >
      <Plus className="size-4" aria-hidden="true" />
      {t('quiz.create')}
    </Link>
  );

  return (
    <>
      <PageHeader
        icon={Brain}
        title={t('quiz.title')}
        subtitle={t('learnPage.quizSubtitle')}
        actions={createLink}
      />
      <Tabs
        variant="underline"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'list', label: t('learnPage.quizTabList'), icon: Brain },
          ...(staff
            ? [
                {
                  value: 'auto' as const,
                  label: t('learnPage.quizTabAuto'),
                  icon: Timer,
                  badge: t('ui.badgeNew'),
                },
              ]
            : []),
          { value: 'board', label: t('learnPage.quizTabBoard'), icon: Trophy },
        ]}
      />
      {tab === 'board' ? (
        <QuizBoardTab />
      ) : staff && tab === 'auto' ? (
        <AutoTab />
      ) : (
        <QuizList createLink={createLink} />
      )}
    </>
  );
}

/** Tab "Quiz tự động": lịch tự giao theo chuỗi study và tạo quiz tự động theo cấp độ. */
function AutoTab() {
  const { t } = useT();
  const { academy } = useAcademy();
  const navigate = useNavigate();
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <QuizSchedulesPanel />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-primary">{t('learnPage.quizAutoTitle')}</h2>
        <AutoQuiz
          onDone={(id) =>
            void navigate({ to: '/a/$slug/quizzes/$id', params: { slug: academy.slug, id } })
          }
        />
      </div>
    </div>
  );
}

function QuizList({ createLink }: { createLink: React.ReactNode }) {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const quizzes = useQuizzes(academy.id);
  // Chỉ nhân sự có số liệu này; học viên/phụ huynh không gọi RPC
  const started = useQuizStarted(staff ? academy.id : undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [sort, setSort] = useState<Sort>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Mọi thay đổi bộ lọc đưa về trang 1
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  if (quizzes.isPending) return <Spinner />;
  if (quizzes.error) return <ErrorText error={quizzes.error} />;

  const all = quizzes.data.map((q) => ({ q, status: quizStatus(q.starts_at, q.due_at) }));
  const count = (s: QuizStatus) => all.filter((r) => r.status === s).length;
  const rows = filterQuizzes(all, { search, filter, range, sort });
  const filtered = search.trim() !== '' || filter !== 'all' || range.from !== '' || range.to !== '';

  return (
    <>
      <div className={`grid grid-cols-2 gap-3 ${staff ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        <StatCard
          accent="blue"
          icon={Brain}
          label={t('learnPage.quizStatTotal')}
          value={all.length}
        />
        <StatCard accent="green" label={t('quiz.status_open')} value={count('open')} />
        <StatCard accent="orange" label={t('quiz.status_upcoming')} value={count('upcoming')} />
        <StatCard accent="gray" label={t('quiz.status_closed')} value={count('closed')} />
        {staff && started.data && (
          <StatCard
            accent="purple"
            icon={Play}
            label={t('learnPage.quizStatStarted')}
            value={
              percent(started.data.started, started.data.open) === null
                ? '—'
                : `${percent(started.data.started, started.data.open)}%`
            }
            hint={
              started.data.open > 0
                ? t('learnPage.quizStatStartedHint', {
                    started: started.data.started,
                    open: started.data.open,
                  })
                : t('learnPage.quizStatStartedNone')
            }
          />
        )}
      </div>

      <FilterBar>
        <SearchInput
          value={search}
          onChange={reset(setSearch)}
          placeholder={t('learnPage.quizSearch')}
        />
        <DateRangeFields value={range} onChange={reset(setRange)} />
        <PeriodQuickPick onPick={reset(setRange)} />
        <SelectField
          label={t('learnPage.sort')}
          value={sort}
          onChange={reset(setSort)}
          options={[
            { value: 'newest', label: t('learnPage.sortNewest') },
            { value: 'due', label: t('learnPage.sortDue') },
            { value: 'title', label: t('learnPage.sortTitle') },
          ]}
        />
        <StatusChips
          value={filter}
          onChange={reset(setFilter)}
          options={FILTERS.map((f) => ({ value: f, label: t(`quiz.filter_${f}`) }))}
        />
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          dashed
          icon={filtered ? Search : Brain}
          title={filtered ? t('learnPage.noMatch') : t('quiz.none')}
          description={filtered || !staff ? undefined : t('learnPage.quizEmptyDesc')}
          action={filtered ? undefined : createLink}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm">
          <ul className="flex flex-col divide-y divide-border">
            {paginate(rows, page, pageSize).map(({ q, status }) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-col">
                  <Link
                    to="/a/$slug/quizzes/$id"
                    params={{ slug: academy.slug, id: q.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {q.title}
                  </Link>
                  <span className="text-sm text-text-muted">
                    {staff && `${t('assignments.puzzleCount', { count: q.itemCount })} · `}
                    {q.open_to_all ? t('quiz.openToAll') : t('quiz.assigned')}
                    {q.due_at &&
                      ` · ${t('assignments.dueAt', { date: formatDateTime(q.due_at, i18n.language) })}`}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[status]}`}>
                  {t(`quiz.status_${status}`)}
                </span>
              </li>
            ))}
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
        </div>
      )}
    </>
  );
}
