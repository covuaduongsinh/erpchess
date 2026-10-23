import type { QuizAttempt, QuizQuestion } from '@erpchess/api';
import {
  useAnswerQuiz,
  useQuizAttempts,
  useQuizPuzzle,
  useQuizQuestions,
} from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { inCheck, kingSquare, legalDests, sideToMove } from '@erpchess/chess-core';
import { quizStatus } from '@erpchess/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRemaining } from '../../lib/format';
import { useT } from '../../lib/use-t';
import { Capture, Mcq } from '../study/ActivityPlayer';
import { Button, Card, ErrorText, Spinner } from '../ui';

/** Học viên làm quiz: đề không có đáp án, mọi câu chấm ở server qua `quiz-answer`. */
export function QuizTaker({
  quizId,
  userId,
  startsAt,
  dueAt,
}: {
  quizId: string;
  userId: string;
  startsAt: string | null;
  dueAt: string | null;
}) {
  const { t } = useT();
  const questions = useQuizQuestions(quizId);
  const ids = useMemo(() => questions.data?.map((q) => q.id) ?? [], [questions.data]);
  const attempts = useQuizAttempts(quizId, ids, userId);
  const [index, setIndex] = useState(0);
  const status = quizStatus(startsAt, dueAt);

  if (status === 'upcoming') return <p className="text-text-muted">{t('quiz.notStarted')}</p>;
  if (questions.isPending) return <Spinner />;
  if (questions.error) return <ErrorText error={questions.error} />;
  const list = questions.data;
  const current = list[index];
  const byItem = new Map(attempts.data?.map((a) => [a.item_id, a]));
  const score = attempts.data?.reduce((s, a) => s + a.score, 0) ?? 0;
  const max = list.reduce((s, q) => s + q.points, 0);
  const done = list.filter((q) => byItem.get(q.id)?.solved).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>{t('quiz.summary', { done, total: list.length, score, max })}</span>
        {dueAt && <Countdown dueAt={dueAt} />}
        {status === 'closed' && <span className="font-bold text-danger">{t('quiz.closed')}</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {list.map((q, i) => {
          const ok = byItem.get(q.id)?.solved;
          return (
            <button
              key={q.id}
              type="button"
              aria-current={i === index ? 'step' : undefined}
              aria-label={t('quiz.question', { n: i + 1 })}
              onClick={() => setIndex(i)}
              className={`flex size-8 items-center justify-center rounded-full text-sm aria-[current=step]:ring-2 aria-[current=step]:ring-primary ${ok ? 'bg-green text-white' : 'bg-text-muted/15'}`}
            >
              {ok ? '✓' : i + 1}
            </button>
          );
        })}
      </div>
      {current && (
        <Card title={current.title || t(`activity.${current.kind}`)}>
          <Question
            key={current.id}
            quizId={quizId}
            question={current}
            attempt={byItem.get(current.id)}
            closed={status === 'closed'}
          />
          <div className="flex justify-between">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              ← {t('puzzle.prev')}
            </Button>
            <Button
              variant="ghost"
              disabled={index >= list.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              {t('puzzle.next')} →
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Countdown({ dueAt }: { dueAt: string }) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Date.parse(dueAt) - now;
  if (left <= 0) return null;
  return (
    <span className="font-medium text-orange">
      {t('quiz.timeLeft', { time: formatRemaining(left) })}
    </span>
  );
}

function Question({
  quizId,
  question,
  attempt,
  closed,
}: {
  quizId: string;
  question: QuizQuestion;
  attempt?: QuizAttempt;
  closed: boolean;
}) {
  const { t } = useT();
  const answer = useAnswerQuiz(quizId);
  const solved = attempt?.solved ?? false;
  const triesLeft =
    question.maxAttempts === null
      ? null
      : Math.max(0, question.maxAttempts - (attempt?.tries ?? 0));
  const locked = closed || solved || triesLeft === 0;
  const since = useRef(Date.now());
  const ms = () => {
    const d = Date.now() - since.current;
    since.current = Date.now();
    return d;
  };
  const p = question.payload;

  let body = null;
  if (question.kind === 'puzzle') {
    body = <QuizPuzzle quizId={quizId} question={question} solved={solved} locked={locked} />;
  } else if (question.kind === 'mcq') {
    const last = answer.data;
    body = (
      <Mcq
        payload={p as { question: string; fen?: string; options: string[] }}
        disabled={locked || answer.isPending}
        feedback={last ? (last.ok ? 'right' : 'wrong') : null}
        onChoose={(choice) => answer.mutate({ itemId: question.id, answer: { choice }, ms: ms() })}
      />
    );
  } else {
    body = (
      <Capture
        payload={p as { fen: string }}
        disabled={locked}
        onSolved={(moves) => answer.mutate({ itemId: question.id, answer: { moves }, ms: ms() })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
          {t(`activity.${question.kind}`)}
        </span>
        <span>{t('player.points', { count: question.points })}</span>
        {triesLeft !== null && !solved && (
          <span className="text-text-muted">{t('player.triesLeft', { count: triesLeft })}</span>
        )}
        {solved && (
          <span role="status" className="font-bold text-green">
            {t('player.done', { score: attempt?.score ?? 0 })}
          </span>
        )}
      </div>
      {body}
      <ErrorText error={answer.error} />
    </div>
  );
}

function QuizPuzzle({
  quizId,
  question,
  solved,
  locked,
}: {
  quizId: string;
  question: QuizQuestion;
  solved: boolean;
  locked: boolean;
}) {
  const { t } = useT();
  const startFen = String(question.payload.fen ?? '');
  const { state, play, retry, error } = useQuizPuzzle(quizId, question.id, startFen, solved);
  const side = sideToMove(startFen);
  const dests = useMemo(() => legalDests(state.fen), [state.fen]);

  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-md">
        <Board
          fen={state.fen}
          orientation={side}
          lastMove={state.lastMove}
          check={inCheck(state.fen) ? kingSquare(state.fen) : undefined}
          movable={state.status === 'playing' && !locked ? { color: side, dests } : undefined}
          onMove={(from, to, promo) => void play(`${from}${to}${promo ?? ''}`)}
          label={t(`puzzle.toMove_${side}`)}
        />
      </div>
      <div className="flex min-h-10 items-center gap-3" aria-live="polite">
        {state.status === 'playing' && (
          <span className="text-text-muted">{t(`puzzle.toMove_${side}`)}</span>
        )}
        {state.status === 'waiting' && (
          <span className="text-text-muted">{t('quiz.checking')}</span>
        )}
        {state.status === 'solved' && (
          <span role="status" className="font-bold text-green">
            {t('puzzle.solved')}
          </span>
        )}
        {state.status === 'wrong' && (
          <>
            <span role="status" className="font-bold text-danger">
              {t('puzzle.wrong')}
            </span>
            {!locked && <Button onClick={retry}>{t('puzzle.retry')}</Button>}
          </>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  );
}
