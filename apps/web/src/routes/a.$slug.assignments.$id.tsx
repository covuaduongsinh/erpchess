import type { AssignmentDetail, AttemptSummary } from '@erpchess/api';
import {
  useAssignment,
  useAttempts,
  useDeleteAssignment,
  useMembers,
  useProgress,
  useSubmitAttempt,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { PuzzleSolver } from '../components/puzzle/PuzzleSolver';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime, formatDuration } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/assignments/$id')({
  component: AssignmentPage,
});

function AssignmentPage() {
  const { t, i18n } = useT();
  const { id } = Route.useParams();
  const { academy } = useAcademy();
  const assignment = useAssignment(id);

  if (assignment.isPending) return <Spinner />;
  if (assignment.error) return <ErrorText error={assignment.error} />;
  const a = assignment.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-primary">{a.title}</h2>
        {a.due_at && (
          <p className="text-sm text-text-muted">
            {t('assignments.dueAt', { date: formatDateTime(a.due_at, i18n.language) })}
          </p>
        )}
        {a.instructions && <p className="whitespace-pre-line">{a.instructions}</p>}
      </div>
      {academy.role === 'student' ? <StudentWork assignment={a} /> : <Report assignment={a} />}
    </div>
  );
}

// ── Học viên làm bài ──

function StudentWork({ assignment }: { assignment: AssignmentDetail }) {
  const { t } = useT();
  const { session } = useAcademy();
  const attempts = useAttempts(assignment, session.user.id);
  const submit = useSubmitAttempt(assignment.id);
  const [index, setIndex] = useState<number | null>(null);

  if (attempts.isPending) return <Spinner />;
  const byItem = new Map(attempts.data?.map((x) => [x.item_id, x]));
  const items = assignment.items;
  if (items.length === 0) return <p className="text-text-muted">{t('common.empty')}</p>;
  // Mặc định mở câu chưa giải đầu tiên
  const current =
    index ??
    Math.max(
      0,
      items.findIndex((i) => !byItem.get(i.id)?.solved),
    );
  const item = items[current];
  if (!item) return null;
  const attempt = byItem.get(item.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="max-w-[640px]">
        <PuzzleSolver
          key={item.id}
          puzzle={item.puzzle}
          onTryEnd={(s) => {
            // Giữ nguyên câu đang làm: nếu không, làm mới danh sách lần làm sẽ nhảy sang câu chưa giải
            setIndex(current);
            submit.reset();
            submit.mutate({ itemId: item.id, moves: s.moves });
          }}
        >
          {submit.isPending && (
            <span className="text-sm text-text-muted">{t('puzzle.saving')}</span>
          )}
          {submit.isSuccess && <span className="text-sm text-text-muted">{t('puzzle.saved')}</span>}
          <ErrorText error={submit.error} />
          {current < items.length - 1 && (
            <Button variant="ghost" className="ml-auto" onClick={() => setIndex(current + 1)}>
              {t('puzzle.next')} →
            </Button>
          )}
        </PuzzleSolver>
      </div>

      <Card title={t('assignments.items')}>
        <p className="text-sm">
          <span className="font-medium">
            {t('puzzle.item', { n: current + 1, total: items.length })}:
          </span>{' '}
          {item.puzzle.title}
        </p>
        <p className="text-xs text-text-muted">
          {t('puzzle.rating', { rating: item.puzzle.rating })}
          {attempt && ` · ${t('puzzle.triesSoFar', { count: attempt.tries })}`}
        </p>
        <ol className="flex flex-col gap-1">
          {items.map((it, i) => {
            const att = byItem.get(it.id);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  aria-current={i === current}
                  onClick={() => {
                    submit.reset();
                    setIndex(i);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg aria-[current=true]:bg-primary/10"
                >
                  <span className="w-6 text-text-muted">{i + 1}.</span>
                  <span className="flex-1">{it.puzzle.title}</span>
                  {att?.solved ? (
                    <span className="text-green" title={t('puzzle.alreadySolved')}>
                      ✓
                    </span>
                  ) : att ? (
                    <span className="text-danger">✗</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

// ── Báo cáo cho HLV / phụ huynh ──

function itemCell(att: AttemptSummary | undefined) {
  if (!att) return { text: '–', className: 'text-text-muted' };
  return att.solved
    ? { text: att.tries > 1 ? `✓ ${att.tries}` : '✓', className: 'text-green' }
    : { text: `✗ ${att.tries}`, className: 'text-danger' };
}

function Report({ assignment }: { assignment: AssignmentDetail }) {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const navigate = useNavigate();
  const staff = isStaff(academy.role);
  const progress = useProgress({ assignmentId: assignment.id });
  const attempts = useAttempts(assignment);
  const members = useMembers(staff ? academy.id : undefined);
  const remove = useDeleteAssignment(academy.id);
  const [confirming, setConfirming] = useState(false);

  const names = new Map(members.data?.map((m) => [m.profile.id, m.profile.display_name]));
  const attemptOf = (studentId: string, itemId: string) =>
    attempts.data?.find((x) => x.student_id === studentId && x.item_id === itemId);

  return (
    <Card title={t('assignments.report')}>
      {progress.isPending ? (
        <Spinner />
      ) : progress.error ? (
        <ErrorText error={progress.error} />
      ) : progress.data.length === 0 ? (
        <p className="text-text-muted">{t('assignments.noReport')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-text-muted/20 text-left text-text-muted">
                <th className="py-2 pr-4 font-medium">{t('assignments.student')}</th>
                {assignment.items.map((it, i) => (
                  <th
                    key={it.id}
                    className="px-2 py-2 text-center font-medium"
                    title={it.puzzle.title}
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">{t('assignments.solved')}</th>
                <th className="px-2 py-2 font-medium">{t('assignments.tries')}</th>
                <th className="px-2 py-2 font-medium">{t('assignments.time')}</th>
                <th className="px-2 py-2 font-medium">{t('assignments.lastActivity')}</th>
              </tr>
            </thead>
            <tbody>
              {progress.data.map((row) => (
                <tr key={row.studentId} className="border-b border-text-muted/10">
                  <td className="py-2 pr-4 font-medium">
                    {names.get(row.studentId) ?? row.studentId.slice(0, 8)}
                  </td>
                  {assignment.items.map((it) => {
                    const cell = itemCell(attemptOf(row.studentId, it.id));
                    return (
                      <td key={it.id} className={`px-2 py-2 text-center ${cell.className}`}>
                        {cell.text}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2">
                    {row.solvedItems}/{row.totalItems}
                  </td>
                  <td className="px-2 py-2">{row.tries}</td>
                  <td className="px-2 py-2">{formatDuration(row.timeMs)}</td>
                  <td className="px-2 py-2 text-text-muted">
                    {row.lastActivity
                      ? formatDateTime(row.lastActivity, i18n.language)
                      : t('assignments.notStarted')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {staff && (
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="self-start text-danger"
            disabled={remove.isPending}
            onClick={() => {
              if (!confirming) return setConfirming(true);
              remove.mutate(assignment.id, {
                onSuccess: () =>
                  void navigate({ to: '/a/$slug/assignments', params: { slug: academy.slug } }),
              });
            }}
          >
            {confirming ? t('assignments.confirmDelete') : t('assignments.delete')}
          </Button>
          <ErrorText error={remove.error} />
        </div>
      )}
    </Card>
  );
}
