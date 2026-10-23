import { replayAt } from '@erpchess/api';
import { useClassroom, useClassroomEvents } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/classes/$id/replay')({
  component: ReplayPage,
});

const KINDS = ['move', 'fen', 'draw', 'chat', 'control'] as const;

function ReplayPage() {
  const { t, i18n } = useT();
  const { id } = Route.useParams();
  const { academy } = useAcademy();
  const classroom = useClassroom(id);
  const events = useClassroomEvents(id);
  const [step, setStep] = useState(0);

  if (classroom.isPending || events.isPending) return <Spinner />;
  if (classroom.error || events.error) return <ErrorText error={classroom.error ?? events.error} />;
  const list = events.data;
  const total = list.length;
  const frame = replayAt(list, step);
  const current = step > 0 ? list[step - 1] : undefined;
  const go = (n: number) => setStep(Math.max(0, Math.min(total, n)));

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/a/$slug/classes/$id"
        params={{ slug: academy.slug, id }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {classroom.data.title}
      </Link>
      <h2 className="text-2xl font-bold text-primary">{t('classroom.replay')}</h2>
      {total === 0 ? (
        <p className="text-text-muted">{t('classroom.replayEmpty')}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            <div className="mx-auto w-full max-w-[560px]">
              <Board
                fen={frame.fen}
                lastMove={frame.lastMove ?? undefined}
                drawings={frame.drawings}
                label={classroom.data.title}
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="ghost" onClick={() => go(0)} disabled={step === 0}>
                {t('classroom.first')}
              </Button>
              <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
                {t('classroom.prev')}
              </Button>
              <span role="status" className="text-sm text-text-muted">
                {t('classroom.step', { n: step, total })}
              </span>
              <Button variant="ghost" onClick={() => go(step + 1)} disabled={step === total}>
                {t('classroom.next')}
              </Button>
              <Button variant="ghost" onClick={() => go(total)} disabled={step === total}>
                {t('classroom.last')}
              </Button>
            </div>
            {current && (
              <p className="text-center text-sm text-text-muted">
                {KINDS.includes(current.kind as (typeof KINDS)[number]) &&
                  t(`classroom.event_${current.kind as (typeof KINDS)[number]}`)}{' '}
                · {new Date(current.at).toLocaleTimeString(i18n.language)}
              </p>
            )}
          </div>
          <Card title={t('classroom.chat')}>
            {frame.chats.length === 0 ? (
              <p className="text-sm text-text-muted">{t('classroom.noChat')}</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {frame.chats.map((m) => (
                  <li key={m.id}>
                    <span className="text-xs text-text-muted">{m.name}</span>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
