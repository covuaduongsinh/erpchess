import type { AssignmentSummary, ProgressRow } from '@erpchess/api';
import { useAssignments, useProgress } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, ErrorText, Spinner } from '../components/ui';
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

  return (
    <Card title={t('assignments.title')}>
      {staff && (
        <Link
          to="/a/$slug/assignments/new"
          params={{ slug: academy.slug }}
          className="self-start rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
        >
          {t('assignments.create')}
        </Link>
      )}
      {assignments.isPending ? (
        <Spinner />
      ) : assignments.error ? (
        <ErrorText error={assignments.error} />
      ) : assignments.data.length === 0 ? (
        <p className="text-text-muted">
          {staff ? t('assignments.none') : t('assignments.noneStudent')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-text-muted/15">
          {assignments.data.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              staff={staff}
              // RLS đã giới hạn: học viên chỉ thấy dòng của mình, phụ huynh thấy của con
              rows={(progress.data ?? []).filter((p) => p.assignmentId === a.id)}
            />
          ))}
        </ul>
      )}
    </Card>
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
