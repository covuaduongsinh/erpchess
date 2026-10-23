import {
  useMembers,
  useQuiz,
  useQuizAttempts,
  useQuizItems,
  useQuizLeaderboard,
  useQuizMutations,
} from '@erpchess/api/react';
import { isStaff, quizStatus } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { QuizTaker } from '../components/quiz/QuizTaker';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime, formatDuration } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/quizzes/$id')({
  component: QuizPage,
});

function QuizPage() {
  const { t, i18n } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const quiz = useQuiz(id);
  const staff = isStaff(academy.role);
  const [preview, setPreview] = useState(false);

  if (quiz.isPending) return <Spinner />;
  if (quiz.error) return <ErrorText error={quiz.error} />;
  const q = quiz.data;
  const status = quizStatus(q.starts_at, q.due_at);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/a/$slug/quizzes"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('quiz.title')}
      </Link>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-primary">{q.title}</h2>
        <p className="text-sm text-text-muted">
          {t(`quiz.status_${status}`)}
          {q.starts_at && ` · ${t('quiz.startsAt')}: ${formatDateTime(q.starts_at, i18n.language)}`}
          {q.due_at && ` · ${t('quiz.dueAt')}: ${formatDateTime(q.due_at, i18n.language)}`}
        </p>
      </div>
      {staff && !preview ? (
        <>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPreview(true)}>
              {t('quiz.preview')}
            </Button>
            <DeleteQuiz id={id} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Report quizId={id} />
            <Leaderboard quizId={id} />
          </div>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <QuizTaker quizId={id} userId={session.user.id} startsAt={q.starts_at} dueAt={q.due_at} />
          <Leaderboard quizId={id} />
        </div>
      )}
    </div>
  );
}

function DeleteQuiz({ id }: { id: string }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { remove } = useQuizMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  return (
    <Button
      variant="ghost"
      className="text-danger"
      disabled={remove.isPending}
      onClick={() =>
        confirm
          ? remove.mutate(id, {
              onSuccess: () =>
                void navigate({ to: '/a/$slug/quizzes', params: { slug: academy.slug } }),
            })
          : setConfirm(true)
      }
    >
      {confirm ? t('studies.confirmDelete') : t('quiz.delete')}
    </Button>
  );
}

/** Bảng học viên × câu cho HLV (đọc đáp án được nên dùng quiz_items trực tiếp). */
function Report({ quizId }: { quizId: string }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const items = useQuizItems(quizId);
  const ids = useMemo(() => items.data?.map((i) => i.id) ?? [], [items.data]);
  const attempts = useQuizAttempts(quizId, ids);
  const members = useMembers(academy.id);
  if (items.isPending || attempts.isPending) return <Spinner />;
  const byKey = new Map(attempts.data?.map((a) => [`${a.student_id}:${a.item_id}`, a]));
  const studentIds = [...new Set(attempts.data?.map((a) => a.student_id))];
  const name = (sid: string) =>
    members.data?.find((m) => m.profile.id === sid)?.profile.display_name ?? '?';

  return (
    <Card title={t('quiz.report')}>
      {studentIds.length === 0 ? (
        <p className="text-text-muted">{t('quiz.noAttempts')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-muted">
              <tr>
                <th className="py-1 pr-3">{t('students.title')}</th>
                {items.data?.map((it, i) => (
                  <th key={it.id} className="px-2 py-1 text-center">
                    {i + 1}
                  </th>
                ))}
                <th className="px-2 py-1 text-right">{t('quiz.total')}</th>
              </tr>
            </thead>
            <tbody>
              {studentIds.map((sid) => {
                let total = 0;
                let time = 0;
                return (
                  <tr key={sid} className="border-t border-text-muted/10">
                    <td className="py-1 pr-3">{name(sid)}</td>
                    {items.data?.map((it) => {
                      const a = byKey.get(`${sid}:${it.id}`);
                      total += a?.score ?? 0;
                      time += a?.time_ms ?? 0;
                      return (
                        <td
                          key={it.id}
                          className="px-2 py-1 text-center"
                          title={a ? t('puzzle.triesSoFar', { count: a.tries }) : ''}
                        >
                          {!a ? (
                            '·'
                          ) : a.solved ? (
                            <span className="text-green">✓{a.tries > 1 ? a.tries : ''}</span>
                          ) : (
                            <span className="text-danger">✗{a.tries}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-medium">
                      {total} · {formatDuration(time)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Leaderboard({ quizId }: { quizId: string }) {
  const { t } = useT();
  const { session } = useAcademy();
  const board = useQuizLeaderboard(quizId);
  return (
    <Card title={t('dashboard.leaderboard')}>
      {board.isPending ? (
        <Spinner />
      ) : board.error ? (
        <ErrorText error={board.error} />
      ) : board.data.length === 0 ? (
        <p className="text-sm text-text-muted">{t('quiz.leaderboardEmpty')}</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm">
          {board.data.map((r, i) => (
            <li
              key={r.studentId}
              className={`flex items-center gap-2 rounded px-2 py-1 ${r.studentId === session.user.id ? 'bg-yellow/20' : ''}`}
            >
              <span className="w-5 text-text-muted">{i + 1}</span>
              <span className="flex-1">{r.displayName}</span>
              <span className="text-text-muted">{formatDuration(r.timeMs)}</span>
              <span className="w-16 text-right font-bold text-primary">
                {t('dashboard.points', { count: r.score })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
