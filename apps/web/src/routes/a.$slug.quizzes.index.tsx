import { useQuizzes } from '@erpchess/api/react';
import { isStaff, type QuizStatus, quizStatus } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AutoQuiz } from '../components/quiz/AutoQuiz';
import { QuizSchedulesPanel } from '../components/quiz/QuizSchedulesPanel';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/quizzes/')({
  component: QuizzesPage,
});

const FILTERS = ['all', 'open', 'upcoming', 'closed'] as const;
type Filter = (typeof FILTERS)[number];

const BADGE: Record<QuizStatus, string> = {
  open: 'bg-green/15 text-green',
  upcoming: 'bg-yellow/20 text-orange',
  closed: 'bg-text-muted/15 text-text-muted',
};

function QuizzesPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const quizzes = useQuizzes(academy.id);
  const [filter, setFilter] = useState<Filter>('all');
  const [auto, setAuto] = useState(false);
  const [schedules, setSchedules] = useState(false);
  const navigate = useNavigate();

  if (schedules) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <Button variant="ghost" className="self-start" onClick={() => setSchedules(false)}>
          ← {t('quiz.title')}
        </Button>
        <QuizSchedulesPanel />
      </div>
    );
  }

  if (auto) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <Button variant="ghost" className="self-start" onClick={() => setAuto(false)}>
          ← {t('quiz.title')}
        </Button>
        <AutoQuiz
          onDone={(id) =>
            void navigate({ to: '/a/$slug/quizzes/$id', params: { slug: academy.slug, id } })
          }
        />
      </div>
    );
  }

  return (
    <Card title={t('quiz.title')}>
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className="rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary"
            >
              {t(`quiz.filter_${f}`)}
            </button>
          ))}
        </div>
        {staff && (
          <Button variant="ghost" className="ml-auto" onClick={() => setSchedules(true)}>
            ⏰ {t('quizSchedule.title')}
          </Button>
        )}
        {staff && (
          <Button variant="ghost" onClick={() => setAuto(true)}>
            {t('quiz.auto')}
          </Button>
        )}
        {staff && (
          <Link
            to="/a/$slug/quizzes/new"
            params={{ slug: academy.slug }}
            search={{}}
            className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
          >
            {t('quiz.create')}
          </Link>
        )}
      </div>
      {quizzes.isPending ? (
        <Spinner />
      ) : quizzes.error ? (
        <ErrorText error={quizzes.error} />
      ) : (
        (() => {
          const rows = quizzes.data
            .map((q) => ({ q, status: quizStatus(q.starts_at, q.due_at) }))
            .filter(({ status }) => filter === 'all' || status === filter);
          if (rows.length === 0) return <p className="text-text-muted">{t('quiz.none')}</p>;
          return (
            <ul className="flex flex-col divide-y divide-text-muted/15">
              {rows.map(({ q, status }) => (
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
          );
        })()
      )}
    </Card>
  );
}
