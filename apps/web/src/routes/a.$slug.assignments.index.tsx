import type { AssignmentSummary, ProgressRow } from '@erpchess/api';
import { useAssignments, useProgress } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ClipboardList, Search } from 'lucide-react';
import { useState } from 'react';
import { Exercises } from '../components/assign/Exercises';
import {
  Card,
  EmptyState,
  ErrorText,
  FilterBar,
  PageHeader,
  SearchInput,
  SelectField,
  Spinner,
  Tabs,
} from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/assignments/')({
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const assignments = useAssignments(academy.id);
  const progress = useProgress({ academyId: academy.id });
  const [tab, setTab] = useState<'assigned' | 'exercises'>('assigned');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'due' | 'title'>('newest');

  const createLink = staff && (
    <Link
      to="/a/$slug/assignments/new"
      params={{ slug: academy.slug }}
      className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
    >
      {t('assignments.create')}
    </Link>
  );

  const needle = search.trim().toLowerCase();
  const shown = (assignments.data ?? [])
    .filter((a) => !needle || a.title.toLowerCase().includes(needle))
    .sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'due'
          ? (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')
          : b.created_at.localeCompare(a.created_at),
    );

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title={t('assignments.title')}
        subtitle={t('learnPage.assignSubtitle')}
        actions={createLink}
      />
      {staff && (
        <Tabs
          variant="pills"
          value={tab}
          onChange={setTab}
          items={[
            {
              value: 'assigned',
              label: t('exercise.tabAssigned'),
              count: assignments.data?.length,
            },
            { value: 'exercises', label: t('exercise.title') },
          ]}
        />
      )}
      {staff && tab === 'exercises' ? (
        <Exercises />
      ) : (
        <>
          <FilterBar>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('learnPage.assignSearch')}
            />
            <SelectField
              label={t('learnPage.sort')}
              value={sort}
              onChange={setSort}
              options={[
                { value: 'newest', label: t('learnPage.sortNewest') },
                { value: 'due', label: t('learnPage.sortDue') },
                { value: 'title', label: t('learnPage.sortTitle') },
              ]}
            />
          </FilterBar>
          {assignments.isPending ? (
            <Spinner />
          ) : assignments.error ? (
            <ErrorText error={assignments.error} />
          ) : assignments.data.length === 0 ? (
            <EmptyState
              dashed
              icon={ClipboardList}
              title={staff ? t('assignments.none') : t('assignments.noneStudent')}
              action={createLink}
            />
          ) : shown.length === 0 ? (
            <EmptyState icon={Search} title={t('learnPage.noMatch')} />
          ) : (
            <Card>
              <ul className="flex flex-col divide-y divide-text-muted/15">
                {shown.map((a) => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    staff={staff}
                    // RLS đã giới hạn: học viên chỉ thấy dòng của mình, phụ huynh thấy của con
                    rows={(progress.data ?? []).filter((p) => p.assignmentId === a.id)}
                  />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function AssignmentRow({
  assignment: a,
  staff,
  rows,
}: {
  assignment: AssignmentSummary;
  staff: boolean;
  rows: ProgressRow[];
}) {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const overdue = a.due_at && new Date(a.due_at).getTime() < Date.now();
  const finished = rows.filter((r) => r.totalItems > 0 && r.solvedItems === r.totalItems).length;
  const mine = !staff && rows.length === 1 ? rows[0] : undefined;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex flex-col">
        <Link
          to="/a/$slug/assignments/$id"
          params={{ slug: academy.slug, id: a.id }}
          className="font-medium text-primary hover:underline"
        >
          {a.title}
        </Link>
        <span className="text-sm text-text-muted">
          {t('assignments.puzzleCount', { count: a.itemCount })}
          {a.due_at && (
            <>
              {' · '}
              <span className={overdue ? 'text-danger' : undefined}>
                {t('assignments.dueAt', { date: formatDateTime(a.due_at, i18n.language) })}
              </span>
            </>
          )}
        </span>
      </div>
      <span className="text-sm">
        {staff ? (
          `${t('assignments.done')}: ${finished}/${rows.length}`
        ) : mine ? (
          mine.solvedItems === mine.totalItems ? (
            <span className="font-medium text-green">{t('assignments.done')}</span>
          ) : (
            t('assignments.progress', { solved: mine.solvedItems, total: mine.totalItems })
          )
        ) : null}
      </span>
    </li>
  );
}
