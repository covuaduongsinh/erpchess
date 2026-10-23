import { useActivityAttempts, useStudy } from '@erpchess/api/react';
import type { ActivityKind } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ActivityPlayer } from '../components/study/ActivityPlayer';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/studies/$id/')({
  component: StudyPlayerPage,
});

/** Trình học: đi lần lượt các hoạt động, mỗi hoạt động chấm phía server qua submit-activity. */
function StudyPlayerPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const study = useStudy(id);
  const attempts = useActivityAttempts(study.data, session.user.id);
  const [index, setIndex] = useState(0);

  if (study.isPending) return <Spinner />;
  if (study.error) return <ErrorText error={study.error} />;
  const activities = study.data.activities;
  const current = activities[index];
  const byActivity = new Map(attempts.data?.map((a) => [a.activity_id, a]));
  const done = activities.filter((a) => byActivity.get(a.id)?.solved).length;
  const score = attempts.data?.reduce((s, a) => s + a.score, 0) ?? 0;
  const total = activities.reduce((s, a) => s + (a.invalid ? 0 : a.points), 0);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/a/$slug/studies"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('studies.title')}
      </Link>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-primary">{study.data.title}</h2>
        {study.data.description && <p className="text-text-muted">{study.data.description}</p>}
        <div className="mt-2 flex items-center gap-3 text-sm">
          <div
            role="progressbar"
            aria-label={t('player.progress')}
            aria-valuemin={0}
            aria-valuemax={activities.length}
            aria-valuenow={done}
            className="h-2 w-48 overflow-hidden rounded-full bg-text-muted/20"
          >
            <div
              className="h-full bg-green"
              style={{ width: `${activities.length ? (done / activities.length) * 100 : 0}%` }}
            />
          </div>
          <span>{t('player.summary', { done, total: activities.length, score, max: total })}</span>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="text-text-muted">{t('studies.noActivities')}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <ol className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {activities.map((a, i) => {
              const attempt = byActivity.get(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-current={i === index ? 'step' : undefined}
                    onClick={() => setIndex(i)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-bg aria-[current=step]:bg-primary/10"
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${attempt?.solved ? 'bg-green text-white' : 'bg-text-muted/15'}`}
                    >
                      {attempt?.solved ? '✓' : i + 1}
                    </span>
                    <span className="truncate">
                      {a.title || t(`activity.${a.kind as ActivityKind}`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <Card
            title={current?.title || (current ? t(`activity.${current.kind as ActivityKind}`) : '')}
          >
            {!current ? null : current.invalid ? (
              <p className="text-danger">{t('studies.invalidActivity')}</p>
            ) : (
              <ActivityPlayer
                key={current.id}
                studyId={id}
                activity={current}
                attempt={byActivity.get(current.id)}
              />
            )}
            <div className="flex justify-between">
              <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                ← {t('puzzle.prev')}
              </Button>
              <Button
                variant="ghost"
                disabled={index >= activities.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                {t('puzzle.next')} →
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
